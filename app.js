'use strict';

class AppBootHook {

  constructor(app) {
    this.app = app;
  }

  async didReady() {
    const app = this.app;
    app.sessionStore = {
      async get(key) {
        const res = await app.redis.get(key);
        if (!res) return null;
        return JSON.parse(res);
      },
      async set(key, value, maxAge) {
        if (!maxAge) maxAge = 24 * 60 * 60 * 1000;
        value = JSON.stringify(value);
        await app.redis.set(key, value, 'PX', maxAge);
      },
      async destroy(key) {
        await app.redis.del(key);
      },
    };
  }
}

module.exports = AppBootHook;
