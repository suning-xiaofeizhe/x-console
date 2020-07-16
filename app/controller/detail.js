'use strict';

const Controller = require('egg').Controller;

class ProcessController extends Controller {
  async getProcessDetail() {
    const { ctx, ctx: { service: { detail } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const pid = ctx.query.pid;
    const trend = ctx.query.trend;
    const data = await detail.getProcessTrend(appId, agentId, pid, trend);
    ctx.body = { ok: true, data };
  }
}

module.exports = ProcessController;
