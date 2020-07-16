'use strict';

const Service = require('egg').Service;

class OssService extends Service {
  async deleteOssFile(fileName) {
    const { ctx, ctx: { app: { oss } } } = this;
    try {
      await oss.deleteObject(fileName);
    } catch (err) {
      ctx.logger.error(`delete oss file: ${fileName} failed: ${err.stack}`);
    }
  }
}

module.exports = OssService;
