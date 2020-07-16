'use strict';

const kitx = require('kitx');
const uuid = require('uuid/v4');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');

// TODO: 这里需要开发者实现一个性能分析文件的存储服务
// 能使用 ctx.app.oss 访问到，并且实现三个方法：uploadBigObject(), downloadObject, deleteObject
// 下面的是以本地文件存储模拟 oss 行为，可以参考
const oss = require('./oss');

module.exports = {
  get oss() {
    const { config } = this;
    return { ...oss, config };
  },

  createKey(appName = '') {
    const raw = `${appName}::${uuid()}::${Math.random().toString(16).substr(2)}::${Date.now()}`;
    const secret = kitx.md5(raw, 'hex');
    return secret;
  },

  modifyFileName(name) {
    const res = name.match(/(u-.*-u)-(.*)/);
    if (res) {
      return res[2];
    }
    return name;
  },

  getObjectFromOss(fileName) {
    return new Promise((resolve, reject) => {
      let data = '';
      const stream = this.oss.downloadObject(fileName);
      stream.on('data', chunk => (data += decoder.write(chunk)));
      stream.on('error', err => reject(err));
      stream.on('end', () => {
        data += decoder.end();
        resolve(data);
      });
    });
  },
};
