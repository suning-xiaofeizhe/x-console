'use strict';

const Controller = require('egg').Controller;

class SettingController extends Controller {
  async modifyAppName() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const newAppName = post.appName;
    await mysql.updateAppNameByAppId(newAppName, appId);
    ctx.body = { ok: true };
  }

  async deleteApp() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    // todo: also need to delete oss, member and process info
    const tasks = [];
    tasks.push(mysql.deleteAppByAppId(appId));
    tasks.push(mysql.deleteMembersByAppId(appId));
    tasks.push(mysql.deleteActivityByAppId(appId));
    tasks.push(mysql.deleteCoredumpByAppId(appId));
    tasks.push(mysql.deleteStrategyAndMembersByAppId(appId));
    await Promise.all(tasks);
    ctx.body = { ok: true };
  }
}

module.exports = SettingController;
