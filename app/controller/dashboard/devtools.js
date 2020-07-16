'use strict';

const Controller = require('egg').Controller;

class DevtoolsController extends Controller {
  async index() {
    const { ctx } = this;
    await ctx.render('devtools/index');
  }

  async proxyImages() {
    const { ctx } = this;
    const { dir, file } = ctx.params;
    if (!file) {
      ctx.redirect(`/public/devtools/Images/${dir}`);
    } else {
      ctx.redirect(`/public/devtools/Images/${dir}/${file}`);
    }
  }
}

module.exports = DevtoolsController;
