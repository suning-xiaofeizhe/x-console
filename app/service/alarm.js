'use strict';

const pMap = require('p-map');
const Service = require('egg').Service;

class AlarmService extends Service {
  async getAlarmMessageIn24h(appId) {
    const { ctx: { app: { config }, service: { mysql } } } = this;
    const strategies = await mysql.getStrategiesByAppId(appId);
    const tables = mysql.getTablesByPeriod('alarm_', config.alarmMessagePeriod * 60);
    const ids = strategies.filter(s => s.status === 1).map(s => s.id);
    if (!ids.length) {
      return [];
    }
    const list = await pMap(tables, async table => {
      const alarms = await mysql.getAlarmMessageByStrategyId(table.name, ids, table.start, table.end);
      return alarms;
    }, { concurrency: 1 });
    return list.reverse().reduce((res, l) => {
      res = res.concat(l);
      return res;
    }, []);
  }

  async getAlarmMessageIn24hByStrategyId(strategyId, limit = Infinity) {
    const { ctx: { app: { config }, service: { mysql } } } = this;
    const tables = mysql.getTablesByPeriod('alarm_', config.alarmMessagePeriod * 60);
    let list = await pMap(tables, async table => {
      const alarms = await mysql.getAlarmMessageByStrategyId(table.name, [strategyId], table.start, table.end);
      return alarms;
    }, { concurrency: 1 });
    list = list.reverse().reduce((res, l) => {
      res = res.concat(l);
      return res;
    }, []);
    const totalCount = list.length;
    list = list.filter((...args) => args[1] < limit);
    return { list, totalCount };
  }
}

module.exports = AlarmService;
