'use strict';

const pMap = require('p-map');
const zlib = require('zlib');
const promisify = require('util').promisify;
const gzip = promisify(zlib.gzip);
const uuid = require('uuid');
const moment = require('moment');
const Service = require('egg').Service;

class DetailService extends Service {
  makeupTime(list, period) {
    const end = Date.now();
    const start = end - period * 60 * 1000;
    const periods = [];
    let tmp = start;
    while (moment(tmp).startOf('day') < end) {
      periods.push({
        start: moment(tmp).format('YYYY-MM-DD HH:mm'),
        end: moment(end).format('YYYYMMDD') === moment(tmp).format('YYYYMMDD') ?
          moment(end).format('YYYY-MM-DD HH:mm') : moment(tmp).endOf('day').format('YYYY-MM-DD HH:mm'),
      });
      tmp = moment(tmp).startOf('day').add(1, 'days');
    }
    const total = [];
    periods.forEach(p => {
      for (let start = moment(p.start); start <= moment(p.end); start = start.add(2, 'minutes')) {
        total.push(start.format('YYYY-MM-DD HH:mm'));
      }
    });
    const map = {};
    for (const data of list) {
      map[data.min] = data;
    }
    return total.map(time => {
      if (map[time]) {
        return map[time];
      }
      return { min: time };
    });
  }

  async getTotalProcessData(appId, agentId, pid, period) {
    const { ctx: { service: { mysql } } } = this;
    const tables = mysql.getTablesByPeriod('process_', period);
    let list = await pMap(tables, async table => {
      const data = await mysql.getProcessDataByAgentIdAndPid(table.name, appId, agentId, pid, table.start, table.end);
      return data;
    }, { concurrency: 1 });
    list = list.reduce((res, data) => {
      res = res.concat(data);
      return res;
    }, []);
    return list;
  }

  async getProcessTrend(appId, agentId, pid, trend) {
    const { ctx: { service: { detail } } } = this;
    const period = 24 * 60;
    const list = await detail.getTotalProcessData(appId, agentId, pid, period);
    const results = { trend: [] };
    if (trend === 'cpu') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          cpu_now: data.cpu_now,
          cpu_15: data.cpu_15,
          cpu_30: data.cpu_30,
          cpu_60: data.cpu_60,
        };
      });
    }
    if (trend === 'memory') {
      let heapLimit = 0;
      results.trend = list.map(data => {
        heapLimit = data.heap_limit;
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          rss: data.rss,
          heap_total: data.heap_total,
          heap_used: data.heap_used,
        };
      });
      results.heapLimit = heapLimit;
    }
    if (trend === 'heap') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          new_space: data.new_space_size,
          old_space: data.old_space_size,
          code_space: data.code_space_size,
          map_space: data.map_space_size,
          lo_space: data.lo_space_size,
        };
      });
    }
    if (trend === 'gc') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          total: +(data.total / (data.uptime * 1000) * 100).toFixed(4),
          scavange_duration: +(data.scavange_duration / (60 * 1000) * 100).toFixed(4),
          marksweep_duration: +(data.marksweep_duration / (60 * 1000) * 100).toFixed(4),
        };
      });
    }
    if (trend === 'handle') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          active_handles: data.active_handles,
        };
      });
    }
    if (trend === 'timer') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          timer_handles_active: data.timer_handles_active,
        };
      });
    }
    if (trend === 'tcp') {
      results.trend = list.map(data => {
        return {
          min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
          tcp_handles_active: data.tcp_handles_active,
        };
      });
    }
    results.trend = this.makeupTime(results.trend, period);
    return results;
  }

  async saveProcessDataToOss(appId, agentId, pid) {
    const { ctx: { app, app: { oss }, service: { detail } } } = this;
    const period = 24 * 60;
    const list = await detail.getTotalProcessData(appId, agentId, pid, period);
    const fileName = `u-${uuid()}-u-x-process-snapshot-${pid}-${moment().format('YYYYMMDD')}-${parseInt(Math.random() * 10e4)}.trend`;
    const buffer = await gzip(JSON.stringify(list));
    await oss.uploadBigObject(fileName, buffer);
    return { fileName: app.modifyFileName(fileName), filePath: fileName };
  }
}

module.exports = DetailService;
