# 快速开始

XNPP 整个项目由服务端和客户端两部分组成，您需要首先完成部署 XNPP 的服务端项目，然后在项目中嵌入 `xprofiler` 并启动 `xagent` 即可完成整个流程。

## I. 部署服务端

XNPP 服务端由三个项目组成：

* 控制台: [x-console](https://github.com/suning-xiaofeizhe/x-console)
* agent 管理服务: [x-agentmanager](https://github.com/suning-xiaofeizhe/x-agentmanager)
* agent 长连接服务: [x-agentserver](https://github.com/suning-xiaofeizhe/x-agentserver)

开发模式下，我们只需分别进入三个项目的目录下执行 `npm run dev` 即可完成开发模式下的服务启动，而对于线上部署，则需要在发布服务的脚本中执行 `npm run app`。

:::tip 访问控制台
三个服务启动完毕后，本地访问 `http://127.0.0.1:6443` 即可进入控制台首页。

线上发布后端口为 `3000`，请配置好对应的 nginx 反向代理。
:::

### 1. 定义您的登录模块

因为每家公司基本都会自己的域账号管理系统（一般使用工号进行单点登录），所以 XNPP 不额外提供独立的账号模块，但是为了大家能快速跑起来这个项目，我们在 `x-console` 项目下写死了一个用户:

```js
// x-console/app/middleware/login.js
'use strict';

module.exports = () => {
  // TODO: 这里需要开发者定制登录逻辑，返回 ID 和 name 即可
  // 其中 ID 为用户的唯一标识
  return async function (ctx, next) {
    ctx.user = { ID: '123456', name: 'hyj1991', mail: 'yeekwanvong@gmail.com' };
    await next();
  };
};
```

您需要按照您公司的实际情况编写单点登录的 egg-plugin，并且将 `ID` (一般是工号)，`name` (一般是您的名字/花名), `mail` (用户告警通知邮箱，可选) 这三个字段按照上述例子中的要求写入 `ctx.user` 中。

### 2. 定义文件存储模块

因为 XNPP 实时 dump 的一些性能分析文件普遍比较大，所以不适合存储进入数据库等模块，因此这里需要专门的文件存储服务（比如 OSS），这样一来对于本项目就不太适合绑定某个特别的文件存储产品。

因此我们在 `x-console` 下写了一个简单的本地文件存储逻辑：

```js
// x-console/app/extend/application.js
const oss = require('./oss');

module.exports = {
  get oss() {
    const { config } = this;
    return { ...oss, config };
  },
};
```

这里的 oss 的逻辑为：

```js
// x-console/app/extend/oss.js
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
```

实际上就是简单实现了一个本地文件存储，您需要结合您公司的实际情况编写 egg-plugin 替换掉这个模块，核心是实现一个绑定在 `app` 上的全局 `oss client`，其包含如下三个文件处理方法即可：
* **uploadBigObject(fileName, stream):** 上传文件
  * fileName: `[String]` 文件名称
  * stream: `[Stream|Buffer]` 上传的文件信息
* **downloadObject(fileName):** 下载文件
  * fileName: `[String]` 文件名称
* **deleteObject(fileName):** 删除文件
  * fileName: `[String]` 文件名称

:::warning
`x-console` 默认自带的本地文件存储逻辑只能将文件存储在部署 `x-console` 的机器本地，所以如果您是多机部署，这个自带的简单的本地文件存储服务会存在存储的性能文件分散在各个机器上导致访问出错的问题。
:::

### 3. 定义邮件告警模块

因为每家公司的内部邮箱拼接规则不一致，因此 XNPP 只能提供一个通用的方法来描述邮件告警逻辑：即将用户信息中包含联系此用户的邮箱，并且记录到 `user` 表中以供触发告警规则时通知用户

```js
// x-agentmanager/app/service/mail.js
async alarm(...args) {
  const { ctx: { service: { mail, alarm, mysql } } } = this;
  const results = await alarm.shouldSendMessage(...args);
  if (results) {
    const groupResults = results.groupResults;
    const contacts = results.contacts;
    const tolist = await pMap(contacts, async ({ work_id }) => {
      const user = await mysql.getUserInfoById(work_id);
      if (user) {
        return user.mail;
      }
      return null;
    }, { concurrency: 2 });
    await mail.sendMessage(groupResults, {
      tolist: tolist.filter(mail => mail),
    });
  }
}
```

这里对 `tolist` 获取告警联系人邮箱列表的逻辑需要您根据实际情况进行修改，这里的逻辑仅供参考。

:::tip 更多告警模式
实际上除了公司邮箱外，XNPP 也支持扩展更多告警模式，比如钉钉告警，豆芽告警等。

`x-agentmanager/app/service/alarm.js` 抽象了公共方法 `shouldSendMessage`，它返回了：
* 是否需要发送告警信息
* 如果需要发送，对应的告警信息内容

您仅需实现其他告警模式发送信息的 SDK 接入即可。
:::

完成了 XNPP 服务端的部署后，我们接来下就需要处理 `xprofiler` 插件的接入和 `xagent` 日志采集器的启动了。

## II. 接入 xprofiler

在项目根目录下执行如下代码安装 `xprofiler` 插件:

```bash
npm install xprofiler --save --xprofiler_binary_host_mirror=https://npm.taobao.org/mirrors/xprofiler
```

然后在您的项目的入口 `js` 文件 **顶部** 加上如下代码即可:

```js
require('xprofiler').start();
```

插件至此就已经部署完毕，`xprofiler` 主要负责定时输出内核性能分析数据，并且在收到控制信令时执行相关的 Profiling 或者 Snapchat 操作。

如果您使用的是 `Egg.js`，需要在 `app.js` 和 `agent.js` 的顶部分别写入上述启动代码。

::: tip Node.js 版本依赖
目前 `xprofiler` 插件支持的 Node.js 版本需要 <span style="color:#ed4014">>= v8.x</span>
:::

## III. 部署 xagent

`xagent` 主要负责定时采集上面插件生成的日志，与中转控制台发送的控制信令，它的启动与部署需要一些配置参数。

### 1. 获取 AppID / AppSecret

XNPP 服务端部署完成后，可以点击 XNPP 控制台来登录，然后点击 XNPP 平台首页右上角的 `控制台` 按钮进入控制台：

<img :src="$withBase('/create.png')" alt="create">

进入控制台后，点击上图中右上角的 `创建新应用` 按钮来创建应用，在弹出的 Modal 框中输入您的应用名称，最后点击 `提交` 即可。创建应用成功后，我们会看到一个应用的信息弹框：

<div style="text-align:center">
  <img :src="$withBase('/created.png')" alt="created" style="height:200px;">
</div>

将图中的 `应用 ID` 与 `应用 Secret` 记录下来备用，至此启动 xagent 所需要的主要参数已经获取到了。

:::tip 启动 xagent
我们需要将 xagent 在主进程之外进行独立部署，且 **一个应用只需要启动一个** xagent 即可，因此它的使用方式有别于大家常见的普通的 Npm 模块。
:::

### 2.1 启动 xagent (推荐 Egg.js)

如果您的应用基于 [Egg.js](https://eggjs.org/) 开发，因为 Egg 框架采用了比较先进的 Node.js 服务框架设计模式：

* 多个 `cluster app worker` 负责业务逻辑
* 单个 `agent worker` 负责单点任务调度等

因此我们只需要将 `xagent` 放入 Egg 的 `agent worker` 中即可：

```js
// agent.js
const XAgent = require('xagent');

module.exports = app => {
  const xagentConfig = app.config.xagent;
  if (!xagentConfig.appid || !xagentConfig.secret) {
    app.logger.error('xagent config error, appid & secret must be passed in.');
    return;
  }
  const xagent = new XAgent(Object.assign(xagentConfig, { logger: app.logger }));
  xagent.run();
  app.logger.info('xagent start.');
};
```

然后在配置文件中申明启动 xagent 需要的 `appid` 和 `secret`：

```js
const appRoot = appInfo.env === 'local' || appInfo.env === 'unittest' ? appInfo.baseDir : appInfo.HOME;

config.xagent = {
  appid: 1, // 第一小节中获取到的 AppID
  secret: 'xxxxxxxxxx', // 第一小节中获取到的 AppSecret,
  server: 'ws://xxxxxxxxxx', // 部署的 xagentserver 地址
  logdir: os.tmpdir(),
  packages: [
    path.join(appInfo.baseDir, 'package.json'),
  ],
  error_log: [
    path.join(appRoot, `logs/${appInfo.pkg.name}/common-error.log`),
    path.join(appRoot, 'logs/stderr.log'),
  ],
  libMode: true,
  agentIdMode: 'IP',
  log_level: process.env.XAGENT_DEBUG === 'YES' ? 3 : 2,
};
```
::: tip 墙裂推荐 Egg.js
Egg.js 中使用 xagent 比较方便，错误日志和 `package.json` 的监控因为框架设计上是 **约定优先于配置** 的，所以无需开发者额外配置这些参数。
:::

### 2.3 启动 xagent (PM2)

我们需要在 PM2 启动配置文件中配置一个额外的 `fork` 模式进程来启动 xagent：

```json
{
  "apps": [
    {
      "name": "额外的进程",
      "script": "bin/extra.js",
      "exec_mode": "fork"
    },
    {
      "name": "业务进程",
      "script": "bin/app.js",
      "instances": 4
    }
  ]
}
```

这里省略了其它的 PM2 配置参数，在这种模式下，因为 `extra.js` 只会以 `fork` 模式启动一个进程满足要求，我们只需要将 `xagent` 直接在的 `bin/extra.js` 中引用即可:

```js
const os = require('os');
const XAgent = require('xagent');

const config = {
  server: 'ws://xxxxxxxxxx', // 部署的 xagentserver 地址
  appid: 1, // 第一小节中获取到的 AppID
  secret: 'xxxxxxxxxx', // 第一小节中获取到的 AppSecret
  logdir: os.tmpdir(),
  error_log: ['应用的错误日志文件服务器全路径'],
  packages: ['应用的 package.json 文件服务器全路径'],
  agentIdMode: 'IP',
};
const xagent = new XAgent(config);
xagent.run();
console.log('xagent start.');
```

::: warning 注意
这种方法对原有项目改造较小，需要注意的是 PM2 本身逻辑和职能其实已经超出了一个单纯的 Node.js 进程守护管理工具的范畴了，因此 `extra.js` 虽然独立于业务进程之外，但是其出现一些异常错误 **仍然可能** 会以影响到 PM2 主进程的形式间接对业务进程产生影响。
:::

### 2.4 启动 xagent (全局命令行)

`xagent` 自身也支持全局安装作为命令行来使用，执行如下命令将其安装到全局:

```bash
npm install xagent -g
```

接着编写配置文件，命名为 `xagent.json`:

```json
{
  "server": "ws://xxxxxxxxxx", // 部署的 xagentserver 地址
  "appid": "1", // 第一小节中获取到的 AppID
  "secret": "xxxxxxxxxx" // 第一小节中获取到的 AppSecret
}
```

最后执行如下命令即可进行启动:

```bash
xagent start xagent.json
```

:::tip Docker 发布
命令行启动多用于 docker 容器发布环境，docker 发布模式下通常会将这类 agent 直接打入基础镜像，这样就实现了和业务的完全解耦剥离。
:::
