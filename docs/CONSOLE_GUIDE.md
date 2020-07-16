# 玩转控制台

部署 XNPP 服务端并且完成应用接入后可以访问控制台，本节主要介绍如何使用控制台来对接入的 Node.js 应用进行监控、告警与问题分析。

## I. 控制台概览

控制台主页会默认展示您创建的应用以及对应的部署实例状况概览：

<img :src="$withBase('/overview.png')" alt="console_overview">

这里需要关注的是 **Node 进程 CPU 平均负载** 和 **Node 进程 Memory 平均使用率**，它们的状态是计算每一个应用在单个实例上所有的 Node.js 进程此刻耗费的平均 CPU 和平均堆内存使用率，颜色含义如下：

* <strong style="color: #19be6b">健康态</strong>: CPU / 堆内存使用率 < 60%
* <strong style="color: #ff9900">警告态</strong>: 60% =< CPU / 堆内存使用率 < 85%
* <strong style="color: #ed4014">警告态</strong>: CPU / 堆内存使用率 >= 85%

每一条的 Application 还会显示 24h 内应用配置的告警规则触发的阈值告警数，方便开发者对进程状态有一个直观的认知，这里如何对应用配置告警规则可以参见 [配置告警](/CONSOLE_GUIDE.html#v-配置告警) 一节。

最后点击 Tab 栏 `我加入的应用` 选项则会显示您加入的应用列表，关于如何加入应用与给自己的应用添加别的同学一起协作监控可以参见 [团队协作](/CONSOLE_GUIDE.html#iv-团队协作) 一节。

## II. 实例信息

点击应用中的 `实例` 按钮，可以进入到实例信息页面：

<div style="text-align:center">
  <img :src="$withBase('/instance.png')" alt="instance" style="height: 90px;">
</div>

可以看到实例信息中包含了进程数据、系统数据、异常日志以及模块依赖四个部分。

### 1. 进程数据

实例信息默认展示的是此实例上的 Node.js 进程级别数据：

<img :src="$withBase('/process_overview.png')" alt="process_overview">

#### 进程时间存活线

进程时间存活线展示了每一个接入了 XNPP 的 Node.js 在 24h 内的启动时间长短，通常来说如果您的业务进程没有异常退出的话，所有存活线的长度应当是一致的。

鼠标移至存活线上也会显示对应进程的启动时间和启动命令:

<div style="text-align:center">
  <img :src="$withBase('/start_info.png')" alt="start_info" style="height: 150px;">
</div>

它可以帮助我们查看进程是否按照预期的命令成功启动。

#### 进程 CPU/Memory/GC 指标分布

这里主要显示 CPU / Memory 与 Memory / GC 的二分图。按照经验，全栈类 Node.js 应用出现内存问题的几率是相当高的，这种内存问题发生时往往伴随着反复 GC 扫描堆引发的 CPU 异常彪高问题，这里的二分图有助于快速判定此类问题。

#### 查看运行中的 Node.js 进程

点击右上角 `查看运行中的 Node.js 进程` 按钮可以查看当前实例上所有运行的 Node.js 进程:

<img :src="$withBase('/live_process.png')" alt="live_process" style="height: 290px;">

这里会有一些没有接入 `xprofiler` 插件因而没有生成内核性能分析日志的 Node.js 进程，比如: PM2 守护主进程。

进一步点击右侧的 `检查进程` 按钮:

<div style="text-align:center">
  <img :src="$withBase('/check_process.png')" alt="check_process" style="height: 200px;">
</div>

这里会显示对应的 Node.js 进程的一些信息，比如当前使用的插件版本以及使用的 Node.js 版本信息。

#### 进程概览标签

最后是最右侧的进程概览标签，标签上半部分展示了当前进程最新上报的一些核心指标，这里解释下开发者可能不太容易理解的几个指标：

* **GC 占比**: 过去一分钟内 V8 引擎在 GC 上耗费的时间总和 / 一分钟，得到的 GC 占比百分数
* **UV 存活句柄数 (Ref)**: Libuv 当前仍然存活且处于引用状态的句柄，它们是进程不会退出的原因
* **定时器数量**: 它不是指的 JS 层定时器数量，而是映射到 Libuv 的活跃红黑树定时器数量
* **TCP 活跃句柄数**: 这里可以简单类比为当前进程的活跃 TCP 连接数

有一类内存泄露就是代码逻辑 Bug 造成的海量定时器 / TCP 连接造成的，这些数据有助于帮助开发者快速定位此类问题。

#### 进程详细信息

按钮 `获取 Node.js 进程状态` 功能和上面 [查看运行中的 Node.js 进程](/CONSOLE_GUIDE.html#查看运行中的-node-js-进程) 中的 `检查进程` 一致。

按钮 `进程趋势` 则是以图表的形式展示了进程 24h 内详细数据在时间下的变化趋势，点击如图所示:

<img :src="$withBase('/process_detail.png')" alt="process_detail">

按钮 `保存数据` 则会将进程 24h 内详细数据原始 JSON 数据保存到 OSS 上，因为进程数据非常庞大，目前策略下 XNPP 平台只会保留 3 天内的历史进程数据。

因此提供了保存数据的按钮方便有需要的开发者后期回溯问题，点击如图所示：

<div style="text-align:center">
  <img :src="$withBase('/save_process_data.png')" alt="save_process_data" style="height: 150px;">
</div>

#### 抓取性能数据

这里是 XNPP 平台的重点功能，点击这些按钮会通知对应的进程创建其内部的进程状态采样或者进程快照，这些按钮的作用：

* **CPU Profiling**: 获取进程的 5min 的 CPU 采样信息，定位 CPU 热点函数
* **Heap Profiling**: 获取进程的 5min 的 Heap 采样信息，定位堆内存异常分配问题
* **GC 追踪**: 获取进程的 5min 的 GC 采样信息，定位 GC 占比过高问题
* **堆快照**: 获取进程当前的 V8 引擎堆分配快照，定位内存泄露问题
* **Node.js 实时诊断报告**: 获取进程当前状态切片，定位 JS 主线程类死循环问题

### 2. 定位类死循环案例

这里是一个例子来给大家演示下上一小节中的 [抓取性能数据](/CONSOLE_GUIDE.html#抓取性能数据) 中的 `Node.js 实时诊断报告` 来帮助快速定位到 JS 主线程类死循环问题的能力。

首先编写一个测试文件 `docs.js`，内容如下:

```js
'use strict';

require('xprofiler').start();
const express = require('express');
const app = express();

app.get('/', function (req, res) {
  console.log(req.url);
  res.send('hello');
})

app.get('/regexp', function (req, res) {
  // str 模拟用户输入的问题字符串
  let str = '<br/>                                             ' +
    '           早餐后自由活动，于指定时间集合自行办理退房手续。';
  str += '<br/>                                      <br/>' +
    '                                        <br/>           ' +
    '                         <br/>';
  str += '                                    <br/>' +
    '                                                        ' +
    '                                                        ' +
    '        <br/>';
  str += '                                                <br/>                                                                                                                <br/>';
  str += '                                                     ' +
    '                                                        ' +
    '       根据船班时间，自行前往暹粒机场，返回中国。<br/>';
  str += '如需送机服务，需增加280/每单。<br/>';
  const r = str.replace(/(^(\s*?<br[\s\/]*?>\*?)+|(\s*?<br[\s\/]*?>\s*?)+?$)/igm, '');
  res.send(r);
});

app.listen(8443);
```
启动后首先按照 [快速开始](/QUICK_START.html) 中的方法将其接入到 XNPP 平台。

然后我们可以先打开浏览器访问 `http://localhost:8443` 可以看到浏览器返回 `hello`。

接着继续访问问题接口 `http://localhost:8443/regexp`，这时候由于这里的正则表达式匹配存在异常回溯，即此正则执行完毕需要耗费十几年，JS 的主线程事实上已经被卡死了，造成正常的接口也无法访问，比如之前是可以正常响应的 `http://localhost:8443`。

进入控制台找到对应的进程，点击 `Node.js 实时诊断报告` 按钮生成诊断报告:

<div style="text-align:center">
  <img :src="$withBase('/diag_report.png')" alt="diag_report" style="height: 200px;">
</div>

点击弹出的 Modal 框中的 `文件列表` 可以进入文件列表页，这里可以查看到刚才生成的诊断报告文件:

<img :src="$withBase('/file_raw.png')" alt="file_raw">

此时文件处于未转储状态，点击 `转储` 按钮将生成的文件转储至云端:

<img :src="$withBase('/file_transfer.png')" alt="file_transfer">

最后点击 `X分析` 按钮可以在新打开的结果页中查看分析结果:

<img :src="$withBase('/diag_result.png')" alt="diag_result">

这里很明显的可以看到，JavaScript 栈当前卡在 `/Users/hyj1991/git/example/x-node-test/docs.js:28:17` 的匿名函数中，而这一行正是测试文件中执行 `str.replace` 的这一行，这样这个类死循环问题很容易便得到了定位。

::: tip XNPP 的优势
像本案例中因为正则回溯引发的类死循环问题也比较常见，而且线上接口数量和复杂度都不是案例中的简化后的 JS 文件可比的，这种问题以前往往要耗费大量的人力来比对 Ngnix 上的转发日志一点点排查，现在借助于 XNPP 平台我们可以非常轻松地处理这样的问题。
:::

### 3. 系统数据

系统数据主要包含了当前实例整体的 CPU、可用内存、Load 负载和磁盘等信息:

<img :src="$withBase('/system.png')" alt="system">

### 4. 异常日志

展示 `xagent` 采集开发者在配置的 `error_log` 文件列表中的错误日志信息:

<img :src="$withBase('/error_log.png')" alt="error_log">

:::tip 匹配规则
错误日志中只有符合正则 `/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i` （即时间戳 YYYY-MM-DD HH:mm:ss）的错误日志才能被正确匹配采集到，如果您的错误日志中有特殊字段不能被默认规则匹配的，可以修改 xagent 中的 `lib/error_parser.js` 自行适配。
:::

### 5. 模块依赖

展示您的应用依赖的 Npm 模块:

<img :src="$withBase('/package.png')" alt="package">

## III. 性能文件

点击应用中的 `文件` 按钮，可以进入到文件页面：

<img :src="$withBase('/file_list.png')" alt="file_list">

这里主要将上一节中 [抓取性能数据](/CONSOLE_GUIDE.html#抓取性能数据) 生成的性能分析文件保存至云端。

具体使用的例子可以参见: [定位类死循环案例](/CONSOLE_GUIDE.html#_2-定位类死循环案例)。

:::tip 收藏文件
如果某个性能分析文件对您排查问题非常有用的话，可以点击 `收藏` 按钮来进行收藏。
:::

## IV. 团队协作

点击应用中的 `团队` 按钮，可以进入到团队页面：

<img :src="$withBase('/team.png')" alt="team">

在这里您可以填写用户 ID 来邀请添加新成员，加入的团队成员可以查看完整的监控数据以及生成的性能文件，进而一起对 Node.js 的应用故障进行排查和定位。

:::tip 转交应用
应用管理员也可以将当前应用的管理员权限转交给已加入团队中的某一位同学。
:::

## V. 配置告警

点击应用中的 `报警` 按钮，可以进入到告警页面：

<img :src="$withBase('/alarm.png')" alt="alarm">

在这里开发者可以根据需求配置各类告警规则。

### 1. 阈值表达式

阈值表达式是基于 [boolex](http://github.com/jacksonTian/boolex) 定义的 DSL，它定义了有限的表达方式。

每个应用的开发者可以输入一个阈值表达式，该表达式会被编译为一个等价的 JavaScript 函数。当监控系统收到当前类型的监控数据时，会将监控数据作为上下文，代入阈值表达式，如果表达式结果为 `true`，则判定需要发送警报。

一个基本的表达式由三个部分组成：属性、比较操作符、字面量。

#### 属性

属性标识是指上下文对象的属性表示方式，形式为：`@xxx`，以 `@` 开头接一个属性名。例如：`@load1`、 `@os_cpu`、 `@disk_usage`

#### 比较操作符

比较操作符跟普通的编程语言里的符号完全相同：`==`、`>=`、`>`、`<=`、`<`、`!=`。

#### 运算符

支持 `+`、 `-`、 `*`、 `/`、%运算符，如: `@heap_used / @heap_limit`。

#### 字面量

字面量是指基本的数值类型和字符串类型。一个基本的表达式类似这样：`@load1 > 5`。

#### include

`include` 关键字用于属性值中是否包含某个字符串。如: `@stack include "TypeError"`。

#### 其他

其他的操作符有 `&&`、 `||` 以及 `()`。与普通编程语言表达意思相同。如:

```js
@os_cpu > 0.10 || @load1 > 5
@os_cpu > 0.10 && @load1 > 5
@os_cpu > 0.10 && (@load1 > 5 && @load5 > 5)
```

### 2. 报警表达式

报警表达式类似于阈值表达式，但是并不用来做判定，更类似于模版语言。以下为简单例子：

```js
"I am ${@name}. I am ${@age} years old."
```

其格式主要由 2 个部分组成，`${}` 之外的字符串和 `${}` 内部的表达式。假设有上下文:

```json
{ "name": "hyj1991", "age": 18 }
```

那么最终的执行结果就是:

```js
"I am hyj1991. I am 18 years old."
```

如果有一个报警的上下文是:

```json
{ "load1": 5, "load5": 2, "load15": 2.2 }
```

报警表达式为:

```js
"@load1 > 3"
```

报警内容为:

```js
"load1 较高，高于 3，为 ${load1}，请排查"
```

那么触发告警得到的结果就是:

```js
"load1 较高，高于 3，5，请排查"
```

`${}` 内部支持 `@xxx` 属性的方式、简单的 `+` `-` `*` `%` `/` 以及数值和字符串。

比如内存使用的占比表达如下:

```js
"堆内存占用过高，为 ${@heap_used / @heap_limit * 100}%"
```

### 3. 判定上下文

XNPP 平台采集和展示的日志类型自身分为三大类:

* xprofiler 插件生成的进程相关日志
* xagent 自身定时获取的实例系统信息日志
* 业务 Node.js 进程产生的错误日志

这三大类的日志类型被分别标记为 `node_log`、`system_log` 和 `error_log`，再加上对于进程退出等事件对应的 `xagent_notification` 类型，所以告警的判定表达式需要指定上下文才能拿到对应的值进行阈值溢出判断，下面是这四类上下文支持的判定事件:

* [node_log](/CONSOLE_GUIDE.html#context-node-log)
* [system_log](/CONSOLE_GUIDE.html#context-system-log)
* [error_log](/CONSOLE_GUIDE.html#context-error-log)
* [xagent_notification](/CONSOLE_GUIDE.html#context-xagent-notification)

#### Context: node_log

| 判定事件 | 含义 |
| ------- | --- |
| `@pid` | 进程 id |
| `@cpu_now` | 进程此刻 cpu 耗费 (百分数 * 100) |
| `@cpu_15` | 进程过去 15s 内平均 cpu 耗费 (百分数，例如: 80) |
| `@cpu_30` | 进程过去 30s 内平均 cpu 耗费 (百分数，例如: 80) |
| `@cpu_60` | 进程过去 60s 内平均 cpu 耗费 (百分数，例如: 80) |
| `@rss` | 进程实际占用物理内存 (byte) |
| `@heap_used` | v8 引擎堆已分配内存 (byte) |
| `@heap_available` | v8 引擎堆可用内存 (byte) |
| `@heap_total` | v8 引擎堆总共可用内存 (byte) |
| `@heap_limit` | v8 引擎堆上限 (byte) |
| `@new_space_size` | v8 引擎新生代大小 (byte) |
| `@new_space_used` | v8 引擎新生代已分配大小 (byte) |
| `@new_space_available` | v8 引擎新生代可用大小 (byte) |
| `@new_space_committed` | v8 引擎新生代实际申请物理内存大小 (byte) |
| `@old_space_size` | v8 引擎老生代大小 (byte) |
| `@old_space_used` | v8 引擎老生代已分配大小 (byte) |
| `@old_space_available` | v8 引擎老生代可用大小 (byte) |
| `@old_space_committed` | v8 引擎老生代实际申请物理内存大小 (byte) |
| `@code_space_size` | v8 引擎代码空间大小 (byte) |
| `@code_space_used` | v8 引擎代码空间已分配大小 (byte) |
| `@code_space_available` | v8 引擎代码空间可用大小 (byte) |
| `@code_space_committed` | v8 引擎代码空间实际申请物理内存大小 (byte) |
| `@map_space_size` | v8 引擎 hidden class 大小 (byte) |
| `@map_space_used` | v8 引擎 hidden class 已分配大小 (byte) |
| `@map_space_available` | v8 引擎 hidden class 可用大小 (byte) |
| `@map_space_committed` | v8 引擎 hidden class 实际申请物理内存大小 (byte) |
| `@lo_space_size` | v8 引擎大对象大小 (byte) |
| `@lo_space_used` | v8 引擎大对象已分配大小 (byte) |
| `@lo_space_available` | v8 引擎大对象可用大小 (byte) |
| `@lo_space_committed` | v8 引擎大对象实际申请物理内存大小 (byte) |
| `@active_handles` | libuv 存活且存在引用的句柄数 |
| `@file_handles_active` | libuv 存活且存在引用的文件句柄数 |
| `@tcp_handles_active` | libuv 存活且存在引用的 tcp 句柄数 |
| `@udp_handles_active` | libuv 存活且存在引用的 udp 句柄数 |
| `@timer_handles_active` | libuv 存活且存在引用的 timer 句柄数 |
| `@gc_time_during_last_min` | 过去 1min 内 gc 耗费 (ms) 
| `@scavange_duration` | 过去 1min 内 scavenge gc 耗费 (ms) |
| `@marksweep_duration` | 过去 1min 内 marksweep gc 耗费 (ms) |
| `@total` | 进程从启动至今总 gc 耗费 (ms) |
| `@scavange_duration_total` | 进程从启动至今总 scavenge gc 耗费 (ms) |
| `@marksweep_duration_total` | 进程从启动至今总 marksweep gc 耗费 (ms) |

#### Context: system_log

| 判定事件 | 含义 |
| ------- | --- |
| `@used_cpu` | 系统 cpu 占比 (占比, < 1) |
| `@cpu_count` | 系统 cpu 逻辑核数 |
| `@totalmem` | 系统 memory 大小 (byte) |
| `@freemem` | 系统可用 memory 大小 (byte) |
| `@load1` | 系统过去 1min 的 load 负载 |
| `@load5` | 系统过去 5min 的 load 负载 |
| `@load15` | 系统过去 15min 的 load 负载 |
| `@node_count` | 系统中的 Node.js 进程数目 |
| `@disk_usage` | 系统磁盘使用率 (百分数，例如: 80) |
| `@mounted_on` | 系统磁盘路径 |

#### Context: error_log

| 判定事件 | 含义 |
| ------- | --- |
| `@error_type` | 错误类型 (比如 TypeError, SyntaxError) |
| `@stack` | 错误栈信息 |
| `@log_path` | 错误日志文件路径 |

#### Context: xagent_notification

| 判定事件 | 含义 |
| ------- | --- |
| `@node_process_exit` | 实例上出现 Node.js 进程退出 |
| `@critical` | 应用依赖的 Npm 包扫描到的极危依赖个数 |
| `@high` | 应用依赖的 Npm 包扫描到的高危依赖个数 |
| `@moderate` | 应用依赖的 Npm 包扫描到的中危依赖个数 |
| `@low` | 应用依赖的 Npm 包扫描到的低危依赖个数 |
| `@info` | 应用依赖的 Npm 包扫描到的存在普通安全风险提示模块个数 |

### 4. 添加告警

按照上面三小节的内容编写完成阈值表达式后，点击 `添加告警项` 即可将报警表达式配置到项目生效:

<div style="text-align:center">
  <img :src="$withBase('/add_alarm.png')" alt="add_alarm" style="height: 215px;">
</div>

我们也将一些常用的告警规则整理了出来，点击 `预设规则列表` 即可快速配置告警规则:

<div style="text-align:center">
  <img :src="$withBase('/fast_rule.png')" alt="fast_rule" style="height: 250px;">
</div>

### 5. 禁用/启用告警项

您也可以点击下图中的 `禁用` 按钮来禁用某条已添加的告警项:

<img :src="$withBase('/disable_alarm.png')" alt="disable_alarm">

当然对禁用掉的告警项也可以点击上图中的 `启用` 按钮来进行恢复。

### 6. 配置告警联系人

点击配置告警项中的 `联系人设置` 按钮可以针对配置的告警项添加需要接收通知的团队成员:

<div style="text-align:center">
  <img :src="$withBase('/alarm_contacts.png')" alt="alarm_contacts" style="height:370px;">
</div>

点击 `添加至联系人列表` 可以将联系人加入此告警项通知人列表中，点击 `移出联系人列表` 可以将联系人移出此告警项通知人列表中。

告警联系人这样设计而不是直接将消息推送给应用下所有加入成员，主要目的是方便开发者能更加灵活地定制告警，以聚焦自己需要关注的告警类型。

### 7. 查看告警列表

点击配置告警项中的 `告警列表` 按钮可以看到触发的告警列表:

<img :src="$withBase('/alarm_list.png')" alt="alarm_list">

点击上图中的 `详细信息页面` 则可以直接跳转到对应的详细信息页进行问题的进一步定位。

:::tip 角标提醒
触发了阈值告警的告警项，会在 `告警列表` 按钮上显示触发的次数 (即告警条数)，最多显示 `999` 条，方便开发者直接查看。
:::

## VI. 应用设置

应用设置比较简单，提供了 `修改名称` 和 `删除应用` 两个按钮:

<div style="text-align:center">
  <img :src="$withBase('/setting.png')" alt="setting" style="height: 180px;">
</div>

设置界面只有应用的管理员才能看到和操作，大家可以根据自己的需要进行对应的操作。