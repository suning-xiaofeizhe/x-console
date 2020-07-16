'use strict';

module.exports = {
  base: '/public/docs/xnpp/',
  themeConfig: {
    // displayAllHeaders: true,
    sidebar: [
      {
        title: 'XNPP 使用指南',
        path: '/',
        collapsable: false,
        sidebarDepth: 3,
        children: [
          '/QUICK_START',
          '/CONSOLE_GUIDE',
          '/CONTACT'
        ]
      }
    ]
  }
};