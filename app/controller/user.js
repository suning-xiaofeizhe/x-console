'use strict';

const Controller = require('egg').Controller;

class UserController extends Controller {
  async info() {
    const { ctx } = this;
    const user = ctx.user;
    const data = {
      id: user.ID,
      name: user.name,
    };
    ctx.body = { ok: true, data };
  }
}

module.exports = UserController;
