'use strict';

const Service = require('egg').Service;

class AgentManagerService extends Service {
  async getInfoFromAgentmanager(path, params, value = null, key = null, options = {}) {
    const { ctx, ctx: { logger, app: { config } } } = this;
    const url = `${config.agentmanager}${path}`;
    const res = await ctx.curl(url, Object.assign({ data: params }, options));
    let data = res.data.toString();
    if (res.status !== 200) {
      logger.error(`get agent error log failed with status: ${res.status}, raw message: ${data}`);
      return value;
    }
    try {
      data = JSON.parse(data);
      if (!data.ok) {
        logger.error(data.message);
        return value;
      }
      let res = data.data;
      if (key) {
        res = data.data[key];
      }
      return res;
    } catch (err) {
      logger.error(`JSON parse error: ${err}, raw string: ${data}`);
      return value;
    }
  }

  async getInstanceCount(appId) {
    return this.getInfoFromAgentmanager('/api/front_end/instance_count', { appId },
      '-', 'count');
  }

  async getInstances(appId) {
    return this.getInfoFromAgentmanager('/api/front_end/instances', { appId },
      [], 'list');
  }

  async getProcessList(appId, agentId) {
    return this.getInfoFromAgentmanager('/api/front_end/instance_node_processes', { appId, agentId },
      { xagent: false, processes: [] });
  }

  async getAgentErrorLogFiles(appId, agentId) {
    return this.getInfoFromAgentmanager('/api/front_end/agent_error_log_files', { appId, agentId },
      [], 'errorLogFiles');
  }

  async getAgentErrorLog(appId, agentId, errorLogPath, currentPage, pageSize) {
    return this.getInfoFromAgentmanager('/api/front_end/agent_error_log',
      { appId, agentId, errorLogPath, currentPage, pageSize }, { logs: [], count: 0 });
  }

  async getInfoFromAgent(path, params, method = 'GET', timeout = 15) {
    const { ctx, ctx: { app: { config } } } = this;
    const url = `${config.agentmanager}${path}`;
    const res = await ctx.curl(url, { method, data: params, timeout: timeout * 1000 });
    let data = res.data.toString();
    const raw = data;
    try {
      data = JSON.parse(data);
      if (!data.ok) {
        ctx.logger.error(data.message);
        return data;
      }
      data = data.data;
      if (data.stderr) {
        return { ok: false, message: data.stderr };
      }
      return { ok: true, data: JSON.parse(data.stdout) };
    } catch (err) {
      ctx.logger.error(`JSON parse error: ${err}, raw string: ${raw}`);
      return { ok: false, message: 'Inner server error.' };
    }
  }

  async checkProcessStatus(appId, agentId, pid) {
    return this.getInfoFromAgent('/api/front_end/node_process_status', { appId, agentId, pid });
  }

  async checkProcessesStatus(appId, agentId, pids) {
    return this.getInfoFromAgent('/api/front_end/node_processes_status', { appId, agentId, pids });
  }

  async getOsInfo(appId, agentId) {
    return this.getInfoFromAgent('/api/front_end/os_info', { appId, agentId });
  }

  async takeAction(appId, agentId, pid, action) {
    return this.getInfoFromAgent('/api/front_end/take_action', { appId, agentId, pid, action }, 'POST');
  }

  async checkFile(appId, agentId, file) {
    return this.getInfoFromAgent('/api/front_end/check_file', { appId, agentId, file });
  }

  async transfer(appId, agentId, filePath, uploadServer, token, fileId, fileType) {
    const { ctx: { app: { config } } } = this;
    return this.getInfoFromAgent('/api/front_end/transfer',
      { appId, agentId, filePath, uploadServer, token, fileId, fileType, timeout: config.fileTransferTimeout },
      'POST', config.fileTransferTimeout);
  }
}

module.exports = AgentManagerService;
