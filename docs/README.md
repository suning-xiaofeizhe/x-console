# XNPP

企业级 Node.js 性能监控与热故障分析定位解决方案

项目地址：[https://github.com/suning-xiaofeizhe/x-console](https://github.com/suning-xiaofeizhe/x-console)，欢迎 **Star**

## I. 平台简介

平台全称为 `X-Node Performance Platform`，中文即「 Node.js 性能平台 」，而 `X` 意味着 `extremely`，希望本项目能成为行业里面的 Node.js 性能监控与线上故障定位解决方案的标杆。

`XNPP` 平台能力主要分为以下四大块：

* 实时采集 Node.js 应用 内核性能分析数据 与控制台展示
* 基于可定制 DSL 的 阈值告警方案，方便定制化的告警策略感知线上异常
* 借助于 V8 引擎暴露的调试接口实时获取进程各类 Profiling 与 Snapshot
* 集成了 Chromium devtools 与定制化的快照结果分析服务

于此同时，平台也提供了一些辅助功能，帮助大家一站式解决部署生产应用面临的问题：

* 采集宿主机常规系统级别数据: CPU，Memory，Load 负载与磁盘占用信息
* Node.js 应用错误日志采集与告警
* Node.js 应用依赖的 Npm 包安全问题收集与告警

::: tip 支持的平台
提供 **Linux** / **MacOS** / **Windows** 全平台支持
:::
