'use strict';

const pMap = require('p-map');
const Controller = require('egg').Controller;

class AppController extends Controller {
  async create() {
    const { ctx, ctx: { app, service: { mysql } } } = this;
    const post = ctx.request.body;
    const user = ctx.user;
    const appName = post.appName;
    const appSecret = app.createKey(appName);
    try {
      const appId = await mysql.addApp(appName, user.ID, appSecret);
      ctx.body = { ok: true, data: { appId, appName, appSecret } };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        ctx.body = { ok: false, message: '同一个用户下不允许创建名称重复的应用！' };
      }
    }
  }

  async getApps() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const user = ctx.user;
    const query = ctx.query;
    const type = query.type;
    if (type === 'myApps') {
      let list = await mysql.getAppsByOwnerId(user.ID);
      list = list.map(item => ({ appName: item.name, appId: item.id, own: true }));
      let invitations = await mysql.getInvitationApps(user.ID);
      invitations = invitations.map(item => ({ appId: item.id, appName: item.name, owner: item.owner }));
      ctx.body = { ok: true, data: { list, invitations } };
    } else if (type === 'joinedApps') {
      let list = await mysql.getJoinedApps(user.ID);
      list = list.map(item => ({ appName: item.name, appId: item.id, own: false }));
      ctx.body = { ok: true, data: { list } };
    } else {
      ctx.body = { ok: false, message: `不支持的类型: ${type}` };
    }
  }

  async getAppSecret() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const appId = ctx.query.appId;
    const data = await mysql.getAppByAppId(appId);
    ctx.body = { ok: true, data: { secret: data.secret } };
  }

  async getAppInfo() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const appId = ctx.query.appId;
    const user = ctx.user;
    const tasks = [];
    tasks.push(mysql.getAppByAppId(appId));
    tasks.push(mysql.getAppByAppId(appId));
    const data = await Promise.all(tasks);
    const ownerInfo = data[0];
    ctx.body = {
      ok: true, data: {
        name: data[1].name,
        own: ownerInfo.owner === String(user.ID),
      },
    };
  }

  async getInstanceCount() {
    const { ctx, ctx: { service: { agentmanager } } } = this;
    const count = await agentmanager.getInstanceCount(ctx.query.appId);
    ctx.body = { ok: true, data: { count } };
  }

  async getAlarmCount() {
    const { ctx, ctx: { service: { alarm } } } = this;
    const list = await alarm.getAlarmMessageIn24h(ctx.query.appId);
    ctx.body = { ok: true, data: { count: list.length } };
  }

  async getCpuUsageOverview() {
    const { ctx, ctx: { service: { agentmanager, process } } } = this;
    const appId = ctx.query.appId;
    const instances = await agentmanager.getInstances(appId);
    if (!instances.length) {
      ctx.body = { ok: true, data: { list: [] } };
      return;
    }
    const data = await pMap(instances,
      async agentId => process.getAgentDetail(appId, agentId));
    const cpuUsage = data.map((d, index) => {
      const agentId = instances[index];
      const detail = d.detail;
      if (Array.isArray(detail) && detail.length) {
        let maxCpuUsage = 0;
        let maxPid = null;
        let averageCpuUsage = 0;
        for (const proc of detail) {
          if (!proc.cpu_60 || isNaN(proc.cpu_60)) {
            continue;
          }
          if (proc.cpu_60 > maxCpuUsage) {
            maxCpuUsage = proc.cpu_60;
            maxPid = proc.pid;
          }
          averageCpuUsage += proc.cpu_60;
        }
        averageCpuUsage = (averageCpuUsage / detail.length).toFixed(2);
        const cpuUsage = averageCpuUsage;
        const status = cpuUsage < 60 ? 0 : cpuUsage < 85 ? 1 : 2;
        return { status, agentId, cpuUsage, maxCpuUsage, averageCpuUsage, pid: maxPid };
      }
      return { status: '-', agentId, cpuUsage: '-' };

    });
    ctx.body = { ok: true, data: { list: cpuUsage } };
  }

  async getMemoryUsageOverview() {
    const { ctx, ctx: { service: { agentmanager, process } } } = this;
    const appId = ctx.query.appId;
    const instances = await agentmanager.getInstances(appId);
    if (!instances.length) {
      ctx.body = { ok: true, data: { list: [] } };
      return;
    }
    const data = await pMap(instances,
      async agentId => process.getAgentDetail(appId, agentId));
    const memoryUsage = data.map((d, index) => {
      const agentId = instances[index];
      const detail = d.detail;
      if (Array.isArray(detail) && detail.length) {
        let maxMemoryUsage = 0;
        let maxPid = null;
        let averageMemoryUsage = 0;
        for (const proc of detail) {
          if (!proc.heap_limit || isNaN(proc.heap_limit) || !proc.heap_used || isNaN(proc.heap_used)) {
            continue;
          }
          const usage = proc.heap_used / proc.heap_limit;
          if (usage > maxMemoryUsage) {
            maxMemoryUsage = usage;
            maxPid = proc.pid;
          }
          averageMemoryUsage += usage;
        }
        averageMemoryUsage = averageMemoryUsage / detail.length;
        const memoryUsage = (averageMemoryUsage * 100).toFixed(2);
        const status = memoryUsage < 60 ? 0 : memoryUsage < 85 ? 1 : 2;
        return { status, agentId, memoryUsage, maxMemoryUsage, averageMemoryUsage, pid: maxPid };
      }
      return { status: '-', agentId, memoryUsage: '-' };

    });
    ctx.body = { ok: true, data: { list: memoryUsage } };
  }
}

module.exports = AppController;
