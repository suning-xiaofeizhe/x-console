'use strict';

const path = require('path');
const egg = require('egg');

egg.startCluster({
  workers: 4,
  baseDir: path.join(__dirname, '..'),
  port: 3000
});
