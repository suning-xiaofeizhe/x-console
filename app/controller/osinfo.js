'use strict';

const pMap = require('p-map');
const moment = require('moment');
const Controller = require('egg').Controller;

class OsinfoController extends Controller {
  async overview() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const query = ctx.query;
    const appId = query.appId;
    const agentId = query.agentId;
    const nowData = await mysql.getOsinfoOverviewByAppIdAndAgentId(appId, agentId);
    if (!nowData) {
      ctx.body = { ok: true, data: false };
      return;
    }

    const cpuUsage = nowData.used_cpu || 0;
    const memUsage = nowData.totalmem ? (nowData.totalmem - nowData.freemem) / nowData.totalmem : 0;

    const disks = nowData.disks || '';
    let diskUsage = 0;
    let diskMounted = '';
    for (const disk of disks.split('\u0000')) {
      let [mounted, usage] = disk.split('::');
      usage = Number(usage);
      if (usage > diskUsage) {
        diskUsage = usage;
        diskMounted = mounted;
      }
    }

    ctx.body = { ok: true, data: { cpuUsage, memUsage, diskUsage: diskUsage / 100, diskMounted } };
  }

  async detail() {
    const { ctx, ctx: { service: { mysql, detail } } } = this;
    const query = ctx.query;
    const appId = query.appId;
    const agentId = query.agentId;

    // get 24h data
    const period = 24 * 60;
    const tables = mysql.getTablesByPeriod('osinfo_', period);
    let rawData = [];
    await pMap(tables, async table => {
      const detailData = await mysql.getOsinfoDetailByAppIdAndAgentId(table.name, appId, agentId, table.start, table.end);
      rawData = rawData.concat(detailData);
    }, { concurrency: 1 });

    // os cpu
    const cpuTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        os_cpu: data.used_cpu ? Number((data.used_cpu * 100).toFixed(2)) : 0,
      };
    });

    // os memory
    let totalMem = 0;
    const memTrend = rawData.map(data => {
      const os_mem = data.totalmem && data.freemem ?
        Number(((data.totalmem - data.freemem) / data.totalmem * 100).toFixed(2)) : 0;
      if (data.totalmem > totalMem) {
        totalMem = data.totalmem;
      }
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        os_mem,
      };
    });

    // os qps
    let qpsTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        qps: data.http_response_sent ? Number((data.http_response_sent / 60).toFixed(1)) : 0,
      };
    });
    const tmpQpsMap = {};
    for (const qps of qpsTrend) {
      if (tmpQpsMap[qps.min]) {
        tmpQpsMap[qps.min] += Number(qps.qps);
      } else {
        tmpQpsMap[qps.min] = Number(qps.qps);
      }
    }
    qpsTrend = Object.entries(tmpQpsMap).map(([min, qps]) => {
      return { min, qps };
    });

    // os http response status
    const responseTrend = [];
    const responseFields = [];
    const responseFieldFlags = {};
    for (const data of rawData) {
      try {
        const responses = JSON.parse(data.http_response_code_map);
        const trend = { min: moment(data.created_time).format('YYYY-MM-DD HH:mm') };
        for (const [code, count] of Object.entries(responses)) {
          if (!responseFieldFlags[code]) {
            responseFields.push(code);
            responseFieldFlags[code] = true;
          }
          // set usage
          trend[code] = count ? Number(count) : 0;
        }
        responseTrend.push(trend);
      } catch (err) {
        err;
      }
    }

    // os http rt
    let rtTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        rt: data.http_rt ? Number(data.http_rt) : 0,
      };
    });
    const tmpRtMap = {};
    for (const rt of rtTrend) {
      if (tmpRtMap[rt.min]) {
        tmpRtMap[rt.min] += Number(rt.rt);
      } else {
        tmpRtMap[rt.min] = Number(rt.rt);
      }
    }
    rtTrend = Object.entries(tmpRtMap).map(([min, rt]) => {
      return { min, rt };
    });

    // os http timeout
    let expiredTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        expired_count: data.http_request_timeout ? Number(data.http_request_timeout) : 0,
      };
    });
    const tmpExpiredMap = {};
    for (const expired of expiredTrend) {
      if (tmpExpiredMap[expired.min]) {
        tmpExpiredMap[expired.min] += Number(expired.expired_count);
      } else {
        tmpExpiredMap[expired.min] = Number(expired.expired_count);
      }
    }
    expiredTrend = Object.entries(tmpExpiredMap).map(([min, expired_count]) => {
      return { min, expired_count };
    });

    // os load status
    const loadTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        load1: data.load1 ? Number(data.load1.toFixed(2)) : 0,
        load5: data.load5 ? Number(data.load5.toFixed(2)) : 0,
        load15: data.load15 ? Number(data.load15.toFixed(2)) : 0,
      };
    });

    // node process count
    const nodeTrend = rawData.map(data => {
      return {
        min: moment(data.created_time).format('YYYY-MM-DD HH:mm'),
        node_count: data.node_count ? Number(data.node_count) : 0,
      };
    });

    // disks
    const diskTrend = [];
    const diskFields = [];
    const diskFieldFlags = {};
    for (const data of rawData) {
      const disks = data.disks.split('\u0000');
      const trend = { min: moment(data.created_time).format('YYYY-MM-DD HH:mm') };
      for (const disk of disks) {
        const [mounted, usage] = disk.split('::');
        // set mounted
        if (!diskFieldFlags[mounted]) {
          diskFields.push(mounted);
          diskFieldFlags[mounted] = true;
        }
        // set usage
        trend[mounted] = usage ? Number(usage) : 0;
      }
      diskTrend.push(trend);
    }

    ctx.body = {
      ok: true, data: {
        cpuTrend: cpuTrend.length ? detail.makeupTime(cpuTrend, period) : [],
        memTrend: memTrend.length ? detail.makeupTime(memTrend, period) : [],
        qpsTrend: qpsTrend.length ? detail.makeupTime(qpsTrend, period) : [],
        rtTrend: rtTrend.length ? detail.makeupTime(rtTrend, period) : [],
        expiredTrend: expiredTrend.length ? detail.makeupTime(expiredTrend, period) : [],
        responseTrend: responseTrend.length ? detail.makeupTime(responseTrend, period) : [],
        loadTrend: loadTrend.length ? detail.makeupTime(loadTrend, period) : [],
        nodeTrend: nodeTrend.length ? detail.makeupTime(nodeTrend, period) : [],
        diskTrend: diskTrend.length ? detail.makeupTime(diskTrend, period) : [],
        totalMem, diskFields, responseFields,
      },
    };
  }
}

module.exports = OsinfoController;
