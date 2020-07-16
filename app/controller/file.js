'use strict';

const path = require('path');
const pMap = require('p-map');
const moment = require('moment');
const uuid = require('uuid/v4');
const Controller = require('egg').Controller;

class FileController extends Controller {
  async getFileList() {
    const { ctx, ctx: { app, app: { config }, service: { mysql, agentmanager } } } = this;
    const query = ctx.query;
    const appId = query.appId;
    const page = query.page;
    const pageSize = query.size;
    const filterType = query.filterType;
    const data = await Promise.all([
      mysql.getActivitiesByAppId(appId, filterType),
      mysql.getCoredumpsByAppId(appId, filterType),
    ]);
    const list = [];
    for (const activity of data[0]) {
      list.push(activity);
    }
    for (const coredump of data[1]) {
      list.push(coredump);
    }
    list.sort((o, n) => (new Date(o.gm_create) < new Date(n.gm_create) ? 1 : -1));
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    let res = list.filter((...args) => args[1] >= start && args[1] < end);
    res = await pMap(res, async item => {
      let name = '未知';
      const user = await mysql.getUserInfoById(item.work_id);
      if (user) {
        name = user.user_name;
      }
      if (item.file_type) {
        // activity
        return {
          fileType: item.file_type,
          file: app.modifyFileName(item.filename),
          fileName: app.modifyFileName(item.path),
          name, workId: item.work_id,
          time: moment(item.gm_create).format('YYYY-MM-DD HH:mm:ss'),
          agent: item.agent_id,
          status: item.status,
          favor: item.favor,
          fileId: item.id,
          transferring: Boolean(item.token),
          update: item.gm_modified,
        };
      }
      // core
      return {
        fileType: 'core',
        coreFile: app.modifyFileName(item.core_filename),
        fileName: app.modifyFileName(item.core_path),
        executableFile: app.modifyFileName(item.executable_filename),
        executableStatus: item.executable_type,
        name, workId: item.work_id,
        time: moment(item.gm_create).format('YYYY-MM-DD HH:mm:ss'),
        agent: item.agent_id,
        status: item.status,
        favor: item.favor,
        fileId: item.id,
        transferring: Boolean(item.token),
        update: item.gm_modified,
      };

    }, { concurrency: 1 });
    const count = list.length;
    // check creating status
    const creatingList = res.filter(file => file.status === 0 || (file.status === 1 && file.transferring));
    await pMap(creatingList, async file => {
      if (file.status === 0) {
        const configure = config.creatingFileTimeout[file.fileType];
        if (configure) {
          if (configure.type === 'profiling') {
            const profilingTime = configure.profilingTime;
            const timeout = configure.timeout;
            const interval = new Date() - new Date(file.time);
            if (interval < profilingTime * 1000) {
              interval;
            } else if (interval < timeout * 1000) {
              const res = await agentmanager.checkFile(appId, file.agent, file.file);
              if (res.ok) {
                const data = res.data;
                if (data[file.file]) {
                  await mysql.updateActivityStatusById(file.fileId, 1);
                }
              }
            } else {
              await mysql.updateActivityStatusById(file.fileId, 1);
            }
          } else {
            const timeout = configure.timeout;
            if (timeout && new Date() - new Date(file.time) > timeout * 1000) {
              await mysql.updateActivityStatusById(file.fileId, 1);
            } else {
              const res = await agentmanager.checkFile(appId, file.agent, file.file);
              if (res.ok) {
                const data = res.data;
                if (data[file.file]) {
                  await mysql.updateActivityStatusById(file.fileId, 1);
                }
              }
            }
          }
        }
      } else if (file.status === 1) {
        const modifyTime = file.update;
        if (Date.now() - new Date(modifyTime) > config.fileTransferTimeout * 1000) {
          if (file.fileType === 'core') {
            await mysql.updateCoredumpToken(file.fileId, '');
          } else {
            await mysql.updateActivityToken(file.fileId, '');
          }
        }
      }
    }, { concurrency: 5 });
    ctx.body = { ok: true, data: { list: res, totalCount: count } };
  }

  async favor() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const fileId = post.fileId;
    const fileType = post.fileType;
    const favor = post.favor;
    if (fileType === 'core') {
      await mysql.updateCoredumpFavorStatusById(fileId, favor);
    } else {
      await mysql.updateActivityFavorStatusById(fileId, favor);
    }
    ctx.body = { ok: true };
  }

  async delete() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const fileId = post.fileId;
    const fileType = post.fileType;
    if (fileType === 'core') {
      await mysql.deleteCoredumpByFileId(fileId);
    } else {
      await mysql.deleteActivityByFileId(fileId);
    }
    ctx.body = { ok: true };
  }

  async transfer() {
    const { ctx, ctx: { app: { config }, service: { mysql, agentmanager } } } = this;
    const post = ctx.request.body;
    const fileId = post.fileId;
    const fileType = post.fileType;
    const token = uuid();
    let filePath;
    let appId;
    let agentId;
    if (fileType === 'core') {
      const data = await Promise.all([
        mysql.getCoredumpById(fileId),
        mysql.updateCoredumpToken(fileId, token),
      ]);
      const coredump = data[0];
      filePath = coredump.core_filename;
      appId = coredump.app_id;
      agentId = coredump.agent_id;
    } else {
      const data = await Promise.all([
        mysql.getActivityById(fileId),
        mysql.updateActivityToken(fileId, token),
      ]);
      const activity = data[0];
      filePath = activity.filename;
      appId = activity.app_id;
      agentId = activity.agent_id;
    }
    const uploadServer = config.uploadServer;
    const res = await agentmanager.transfer(appId, agentId, filePath, uploadServer, token, fileId, fileType);
    if (!res.ok) {
      if (fileType === 'core') {
        await mysql.updateCoredumpToken(fileId, '');
      } else {
        await mysql.updateActivityToken(fileId, '');
      }
      ctx.body = res;
      return;
    }
    ctx.body = { ok: true, data: '转储成功' };
  }

  async getDetail() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const query = ctx.query;
    const fileId = query.fileId;
    const fileType = query.fileType;
    let fileName;
    if (fileType === 'core') {
      const coredump = await mysql.getCoredumpById(fileId);
      if (coredump) {
        fileName = path.basename(coredump.core_filename);
      }
    } else {
      const activity = await mysql.getActivityById(fileId);
      if (activity) {
        fileName = path.basename(activity.filename);
      }
    }

    if (!fileName) {
      ctx.body = { ok: false, message: `file ${fileType} <${fileId}> not exists` };
      return;
    }
    ctx.body = { ok: true, data: { fileName, fileId, fileType } };
  }
}

module.exports = FileController;
