'use strict';

module.exports = app => {
  const { router } = app;
  const {
    userRequired,
    appOwnerRequired,
    appMemberRequired,
    activityRequired,
    strategyRequired,
    appStrategyRequired,
    appAgentRequired,
    adminRequired,
  } = app.middlewares.auth({}, app);

  // dashboard
  // home page
  router.get('/', userRequired, 'dashboard.home.index');
  // devtools
  router.get('/dashboard/devtools', userRequired, activityRequired, 'dashboard.devtools.index');
  router.get('/dashboard/Images/:dir/:file?', 'dashboard.devtools.proxyImages');

  // api
  // user
  router.get('/api/user', userRequired, 'user.info');

  // application
  router.post('/api/application', userRequired, 'app.create');
  router.get('/api/application', userRequired, appMemberRequired, 'app.getAppInfo');
  router.get('/api/apps', userRequired, 'app.getApps');
  router.get('/api/app/instance_count', userRequired, appMemberRequired, 'app.getInstanceCount');
  router.get('/api/app/alarm_count', userRequired, appMemberRequired, 'app.getAlarmCount');
  router.get('/api/app/cpu_overview', userRequired, appMemberRequired, 'app.getCpuUsageOverview');
  router.get('/api/app/memory_overview', userRequired, appMemberRequired, 'app.getMemoryUsageOverview');

  // settings
  router.get('/api/app/info', userRequired, appOwnerRequired, 'app.getAppSecret');
  router.post('/api/app/name', userRequired, appOwnerRequired, 'setting.modifyAppName');
  router.delete('/api/application', userRequired, appOwnerRequired, 'setting.deleteApp');

  // member
  router.get('/api/members', userRequired, appMemberRequired, 'member.getMembers');
  router.post('/api/member/invitation', userRequired, appMemberRequired, 'member.inviteMember');
  router.delete('/api/member/invitation', userRequired, appMemberRequired, 'member.deleteInvitation');
  router.put('/api/member/invitation', userRequired, 'member.updateInvitation');
  router.post('/api/member/ownership', userRequired, appOwnerRequired, 'member.transferOwnerShip');
  router.delete('/api/team/member', userRequired, appOwnerRequired, 'member.deleteMember');
  router.delete('/api/member', userRequired, appMemberRequired, 'member.leaveTeam');

  // alarm
  router.get('/api/alarm/strategies', userRequired, appMemberRequired, 'alarm.getStrategies');
  router.post('/api/alarm/strategy', userRequired, appMemberRequired, 'alarm.addStrategy');
  router.put('/api/alarm/strategy', userRequired, appMemberRequired, strategyRequired, 'alarm.updateStrategy');
  router.delete('/api/alarm/strategy', userRequired, appMemberRequired, strategyRequired, 'alarm.deleteStrategy');
  router.put('/api/alarm/strategy_status', userRequired, appMemberRequired, strategyRequired, 'alarm.updateStrategyStatus');
  router.get('/api/alarm/list', userRequired, appMemberRequired, appStrategyRequired, 'alarm.getAlarmList');
  router.get('/api/alarm/member_list', userRequired, appMemberRequired, appStrategyRequired, 'alarm.getMember');
  router.put('/api/alarm/member', userRequired, appMemberRequired, strategyRequired, 'alarm.addStrategyMember');
  router.delete('/api/alarm/member', userRequired, appMemberRequired, strategyRequired, 'alarm.deleteStrategyMember');

  // file from console
  router.post('/api/upload2oss', userRequired, appMemberRequired, 'oss.uploadFromConsole');
  router.get('/file/download', userRequired, activityRequired, 'oss.downloadToConsole');

  // file from xagent
  router.post('/file_upload_from_xagent', 'oss.uploadFromXagent');

  // file manager
  router.get('/api/file_list', userRequired, appMemberRequired, 'file.getFileList');
  router.post('/api/file_favor', userRequired, activityRequired, 'file.favor');
  router.delete('/api/file', userRequired, activityRequired, 'file.delete');
  router.post('/api/file_transfer', userRequired, activityRequired, 'file.transfer');

  // file analytics
  router.get('/api/file_detail', userRequired, activityRequired, 'file.getDetail');

  // agent
  // process
  router.get('/api/app/agent_list', userRequired, appMemberRequired, 'agent.getAgentList');
  router.get('/api/app/agent_detail', userRequired, appMemberRequired, 'agent.getAgentDetail');
  router.get('/api/app/agent_process', userRequired, appMemberRequired, 'agent.getProcessList');
  router.get('/api/app/agent_process_status', userRequired, appMemberRequired, 'agent.checkProcessStatus');
  router.get('/api/app/agent_info', userRequired, appMemberRequired, 'agent.getOsInfo');
  router.post('/api/app/agent_take_action', userRequired, appMemberRequired, 'agent.takeAction');
  // process detail
  router.get('/api/agent/process_detail', userRequired, appMemberRequired, appAgentRequired, 'detail.getProcessDetail');
  // system info
  router.get('/api/app/agent_osinfo_overview', userRequired, appMemberRequired, appAgentRequired, 'osinfo.overview');
  router.get('/api/app/agent_osinfo_detail', userRequired, appMemberRequired, appAgentRequired, 'osinfo.detail');
  // error logs
  router.get('/api/app/agent_error_log_files', userRequired, appMemberRequired, appAgentRequired, 'log.getAgentErrorLogFiles');
  router.get('/api/app/agent_error_log', userRequired, appMemberRequired, appAgentRequired, 'log.getAgentErrorLog');
  // package
  router.get('/api/app/agent_packages', userRequired, appMemberRequired, appAgentRequired, 'package.getAgentPackages');

  // docs
  app.redirect('/public/docs/xnpp', '/public/docs/xnpp/index.html');

  // admin
  router.get('/api/admin/summary', userRequired, adminRequired, 'admin.getSummary');
  // admin alarm
  router.get('/api/alarm/global_strategies', userRequired, adminRequired, 'admin.alarm.getStrategies');
  router.post('/api/alarm/global_strategy', userRequired, adminRequired, 'admin.alarm.addStrategy');
  router.put('/api/alarm/global_strategy', userRequired, adminRequired, 'admin.alarm.updateStrategy');
  router.delete('/api/alarm/global_strategy', userRequired, adminRequired, 'admin.alarm.deleteStrategy');
  router.put('/api/alarm/global_strategy_status', userRequired, adminRequired, 'admin.alarm.updateStrategyStatus');
  router.get('/api/alarm/global_list', userRequired, adminRequired, 'admin.alarm.getAlarmList');
  router.get('/api/alarm/global_member_list', userRequired, adminRequired, 'admin.alarm.getMember');
  router.put('/api/alarm/global_member', userRequired, adminRequired, 'admin.alarm.addStrategyMember');
  router.delete('/api/alarm/global_member', userRequired, adminRequired, 'admin.alarm.deleteStrategyMember');
};
