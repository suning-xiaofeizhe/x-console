'use strict';

const fs = require('fs');
const promisify = require('util').promisify;
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const path = require('path');

module.exports = {
  async uploadBigObject(fileName, stream) {
    const { config } = this;
    const filePath = path.join(config.profiler, fileName);
    if (!await exists(config.profiler)) {
      await mkdir(config.profiler, { recursive: true });
    }
    if (stream instanceof Buffer) {
      await writeFile(filePath, stream);
      return;
    }
    const writable = fs.createWriteStream(filePath);
    await new Promise(resolve => {
      stream.pipe(writable);
      stream.on('end', resolve);
    });
  },

  downloadObject(fileName) {
    const { config } = this;
    const filePath = path.join(config.profiler, fileName);
    const readable = fs.createReadStream(filePath);
    return readable;
  },

  async deleteObject(fileName) {
    const { config } = this;
    const filePath = path.join(config.profiler, fileName);
    await unlink(filePath);
  },
};
