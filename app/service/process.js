'use strict';

const moment = require('moment');
const pMap = require('p-map');
const Service = require('egg').Service;

class ProcessService extends Service {
  async getDistinctPidByPeriod(appId, agentId, period) {
    const { ctx: { service: { mysql } } } = this;
    const end = Date.now();
    const start = end - period * 60 * 1000;
    const tables = [];
    let tmp = start;
    while (moment(tmp).startOf('day') < end) {
      tables.push({
        date: moment(tmp).format('DD'),
        start: moment(tmp).format('YYYY-MM-DD HH:mm:ss'),
        end: moment(end).format('YYYYMMDD') === moment(tmp).format('YYYYMMDD') ?
          moment(end).format('YYYY-MM-DD HH:mm:ss') : moment(tmp).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      });
      tmp = moment(tmp).startOf('day').add(1, 'days');
    }
    const data = await pMap(tables, async data => {
      return mysql.getDistinctPidByPeriod(appId, agentId, data.date, data.start, data.end);
    }, { concurrency: 5 });
    const total = Array.from(new Set(data.reduce((pre, next) => {
      pre = pre.concat(next.map(item => item.pid));
      return pre;
    }, [])));
    return total;
  }

  async getAgentDetail(appId, agentId) {
    const { ctx: { app: { config }, service: { agentmanager, mysql } } } = this;
    const data = await Promise.all([
      // todo: show exit process in 24h
      this.getDistinctPidByPeriod(appId, agentId, config.processTrendPeriod * 60),
      this.getDistinctPidByPeriod(appId, agentId, 3),
    ]);
    if (!Array.isArray(data[1]) || !data[1].length) {
      return { timeline: [], detail: [] };
    }
    let status = await agentmanager.checkProcessesStatus(appId, agentId, data[1]);
    if (status.ok) {
      status = status.data;
      const alive = data[1].filter(pid => status[pid]);
      alive.sort();
      const processDataList = await pMap(alive, async pid => {
        return mysql.getLatestProcessData(appId, agentId, pid, moment().format('DD'));
      }, { concurrency: 1 });
      const timeline = processDataList.map(p => {
        if (!p) return { pid: p.pid };
        const upload = p.created_time;
        const uptime = p.uptime;
        const create = moment(upload).subtract(uptime, 'seconds').format('YYYY-MM-DD HH:mm:ss');
        const update = moment(upload).format('YYYY-MM-DD HH:mm:ss');
        return { pid: p.pid, create, update };
      });
      const detail = processDataList.map(p => {
        if (!p) return { pid: p.pid };
        return {
          active_handles: p.active_handles,
          cpu_60: p.cpu_60,
          gc_total: Number((p.gc_time_during_last_min / (60 * 1000) * 100).toFixed(2)),
          rss: p.rss,
          total_timer: p.timer_handles_active,
          total_tcp: p.tcp_handles_active,
          pid: p.pid,
          heap_used: p.heap_used,
          heap_limit: p.heap_limit,
        };
      });
      return { timeline, detail };
    }
    return { timeline: [], detail: [] };
  }
}

module.exports = ProcessService;
