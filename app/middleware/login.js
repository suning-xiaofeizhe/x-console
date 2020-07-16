'use strict';

module.exports = () => {
  // TODO: 这里需要开发者定制登录逻辑，返回 ID 和 name 即可
  // 其中 ID 为用户的唯一标识
  return async function (ctx, next) {
    ctx.user = { ID: '123456', name: 'hyj1991', mail: 'yeekwanvong@gmail.com' };
    await next();
  };
};
