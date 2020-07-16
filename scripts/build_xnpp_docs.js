'use strict';

const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function exec(cmd) {
  console.log(`\x1b[33;1mexecute: ${cmd}\x1b[0m`);
  cp.execSync(cmd, {
    stdio: 'inherit',
    cwd: path.dirname(__dirname),
    env: process.env,
  });
}

// build docs
exec('vuepress build docs');

// copy assets
const distPublic = path.join(__dirname, '../app/public/docs/xnpp');
if (!fs.existsSync(distPublic)) {
  fs.mkdirSync(distPublic, { recursive: true });
}
const distVuepressAssets = path.join(__dirname, '../docs/.vuepress/dist/');
exec(`rm -rf ${distPublic}/*`);
exec(`cp -rf ${distVuepressAssets}/* ${distPublic}`);

console.log('done.');
