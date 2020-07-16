'use strict';

const pMap = require('p-map');
const moment = require('moment');
const Service = require('egg').Service;

class MysqlService extends Service {
  getTablesByPeriod(prefix, period) {
    const end = Date.now();
    const start = end - period * 60 * 1000;
    const tables = [];
    let tmp = start;
    while (moment(tmp).startOf('day') < end) {
      tables.push({
        name: `${prefix}${moment(tmp).format('DD')}`,
        start: moment(tmp).format('YYYY-MM-DD HH:mm:ss'),
        end: moment(end).format('YYYYMMDD') === moment(tmp).format('YYYYMMDD') ?
          moment(end).format('YYYY-MM-DD HH:mm:ss') : moment(tmp).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      });
      tmp = moment(tmp).startOf('day').add(1, 'days');
    }
    return tables;
  }

  async addUser(user) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO user (work_id, user_name, mail) VALUES (?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE user_name = ?, mail = ?';
    const params = [user.ID, user.name, user.mail, user.name, user.mail];
    return xnpp_dashboard.query(sql, params);
  }

  async addApp(appName, owner, secret) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('INSERT INTO apps (name, owner, secret) VALUES (?, ?, ?)',
      [appName, owner, secret]).then(data => data.insertId);
  }

  async getAppsByOwnerId(owner) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('SELECT id, name FROM apps WHERE owner = ?',
      [owner]);
  }

  async checkOwnerIdAndAppId(owner, appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('SELECT COUNT(*) AS count FROM apps WHERE owner = ? AND id = ?',
      [owner, appId]).then(data => data[0].count);
  }

  async getAppByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const status = 'FROM apps WHERE id = ?';
    const sql = 'SELECT id, name, secret, owner, user_name AS owner_name, gm_create FROM ' +
      `(SELECT user_name FROM user WHERE work_id = (SELECT owner ${status})) AS t1, `
      + `(SELECT * ${status}) AS t2`;
    const params = [appId, appId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async updateAppNameByAppId(newName, appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('UPDATE apps SET name = ? WHERE id = ?',
      [newName, appId]);
  }

  async deleteAppByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('DELETE FROM apps WHERE id = ?',
      [appId]);
  }

  async inviteMember(appId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('INSERT INTO members (app_id, work_id, status) VALUES (?, ?, ?)',
      [appId, workId, 1]);
  }

  async getJoinedMemberByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const members = await
    xnpp_dashboard.query('SELECT work_id, status, gm_create FROM members WHERE app_id = ?', [appId]);
    return Promise.all(members.map(async function(member) {
      const userName = await
      xnpp_dashboard.query('SELECT user_name FROM user WHERE work_id = ?', [member.work_id])
        .then(data => data[0] && data[0].user_name);
      member.user_name = userName;
      return member;
    }));
  }

  async deleteInvitation(appId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    return xnpp_dashboard.query('DELETE FROM members WHERE app_id = ? AND work_id = ? AND status = 1',
      [appId, workId]);
  }

  async getInvitationApps(workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT id, name, owner FROM apps WHERE id in (' +
      'SELECT app_id FROM members WHERE work_id = ? AND status = 1)';
    const params = [workId];
    return xnpp_dashboard.query(sql, params);
  }

  async confirmInvitation(appId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE members SET status = 2 WHERE app_id = ? AND work_id = ?';
    const params = [appId, workId];
    return xnpp_dashboard.query(sql, params);
  }

  async getJoinedApps(workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT id, name, owner FROM apps WHERE id in (' +
      'SELECT app_id FROM members WHERE work_id = ? AND status = 2)';
    const params = [workId];
    return xnpp_dashboard.query(sql, params);
  }

  async checkMemberShip(workId, appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT app_id FROM members WHERE work_id = ? AND app_id = ? AND status = 2';
    const params = [workId, appId];
    return xnpp_dashboard.query(sql, params);
  }

  async transferOwnerShip(workId, appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const oldOwnerSql = 'SELECT owner FROM apps WHERE id = ?';
    const oldOwnerParams = [appId];
    const oldOwner = await xnpp_dashboard.query(oldOwnerSql, oldOwnerParams).then(data => data[0]);
    if (!oldOwner) {
      return `app ${appId} not exists!`;
    }
    const tasks = [];
    const updateOwnerSql = 'UPDATE apps SET owner = ? WHERE id = ?';
    const updateOwnerParams = [workId, appId];
    tasks.push(xnpp_dashboard.query(updateOwnerSql, updateOwnerParams));
    const updateMemberSql = 'DELETE FROM members WHERE app_id = ? AND work_id = ?';
    const updateMemberParams = [appId, workId];
    tasks.push(xnpp_dashboard.query(updateMemberSql, updateMemberParams));
    const insertMemberSql = 'INSERT INTO members (app_id, work_id, status) VALUES (?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE status = ?';
    const insertMemberParams = [appId, oldOwner.owner, 2, 2];
    tasks.push(xnpp_dashboard.query(insertMemberSql, insertMemberParams));
    await Promise.all(tasks);
    return;
  }

  async deleteMembersByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM members WHERE app_id = ?';
    const params = [appId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteMember(appId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM members WHERE app_id = ? AND work_id = ?';
    const params = [appId, workId];
    return xnpp_dashboard.query(sql, params);
  }

  async addActivity(appId, agentId, fileType, fileName, filePath, workId, status) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO activity (app_id, agent_id, file_type, filename, path, work_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [appId, agentId, fileType, fileName, filePath, workId, status];
    return xnpp_dashboard.query(sql, params);
  }

  async updateActivityStatusById(fileId, status, path = '') {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE activity SET status = ?, path = ? WHERE id = ?';
    const params = [status, path, fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async updateActivityToken(fileId, token) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE activity SET token = ? WHERE id = ?';
    const params = [token, fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async addCoredump(appId, agentId, fileName, filePath, workId, status, uuid) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO coredump (app_id, agent_id, core_filename, core_path, work_id, status, uuid) '
      + ' VALUES (?, ?, ?, ?, ?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE core_filename = ?, core_path = ?, status = ?';
    const params = [appId, agentId, fileName, filePath, workId, status, uuid, fileName, filePath, status];
    return xnpp_dashboard.query(sql, params);
  }

  async addExecutable(appId, agentId, fileName, fileType, workId, uuid) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO coredump (app_id, agent_id, executable_filename, executable_type, work_id, uuid) '
      + ' VALUES (?, ?, ?, ?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE executable_filename = ?, executable_type = ?';
    const params = [appId, agentId, fileName, fileType, workId, uuid, fileName, fileType];
    return xnpp_dashboard.query(sql, params);
  }

  async updateCoredumpStatusById(fileId, status, path = '') {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE coredump SET status = ?, core_path = ? WHERE id = ?';
    const params = [status, path, fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async updateCoredumpToken(fileId, token) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE coredump SET token = ? WHERE id = ?';
    const params = [token, fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteActivityByAppId(appId) {
    const { ctx: { app: { mysql }, service: { oss } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    // delete oss file
    const files = await xnpp_dashboard.query('SELECT filename FROM activity WHERE app_id = ?', [appId]);
    await pMap(files, async file => {
      if (file.path) {
        await oss.deleteOssFile(file.path);
      }
    }, { concurrency: 5 });
    // delete mysql
    const sql = 'DELETE FROM activity WHERE app_id = ?';
    const params = [appId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteCoredumpByAppId(appId) {
    const { ctx: { app: { mysql }, service: { oss } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    // delete oss file
    const data = await xnpp_dashboard.query('SELECT core_filename, executable_filename, executable_type FROM coredump WHERE app_id = ?', [appId]);
    const files = [];
    for (const d of data) {
      if (d.core_path) {
        files.push(d.core_path);
      }
      if (d.executable_type === 0) {
        files.push(d.executable_filename);
      }
    }
    await pMap(files, async file => {
      await oss.deleteOssFile(file);
    }, { concurrency: 5 });
    // delete mysql
    const sql = 'DELETE FROM coredump WHERE app_id = ?';
    const params = [appId];
    return xnpp_dashboard.query(sql, params);
  }

  async getActivitiesByAppId(appId, filterType) {
    if (!['all', 'cpuprofile', 'heapprofile', 'gclog', 'heapsnapshot', 'diag', 'trend', 'favor'].includes(filterType)) {
      return [];
    }
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    let sql = 'SELECT * FROM activity WHERE app_id = ?';
    const params = [appId];
    if (filterType === 'favor') {
      sql += ' AND favor = ?';
      params.push(1);
    } else if (filterType !== 'all') {
      sql += ' AND file_type = ?';
      params.push(filterType);
    }
    return xnpp_dashboard.query(sql, params);
  }

  async getCoredumpsByAppId(appId, filterType) {
    if (!['all', 'core', 'favor'].includes(filterType)) {
      return [];
    }
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    let sql = 'SELECT * FROM coredump WHERE app_id = ?';
    const params = [appId];
    if (filterType === 'favor') {
      sql += ' AND favor = ?';
      params.push(1);
    }
    return xnpp_dashboard.query(sql, params);
  }

  async getUserInfoById(workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM user WHERE work_id = ?';
    const params = [workId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async getUserInfoByIds(workIds) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const queries = workIds.map(() => '?').join(', ');
    const sql = `SELECT * FROM user WHERE work_id in (${queries})`;
    const params = [...workIds];
    return xnpp_dashboard.query(sql, params);
  }

  async getActivityById(fileId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM activity WHERE id = ?';
    const params = [fileId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async getCoredumpById(fileId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM coredump WHERE id = ?';
    const params = [fileId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async updateActivityFavorStatusById(fileId, favor) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE activity SET favor = ? WHERE id = ?';
    const params = [favor, fileId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async updateCoredumpFavorStatusById(fileId, favor) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE coredump SET favor = ? WHERE id = ?';
    const params = [favor, fileId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async deleteActivityByFileId(fileId) {
    const { ctx: { app: { mysql }, service: { oss, mysql: mysqlService } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    // delete oss file
    const activity = await mysqlService.getActivityById(fileId);
    if (!activity) {
      return;
    }
    if (activity.path) {
      await oss.deleteOssFile(activity.path);
    }
    // delete mysql
    const sql = 'DELETE FROM activity WHERE id = ?';
    const params = [fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteCoredumpByFileId(fileId) {
    const { ctx: { app: { mysql }, service: { oss, mysql: mysqlService } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    // delete oss file
    const coredump = await mysqlService.getCoredumpById(fileId);
    if (!coredump) {
      return;
    }
    const tasks = [];
    if (coredump.core_path) {
      tasks.push(oss.deleteOssFile(coredump.core_path));
    }
    if (coredump.executable_type === 0) {
      tasks.push(oss.deleteOssFile(coredump.executable_filename));
    }
    await Promise.all(tasks);
    // delete mysql
    const sql = 'DELETE FROM coredump WHERE id = ?';
    const params = [fileId];
    return xnpp_dashboard.query(sql, params);
  }

  async getDistinctPidByPeriod(appId, agentId, date, start, end) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const sql = `SELECT DISTINCT pid FROM process_${date} WHERE app_id = ? AND agent_id = ? ` +
      'AND created_time >= ? AND created_time <= ?';
    const params = [appId, agentId, start, end];
    try {
      const list = await xnpp_logs.query(sql, params);
      return list;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw err;
    }
  }

  async getLatestProcessData(appId, agentId, pid, date) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const sql = `SELECT * FROM process_${date} WHERE app_id = ? AND agent_id = ? AND pid = ? AND `
      + `created_time = (SELECT MAX(created_time) AS latest_created FROM process_${date} WHERE `
      + 'app_id = ? AND agent_id = ? AND pid = ? GROUP BY app_id, agent_id, pid)';
    const params = [appId, agentId, pid, appId, agentId, pid];
    return xnpp_logs.query(sql, params).then(data => data[0]);
  }

  async getProcessDataByAgentIdAndPid(table, appId, agentId, pid, start, end) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const sql = `SELECT * FROM ${table} WHERE app_id =? AND agent_id = ? AND pid = ? ` +
      'AND created_time >= ? AND created_time <= ?';
    const params = [appId, agentId, pid, start, end];
    try {
      const list = await xnpp_logs.query(sql, params);
      return list;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw err;
    }
  }

  async getStrategiesByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM strategies WHERE app_id = ?';
    const params = [appId];
    return xnpp_dashboard.query(sql, params);
  }

  async getStrategyById(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM strategies WHERE id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async addStrategy(appId, contextType, pushType, dsl, expr) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO strategies (app_id, context_type, push_type, dsl, expr) VALUES ' +
      '(?, ?, ?, ?, ?)';
    const params = [appId, contextType, pushType, dsl, expr];
    return xnpp_dashboard.query(sql, params);
  }

  async updateStrategy(strategyId, contextType, pushType, dsl, expr) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE strategies SET context_type = ?, push_type = ?, dsl = ?, expr = ? ' +
      'WHERE id = ?';
    const params = [contextType, pushType, dsl, expr, strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteStrategy(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM strategies WHERE id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async updateStrategyStatus(strategyId, status) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE strategies SET status = ? WHERE id = ?';
    const params = [status, strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async getAlarmMessageByStrategyId(table, ids, start, end) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const sql = `SELECT * FROM ${table} WHERE strategy_id IN (?) AND ` +
      'gm_create >= ? AND gm_create < ? ORDER BY gm_create DESC';
    const params = [ids, start, end];
    try {
      const list = await xnpp_logs.query(sql, params);
      return list;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw err;
    }
  }

  async getStrategySettedMembers(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM strategy_members WHERE strategy_id = ?';
    const params = [strategyId];
    const members = await xnpp_dashboard.query(sql, params);
    await pMap(members, async member => {
      const userName = await
      xnpp_dashboard.query('SELECT user_name FROM user WHERE work_id = ?', [member.work_id])
        .then(data => data[0] && data[0].user_name);
      member.user_name = userName;
    }, { concurrency: 5 });
    return members;
  }

  async addStrategyMember(strategyId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO strategy_members (strategy_id, work_id) VALUES (?, ?)';
    const params = [strategyId, workId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteStrategyMember(strategyId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM strategy_members WHERE strategy_id = ? AND work_id = ?';
    const params = [strategyId, workId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteStrategyAndMembersByAppId(appId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql1 = 'DELETE FROM strategy_members WHERE strategy_id in ' +
      '(SELECT id FROM strategies WHERE app_id = ?)';
    const params1 = [appId];
    await xnpp_dashboard.query(sql1, params1);
    const sql2 = 'DELETE FROM strategies WHERE app_id = ?';
    const params2 = [appId];
    await xnpp_dashboard.query(sql2, params2);
  }

  async getPackageInfoByAppIdAndAgentId(appId, agentId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM package WHERE app_id = ? AND agent_id = ?';
    const params = [appId, agentId];
    return xnpp_dashboard.query(sql, params);
  }

  async getOsinfoOverviewByAppIdAndAgentId(appId, agentId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const table = `osinfo_${moment().format('DD')}`;
    const lastSql = `SELECT MAX(created_time) FROM ${table} WHERE app_id = ? AND agent_id = ?`;
    const sql = `SELECT * FROM ${table} WHERE created_time = (${lastSql}) AND app_id = ? AND agent_id = ?`;
    const params = [appId, agentId, appId, agentId];
    return xnpp_logs.query(sql, params).then(data => {
      if (data.length === 0) return null;

      if (data.length === 1) return data[0];

      if (new Date(data[0].created_time).getTime() === new Date(data[1].created_time).getTime()) {
        return Object.assign({}, data[0], data[1]);
      }

      return data[0];
    });
  }

  async getOsinfoDetailByAppIdAndAgentId(table, appId, agentId, start, end) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_logs = mysql.get('xnpp_logs');
    const sql = `SELECT * FROM ${table} WHERE app_id = ? AND agent_id = ? ` +
      'AND created_time >= ? AND created_time <= ?';
    const params = [appId, agentId, start, end];
    return xnpp_logs.query(sql, params);
  }

  async getSummary() {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql1 = 'SELECT * FROM apps ORDER BY gm_create desc';
    const apps = await xnpp_dashboard.query(sql1);
    const members = await xnpp_dashboard.query('SELECT * FROM members ORDER BY gm_create desc');
    const users = await xnpp_dashboard.query('SELECT * FROM user ORDER BY gm_create desc');
    return { apps, members, users };
  }

  async getGlobalStrategies() {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM global_strategies';
    return xnpp_dashboard.query(sql);
  }

  async addGlobalStrategy(contextType, pushType, dsl, expr) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO global_strategies (app_id, context_type, push_type, dsl, expr) VALUES ' +
      '(?, ?, ?, ?, ?)';
    const params = [99999, contextType, pushType, dsl, expr];
    return xnpp_dashboard.query(sql, params);
  }

  async updateGlobalStrategy(strategyId, contextType, pushType, dsl, expr) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE global_strategies SET context_type = ?, push_type = ?, dsl = ?, expr = ? ' +
      'WHERE id = ?';
    const params = [contextType, pushType, dsl, expr, strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteGlobalStrategy(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM global_strategies WHERE id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async updateGlobalStrategyStatus(strategyId, status) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'UPDATE global_strategies SET status = ? WHERE id = ?';
    const params = [status, strategyId];
    return xnpp_dashboard.query(sql, params);
  }

  async getGlobalStrategyById(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM global_strategies WHERE id = ?';
    const params = [strategyId];
    return xnpp_dashboard.query(sql, params).then(data => data[0]);
  }

  async getGlobalStrategySettedMembers(strategyId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'SELECT * FROM global_strategy_members WHERE strategy_id = ?';
    const params = [strategyId];
    const members = await xnpp_dashboard.query(sql, params);
    await pMap(members, async member => {
      const userName = await
      xnpp_dashboard.query('SELECT user_name FROM user WHERE work_id = ?', [member.work_id])
        .then(data => data[0] && data[0].user_name);
      member.user_name = userName;
    }, { concurrency: 5 });
    return members;
  }

  async addGlobalStrategyMember(strategyId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'INSERT INTO global_strategy_members (strategy_id, work_id) VALUES (?, ?)';
    const params = [strategyId, workId];
    return xnpp_dashboard.query(sql, params);
  }

  async deleteGlobalStrategyMember(strategyId, workId) {
    const { ctx: { app: { mysql } } } = this;
    const xnpp_dashboard = mysql.get('xnpp_dashboard');
    const sql = 'DELETE FROM global_strategy_members WHERE strategy_id = ? AND work_id = ?';
    const params = [strategyId, workId];
    return xnpp_dashboard.query(sql, params);
  }
}

module.exports = MysqlService;
