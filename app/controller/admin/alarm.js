'use strict';

const boolex = require('boolex');
const moment = require('moment');
const pMap = require('p-map');
const Controller = require('egg').Controller;

class AdminAlarmController extends Controller {
  async getStrategies() {
    const { ctx, ctx: { service: { mysql, admin: { alarm } } } } = this;
    let list = await mysql.getGlobalStrategies();
    list.sort((o, n) => (new Date(o.gm_create) > new Date(n.gm_create) ? 1 : -1));
    list = await pMap(list, async l => {
      const { list } = await alarm.getAlarmMessageIn24hByStrategyId(l.id);
      return {
        strategyId: l.id,
        contextType: l.context_type,
        pushType: l.push_type,
        dsl: l.dsl,
        expr: l.expr,
        status: l.status,
        count: list.length,
      };
    }, { concurrency: 2 });
    ctx.body = { ok: true, data: { list } };
  }

  async addStrategy() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const contextType = post.contextType;
    const pushType = post.pushType;
    const dsl = post.dsl;
    const expr = post.expr;
    try {
      boolex.compile(dsl);
    } catch (err) {
      ctx.logger.error(`illegal dls: ${dsl}`);
      ctx.body = { ok: false, message: `illegal dsl: ${dsl}` };
      return;
    }
    await mysql.addGlobalStrategy(contextType, pushType, dsl, expr);
    ctx.body = { ok: true };
  }

  async updateStrategy() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const contextType = post.contextType;
    const pushType = post.pushType;
    const dsl = post.dsl;
    const expr = post.expr;
    const strategyId = post.strategyId;
    try {
      boolex.compile(dsl);
    } catch (err) {
      ctx.logger.error(`illegal dls: ${dsl}`);
      ctx.body = { ok: false, message: `illegal dsl: ${dsl}` };
      return;
    }
    if (!strategyId) {
      ctx.body = { ok: false, message: '没有规则 ID' };
      return;
    }
    await mysql.updateGlobalStrategy(strategyId, contextType, pushType, dsl, expr);
    ctx.body = { ok: true };
  }

  async deleteStrategy() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const strategyId = post.strategyId;
    await mysql.deleteGlobalStrategy(strategyId);
    ctx.body = { ok: true };
  }

  async updateStrategyStatus() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const strategyId = post.strategyId;
    const status = post.status;
    await mysql.updateGlobalStrategyStatus(strategyId, status);
    ctx.body = { ok: true };
  }

  async getAlarmList() {
    const { ctx, ctx: { service: { admin: { alarm }, mysql } } } = this;
    // const appId = ctx.query.appId;
    const strategyId = ctx.query.strategyId;
    const tasks = [];
    tasks.push(mysql.getGlobalStrategyById(strategyId));
    tasks.push(alarm.getAlarmMessageIn24hByStrategyId(strategyId, 100));
    const data = await Promise.all(tasks);
    let instanceTab = 'process';
    if (['@critical', '@high', '@moderate', '@low'].some(key => data[0].dsl.includes(key))) {
      instanceTab = 'package';
    }
    const type = data[0].context_type;
    if (type === 'error_log') {
      instanceTab = 'error';
    }
    if (type === 'system_log') {
      instanceTab = 'system';
    }
    const list = await pMap(data[1].list, async l => {
      const user = await mysql.getAppByAppId(l.app_id);
      return {
        appId: l.app_id,
        agentId: l.agent_id,
        owner: user.owner,
        time: moment(l.gm_create).format('YYYY-MM-DD HH:mm:ss'),
        contextType: data[0].context_type,
        expr: l.message,
        pid: l.pid,
        instanceTab,
      };
    }, { concurrency: 2 });

    ctx.body = { ok: true, data: { list, totalCount: data[1].totalCount } };
  }

  async getMember() {
    const { ctx, ctx: { app: { config }, service: { mysql } } } = this;
    const strategyId = ctx.query.strategyId;
    const tasks = [];
    // tasks.push(mysql.getAppByAppId(appId));
    // tasks.push(mysql.getJoinedMemberByAppId(appId));
    tasks.push(mysql.getGlobalStrategySettedMembers(strategyId));
    const data = await Promise.all(tasks);
    // const owner = [data[0]];
    // const appMembers = data[1].filter(m => m.status === 2);
    const settedMembers = data[0];
    const total = (await mysql.getUserInfoByIds(config.adminIDs))
      .map(user => ({ workId: user.work_id, userName: user.user_name, strategyId }));
    // total = total.concat(owner.map(o => ({ workId: o.owner, userName: o.owner_name, strategyId })));
    // total = total.concat(appMembers.map(app => ({ workId: app.work_id, userName: app.user_name, strategyId })));
    const settedList = settedMembers.map(s => ({ workId: s.work_id, userName: s.user_name, strategyId }));
    const remainList = total.filter(t => settedList.every(s => s.workId !== t.workId));
    ctx.body = { ok: true, data: { settedList, remainList } };
  }

  async addStrategyMember() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const strategyId = post.strategyId;
    const workId = post.workId;
    await mysql.addGlobalStrategyMember(strategyId, workId);
    ctx.body = { ok: true };
  }

  async deleteStrategyMember() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const strategyId = post.strategyId;
    const workId = post.workId;
    await mysql.deleteGlobalStrategyMember(strategyId, workId);
    ctx.body = { ok: true };
  }
}

module.exports = AdminAlarmController;
