'use strict';

const path = require('path');
const zlib = require('zlib');
const fs = require('fs');
const promisify = require('util').promisify;
const unlink = promisify(fs.unlink);
const uuid = require('uuid/v4');
const { PassThrough } = require('stream');
const crypto = require('crypto');
const Controller = require('egg').Controller;

class UploadController extends Controller {
  async uploadFromConsole() {
    const { ctx, ctx: { app, app: { oss }, service: { mysql } } } = this;
    const file = ctx.request.files[0];
    const fileName = `u-${uuid()}-u-${app.modifyFileName(file.filename)}`;
    const pass = new PassThrough();
    const gzip = zlib.createGzip();
    try {
      fs.createReadStream(file.filepath).pipe(gzip).pipe(pass);
      await oss.uploadBigObject(fileName, pass);
      const user = ctx.user.ID;
      const query = ctx.query;
      const appId = query.appId;
      const type = query.type;
      const fileType = query.fileType;
      const id = query.id;
      // save activity
      if (type === 'activity') {
        await mysql.addActivity(appId, 'console', fileType, fileName, fileName, user, 2);
        ctx.body = { ok: true };
        return;
      }
      // save coredump
      if (type === 'coredump') {
        await mysql.addCoredump(appId, 'console', fileName, fileName, user, 2, id);
        ctx.body = { ok: true };
        return;
      }
      // save executable
      if (type === 'executable') {
        await mysql.addExecutable(appId, 'console', fileName, 0, user, id);
        ctx.body = { ok: true };
        return;
      }
      ctx.body = { ok: false, message: `not support type: ${type}` };
    } catch (err) {
      ctx.logger.error(err);
      ctx.body = { ok: false, message: '上传文件失败' };
    } finally {
      await unlink(file.filepath);
    }
  }

  async downloadToConsole() {
    const { ctx, ctx: { app: { oss }, service: { mysql } } } = this;
    const fileId = ctx.query.fileId;
    const fileType = ctx.query.fileType;
    let fileName;
    if (fileType === 'core') {
      const coredump = await mysql.getCoredumpById(fileId);
      fileName = coredump.core_path;
    } else if (fileType === 'executable') {
      const coredump = await mysql.getCoredumpById(fileId);
      fileName = coredump.executable_filename;
    } else {
      const activity = await mysql.getActivityById(fileId);
      fileName = activity.path;
    }
    ctx.set('content-type', 'application/octet-stream');
    ctx.set('content-disposition', `attachment;filename=${fileName}`);
    const pass = new PassThrough();
    const gunzip = zlib.createGunzip();
    oss.downloadObject(fileName).pipe(gunzip).pipe(pass);
    ctx.body = pass;
  }

  async uploadFromXagent() {
    const { ctx, ctx: { app: { oss, redis, config }, service: { mysql, oss: ossService } } } = this;
    const query = ctx.query;
    const fileId = query.id;
    const nonce = query.nonce;
    const sign = query.sign;
    const fileType = query.type;
    const timestamp = query.timestamp;
    const expiredTime = 60;

    // check params
    if (!fileId || !nonce || !sign || !fileType || !timestamp) {
      ctx.body = { ok: false, message: 'lack of query' };
      return;
    }

    // check upload time
    if (Date.now() - timestamp > expiredTime * 1000) {
      if (fileType === 'core') {
        await mysql.updateCoredumpToken(fileId, '');
      } else {
        await mysql.updateActivityToken(fileId, '');
      }
      ctx.body = { ok: false, message: 'out of time' };
      return;
    }

    // check nounce
    const nonceKey = `${config.uploadFileFromAgentKeyPrefix}::${nonce}`;
    const lock = await redis.setnx(nonceKey, 1);
    if (!lock) {
      if (fileType === 'core') {
        await mysql.updateCoredumpToken(fileId, '');
      } else {
        await mysql.updateActivityToken(fileId, '');
      }
      ctx.body = { ok: false, message: 'invalid nounce id' };
      return;
    }
    await redis.expire(nonceKey, expiredTime);

    // get secret, agentId and filename
    let token;
    let agentId;
    let filename;
    let filepath;
    if (fileType === 'core') {
      const coredump = await mysql.getCoredumpById(fileId);
      if (coredump) {
        token = coredump.token;
        agentId = coredump.agent_id;
        filename = coredump.core_filename;
        filepath = coredump.core_path;
      }
    } else {
      const activity = await mysql.getActivityById(fileId);
      if (activity) {
        token = activity.token;
        agentId = activity.agent_id;
        filename = activity.filename;
        filepath = activity.path;
      }
    }
    if (!token || !agentId || !filename) {
      if (fileType === 'core') {
        await mysql.updateCoredumpToken(fileId, '');
      } else {
        await mysql.updateActivityToken(fileId, '');
      }
      ctx.body = { ok: false, message: 'file not exists' };
      return;
    }

    // check signature
    const shasum = crypto.createHash('sha1');
    shasum.update([agentId, token, nonce, fileId, fileType, timestamp].join(''));
    const signature = shasum.digest('hex');
    if (sign !== signature) {
      if (fileType === 'core') {
        await mysql.updateCoredumpToken(fileId, '');
      } else {
        await mysql.updateActivityToken(fileId, '');
      }
      ctx.body = { ok: false, message: 'signature error' };
      return;
    }

    // delete old file is exists
    if (filepath) {
      try {
        await ossService.deleteOssFile(filepath);
      } catch (err) {
        ctx.body = { ok: false, message: 'delete old oss file failed!' };
        return;
      }
    }

    // upload to oss
    const file = ctx.request.files[0];
    let uploadName = path.basename(filename);
    if (uploadName === filename) {
      const tmp = /(x-.*\..*)/.exec(filename);
      if (tmp) {
        uploadName = tmp[1];
      }
    }
    const fileName = `u-${uuid()}-u-${uploadName}`;
    try {
      await oss.uploadBigObject(fileName, fs.createReadStream(file.filepath));
      if (fileType === 'core') {
        await Promise.all([
          mysql.updateCoredumpStatusById(fileId, 2, fileName),
          mysql.updateCoredumpToken(fileId, ''),
        ]);
      } else {
        await Promise.all([
          mysql.updateActivityStatusById(fileId, 2, fileName),
          mysql.updateActivityToken(fileId, ''),
        ]);
      }
      ctx.body = { ok: true, data: '转储成功' };
    } catch (err) {
      ctx.logger.error(err.stack);
      ctx.body = { ok: false, data: '转储失败' };
    } finally {
      await unlink(file.filepath);
    }
  }
}

module.exports = UploadController;
