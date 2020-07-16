'use strict';

const pMap = require('p-map');
const Service = require('egg').Service;

class AdminAlarmService extends Service {
  async getAlarmMessageIn24hByStrategyId(strategyId, limit = Infinity) {
    const { ctx: { app: { config }, service: { mysql } } } = this;
    const tables = mysql.getTablesByPeriod('global_alarm_', config.alarmMessagePeriod * 60);
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

module.exports = AdminAlarmService;
