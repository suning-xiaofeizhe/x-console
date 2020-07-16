'use strict';

const moment = require('moment');
const Controller = require('egg').Controller;

class MemberController extends Controller {
  async getMembers() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const appId = ctx.query.appId;
    const user = ctx.user;
    const tasks = [];
    tasks.push(mysql.getAppByAppId(appId));
    tasks.push(mysql.getJoinedMemberByAppId(appId));
    const data = await Promise.all(tasks);
    const ownerInfo = data[0];
    const members = [{
      workId: ownerInfo.owner,
      userName: ownerInfo.owner_name,
      status: 0,
      joinedTime: moment(new Date(ownerInfo.gm_create)).format('YYYY-MM-DD HH:mm:ss'),
      owner: user.ID === ownerInfo.owner ? 1 : 0,
      currentUser: user.ID,
    }].concat(data[1].map(info => {
      return {
        workId: info.work_id,
        userName: info.user_name,
        status: info.status,
        joinedTime: moment(new Date(info.gm_create)).format('YYYY-MM-DD HH:mm:ss'),
        owner: user.ID === ownerInfo.owner ? 1 : 0,
        currentUser: user.ID,
      };
    }));
    ctx.body = { ok: true, data: { list: members } };
  }

  async inviteMember() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const workId = post.workId;
    const ownerInfo = await mysql.getAppByAppId(appId);
    if (ownerInfo.owner === workId) {
      ctx.body = { ok: false, message: '您不能邀请自己！' };
      return;
    }
    try {
      await mysql.inviteMember(appId, workId);
      ctx.body = { ok: true };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        ctx.body = { ok: false, message: `您已经邀请过用户 ${workId} 加入本应用！` };
      }
    }
  }

  async deleteInvitation() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const workId = post.workId;
    await mysql.deleteInvitation(appId, workId);
    ctx.body = { ok: true };
  }

  async updateInvitation() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const user = ctx.user;
    const appId = post.appId;
    const status = post.status;
    if (status === 1) {
      await mysql.deleteInvitation(appId, user.ID);
    } else {
      await mysql.confirmInvitation(appId, user.ID);
    }
    ctx.body = { ok: true };
  }

  async transferOwnerShip() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const workId = post.workId;
    const message = await mysql.transferOwnerShip(workId, appId);
    if (message) {
      ctx.body = { ok: false, message };
    } else {
      ctx.body = { ok: true };
    }
  }

  async deleteMember() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const appId = post.appId;
    const workId = post.workId;
    await mysql.deleteMember(appId, workId);
    ctx.body = { ok: true };
  }

  async leaveTeam() {
    const { ctx, ctx: { service: { mysql } } } = this;
    const post = ctx.request.body;
    const user = ctx.user;
    const appId = post.appId;
    const workId = post.workId;
    if (workId !== user.ID) {
      ctx.body = { ok: false, message: '您只能让自己的账号离开此应用！' };
      return;
    }
    await mysql.deleteMember(appId, workId);
    ctx.body = { ok: true };
  }
}

module.exports = MemberController;
