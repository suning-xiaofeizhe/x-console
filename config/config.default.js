'use strict';

const fs = require('fs');
const path = require('path');

module.exports = appInfo => {
  return {
    appName: appInfo.name,

    adminIDs: [],

    keys: 'this is x-console, who are you?',

    view: {
      mapping: { '.html': 'ejs' },
    },

    static: {
      gzip: true,
    },

    security: {
      csrf: {
        ignore: ['/file_upload_from_xagent'],
      },
    },

    multipart: {
      fileSize: '4096mb',
      fileExtensions: [
        '.cpuprofile',
        '.heapprofile',
        '.gclog',
        '.heapsnapshot',
        '.diag',
        '.core',
        '.node',
        '.trend',
      ],
      mode: 'file',
    },

    processTrendPeriod: 24,

    creatingFileTimeout: {
      cpuprofile: {
        type: 'profiling',
        timeout: 350,
        profilingTime: 300,
      },
      heapprofile: {
        type: 'profiling',
        timeout: 350,
        profilingTime: 300,
      },
      gclog: {
        type: 'profiling',
        timeout: 350,
        profilingTime: 305,
      },
      heapsnapshot: {
        type: 'immediate',
        timeout: 30,
      },
      diag: {
        type: 'immediate',
        timeout: 30,
      },
    },

    fileTransferTimeout: 20 * 60,

    siteFile: {
      '/favicon.ico': fs.readFileSync(path.join(__dirname, '../app/public/favicon.ico')),
    },

    alarmMessagePeriod: 24,

    uploadFileFromAgentKeyPrefix: 'XCONSOLE_UPLOAD_FILE_FROM_AGENT',

    // TODO: 临时配置（需要开发者定制的逻辑）
    middleware: ['login'],

    profiler: path.join(__dirname, '../profiler'),

    // user config
    mysql: {
      clients: {
        xnpp_dashboard: {
          host: '',
          port: '',
          user: '',
          password: '',
          database: '',
        },
        xnpp_logs: {
          host: '',
          port: '',
          user: '',
          password: '',
          database: '',
        },
      },
      app: true,
      agent: false,
    },

    redis: {
      client: {
        sentinels: [
          {
            port: 26379,
            host: '',
          },
          {
            port: 26379,
            host: '',
          },
          {
            port: 26379,
            host: '',
          },
        ],
        name: '',
        password: '',
        db: 0,
      },
    },

    agentmanager: 'http://127.0.0.1:6543',

    uploadServer: '127.0.0.1:6443',
  };
};
