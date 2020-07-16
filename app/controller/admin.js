
'use strict';

const pMap = require('p-map');
const Controller = require('egg').Controller;

class AdminController extends Controller {
  async getSummary() {
    const { ctx, ctx: { service: { mysql, agentmanager } } } = this;
    const summary = await mysql.getSummary();
    const instances = await pMap(summary.apps, ({ id }) => agentmanager.getInstanceCount(id), { concurrency: 5 });
    summary.appCount = summary.apps.length;
    summary.apps.forEach((app, index) => {
      app.count = Number(instances[index]);
      app.members = summary.members.filter(m => Number(m.app_id) === Number(app.id));
    });
    summary.users.forEach(user => {
      user.apps = summary.apps.filter(app => app.members.some(m => m.work_id === user.work_id)).map(app => app.name);
    });
    summary.userCount = summary.users.length;
    summary.instanceCount = instances.reduce((aac, c) => aac + Number(c), 0);
    delete summary.members;
    ctx.body = { ok: true, data: summary };
  }
}

module.exports = AdminController;
