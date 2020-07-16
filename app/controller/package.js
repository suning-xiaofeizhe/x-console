'use strict';

const pMap = require('p-map');
const moment = require('moment');
const Controller = require('egg').Controller;

class PackageController extends Controller {
  getLockInfo(dependencies, lock) {
    for (const [pkg, info] of Object.entries(dependencies)) {
      lock[pkg] = {
        version: info.version,
        resolved: info.resolved,
      };
    }
  }

  handleAudit(audit, scanTime) {
    // filter actions only effect dev dependencies
    for (const action of audit.actions) {
      action.resolves = action.resolves.filter(resolve => !resolve.dev);
    }
    audit.actions = audit.actions.filter(action => action.resolves.length);

    // re calculate security info
    const validActions = audit.actions;
    const advisories = audit.advisories;
    const result = {};
    for (const validAction of validActions) {
      if (Array.isArray(validAction.resolves)) {
        for (const resolve of validAction.resolves) {
          if (advisories[resolve.id]) {
            const severity = advisories[resolve.id].severity;
            if (result[severity]) {
              result[severity]++;
            } else {
              result[severity] = 1;
            }
          }
        }
      }
    }
    audit.metadata.vulnerabilities = result;

    audit.metadata.scanTime = moment(scanTime).format('YYYY-MM-DD HH:mm:ss');

    return audit;
  }

  async getObjectFromOss(filePath) {
    const { ctx, ctx: { app } } = this;
    try {
      let file = await app.getObjectFromOss(filePath);
      file = JSON.parse(file);
      return file;
    } catch (err) {
      ctx.logger.error(err);
      return null;
    }
  }

  async getAgentPackages() {
    const { ctx, ctx: { service: { mysql } } } = this;

    // get file path in oss
    const query = ctx.query;
    const packages = await mysql.getPackageInfoByAppIdAndAgentId(query.appId, query.agentId);

    const results = [];
    await pMap(packages, async pkg => {
      // get package/lock/audit
      const tasks = [];
      pkg.package_path && tasks.push(this.getObjectFromOss(pkg.package_path));
      pkg.package_lock_path && tasks.push(this.getObjectFromOss(pkg.package_lock_path));
      pkg.security_path && tasks.push(this.getObjectFromOss(pkg.security_path));

      const files = await Promise.all(tasks);

      // compose data from package.json
      const data = {};
      const pkgFile = files[0];
      if (pkgFile) {
        data.name = pkgFile.name;
        data.dependencies = pkgFile.dependencies;
        data.devDependencies = pkgFile.devDependencies;
      }

      // compose data from package-lock.json
      data.lock = {};
      if (files[1]) {
        this.getLockInfo(files[1].dependencies, data.lock);
      }

      // compose data from audit.json
      if (files[2]) {
        data.audit = this.handleAudit(files[2], pkg.gm_modified);
      }

      results.push(data);
    }, { concurrency: 2 });

    ctx.body = { ok: true, data: { packages: results } };
  }
}

module.exports = PackageController;
