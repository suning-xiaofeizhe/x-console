'use strict';

const path = require('path');
const Controller = require('egg').Controller;

class LogController extends Controller {
  async getAgentErrorLogFiles() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const query = ctx.query;
    const appId = query.appId;
    const agentId = query.agentId;
    let errorLogFiles = await agentmanager.getAgentErrorLogFiles(appId, agentId);
    errorLogFiles = errorLogFiles.map(file => {
      return {
        errorLogPath: file,
        errorLogFile: path.basename(file),
      };
    });
    ctx.body = { ok: true, data: { errorLogFiles } };
  }

  async getAgentErrorLog() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const query = ctx.query;
    const appId = query.appId;
    const agentId = query.agentId;
    const errorLogPath = query.errorLogPath;
    const currentPage = query.currentPage;
    const pageSize = query.pageSize;
    const data = await agentmanager.getAgentErrorLog(appId, agentId, errorLogPath, currentPage, pageSize);
    ctx.body = { ok: true, data };
  }
}

module.exports = LogController;
