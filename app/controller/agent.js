'use strict';

const path = require('path');
const Controller = require('egg').Controller;

const permittedActions = ['cpu_profiling', 'heapdump', 'heap_profiling', 'gc_tracing', 'diag_report'];

const regexpMap = {
  cpu_profiling: /CPU profiling 文件路径：(.*)/,
  heapdump: /Heapdump 文件路径：(.*)/,
  heap_profiling: /Heap profiling 文件路径：(.*)/,
  gc_tracing: /GC tracing 文件路径：(.*)/,
  diag_report: /诊断报告文件路径：(.*)/,
};

class AgentController extends Controller {
  async getAgentList() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const appId = ctx.query.appId;
    let list = await agentmanager.getInstances(appId);
    list = list.map(agent => ({ label: agent, value: agent }));
    ctx.body = { ok: true, data: { list } };
  }

  async getAgentDetail() {
    const { ctx, service: { process } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const data = await process.getAgentDetail(appId, agentId);
    ctx.body = { ok: true, data };
  }

  async getProcessList() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const data = await agentmanager.getProcessList(appId, agentId);
    ctx.body = { ok: true, data };
  }

  async checkProcessStatus() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    const pid = ctx.query.pid;
    ctx.body = await agentmanager.checkProcessStatus(appId, agentId, pid);
  }

  async getOsInfo() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const appId = ctx.query.appId;
    const agentId = ctx.query.agentId;
    ctx.body = await agentmanager.getOsInfo(appId, agentId);
  }

  async takeAction() {
    const { ctx, ctx: { service: { agentmanager, mysql, detail } } } = this;
    const user = ctx.user;
    const post = ctx.request.body;
    const appId = post.appId;
    const agentId = post.agentId;
    const pid = post.pid;
    const action = post.action;
    if (action === 'save_process_data') {
      const data = await detail.saveProcessDataToOss(appId, agentId, pid);
      const file = data.fileName;
      const path = data.filePath;
      await mysql.addActivity(appId, agentId, 'trend', file, path, user.ID, 2);
      ctx.body = { ok: true, data: { type: action, file } };
      return;
    }

    if (!permittedActions.includes(action)) {
      ctx.body = { ok: false, message: `not support action: ${action}` };
      return;
    }
    const res = await agentmanager.takeAction(appId, agentId, pid, action);
    if (!res.ok || !res.data || !res.data[1]) {
      ctx.body = res;
      return;
    }
    const data = res.data[1];
    const patt = regexpMap[action].exec(data);
    if (!patt || !patt[1]) {
      ctx.body = { ok: false, message: `parse response [${data}] failed, regexp is ${regexpMap[action]}` };
      return;
    }
    const file = patt[1];
    const fileType = path.extname(file).slice(1);
    await mysql.addActivity(appId, agentId, fileType, file, '', user.ID, 0);
    ctx.body = { ok: true, data: { type: action, file } };
  }
}

module.exports = AgentController;
