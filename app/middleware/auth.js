'use strict';

async function checkUserAppAuth(mysql, user, appId) {
  const task = [];
  task.push(mysql.checkOwnerIdAndAppId(user.ID, appId));
  task.push(mysql.checkMemberShip(user.ID, appId));
  const data = await Promise.all(task);
  if (data[0] || data[1].length) {
    return true;
  }
  return false;
}

module.exports = () => {
  return {
    // check login
    async userRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      if (ctx.user) {
        try {
          await mysql.addUser(ctx.user);
        } catch (err) {
          ctx.logger.error(`add user failed: ${err}`);
        }
        await next();
      } else {
        ctx.body = { ok: false, message: '用户未登陆，请先登陆！', code: 401 };
      }
    },

    // check app owner
    async appOwnerRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      const user = ctx.user;
      const appId = ctx.query.appId || ctx.request.body.appId;
      const count = await mysql.checkOwnerIdAndAppId(user.ID, appId);
      if (count > 0) {
        await next();
      } else {
        ctx.body = { ok: false, message: '用户没有此 app 的管理权限！' };
      }
    },

    // check app belonged to user
    async appMemberRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      const user = ctx.user;
      const appId = ctx.query.appId || ctx.request.body.appId;
      const auth = await checkUserAppAuth(mysql, user, appId);
      if (auth) {
        await next();
      } else {
        ctx.body = { ok: false, message: '用户没有此 app 的访问权限！' };
      }
    },

    // check user can access to activity / coredump
    async activityRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      const fileId = ctx.query.fileId || ctx.request.body.fileId;
      const fileType = ctx.query.fileType || ctx.request.body.fileType;
      let appId;
      if (fileType === 'core' || fileType === 'executable') {
        const coredump = await mysql.getCoredumpById(fileId);
        appId = coredump ? coredump.app_id : undefined;
      } else {
        const activity = await mysql.getActivityById(fileId);
        appId = activity ? activity.app_id : undefined;
      }
      if (appId) {
        const user = ctx.user;
        const task = [];
        task.push(mysql.checkOwnerIdAndAppId(user.ID, appId));
        task.push(mysql.checkMemberShip(user.ID, appId));
        const data = await Promise.all(task);
        if (data[0] || data[1].length) {
          await next();
          return;
        }
      }
      ctx.body = { ok: false, message: '用户没有此文件的访问权限！' };
    },

    // check user can modify strategy
    async strategyRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      const user = ctx.user;
      const strategyId = ctx.request.body.strategyId;
      if (!strategyId) {
        ctx.body = { ok: false, message: '必须填写规则 ID！' };
        return;
      }
      const strategy = await mysql.getStrategyById(strategyId);
      if (!strategy) {
        ctx.body = { ok: false, message: '规则不存在！' };
        return;
      }
      const auth = await checkUserAppAuth(mysql, user, strategy.app_id);
      if (auth) {
        await next();
      } else {
        ctx.body = { ok: false, message: '用户没有操作此告警规则的权限！' };
      }
    },

    // check the strategy id belongs to app
    async appStrategyRequired(ctx, next) {
      const { service: { mysql } } = ctx;
      const strategyId = ctx.query.strategyId;
      const appId = ctx.query.appId;
      const strategy = await mysql.getStrategyById(strategyId);
      if (strategy.app_id === +appId) {
        await next();
      } else {
        ctx.body = { ok: false, message: '您的应用下没有此规则！' };
      }
    },

    // check the agentId belongs to app
    async appAgentRequired(ctx, next) {
      const { service: { agentmanager } } = ctx;
      const appId = ctx.query.appId || ctx.request.body.appId;
      const agentId = ctx.query.agentId || ctx.request.body.agentId;
      const agents = await agentmanager.getInstances(appId);
      if (agents.some(agent => agentId === agent)) {
        await next();
      } else {
        ctx.body = { ok: false, message: '您的应用下没有此实例！' };
      }
    },

    // check is admin
    async adminRequired(ctx, next) {
      const { app: { config }, user: { ID } } = ctx;
      if (config.adminIDs.includes(ID)) {
        await next();
      } else {
        ctx.body = { ok: false, message: '您没有权限访问 Admin 数据' };
      }
    },
  };
};
