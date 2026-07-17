/*
  《雾港来信：回声盲区》人物资料
  ------------------------------------------------------------
  数据文件使用 window.GAME_CONTENT 共享内容，而不是 ES Module。
  这样部署到 GitHub Pages 可以正常工作，直接双击 HTML 本地试玩也不会被浏览器拦截。
*/
(function (root) {
  const content = root.GAME_CONTENT = root.GAME_CONTENT || {};

  content.meta = {
    title: "雾港来信：回声盲区",
    shortTitle: "雾港来信",
    subtitle: "一部藏在旧手机里的失踪谜案。救人、真相、司法与隐私，没有一个选择完全干净。",
    version: "1.04",
    creator: "chandlerler",
    phonePassword: "2217",
    storageKey: "fogport-echo-blind-zone-v104",
    saveMetaKey: "fogport-echo-blind-zone-save-meta-v104"
  };

  content.apps = {
    chat: "微讯",
    gallery: "相册",
    docs: "文档",
    browser: "浏览器",
    social: "朋友圈",
    videos: "视频",
    vault: "密钥库",
    ending: "抉择",
    help: "调查簿"
  };

  /*
    accent 用于联系人未读标记和关系值；初始 unlocked 只开放林夏。
    其余人物会由 events.js 中的剧情事件逐步解锁。
  */
  content.characters = {
    linxia: {
      id: "linxia",
      name: "林夏",
      role: "失踪调查记者",
      avatar: "assets/avatars/linxia.jpg",
      accent: "#58d68d",
      status: "最后同步：22:17",
      unlocked: true,
      bio: "三年前开始追查七码头火灾。她把证据拆散在旧手机、联系人和现实储物柜中，并设置了多组定时消息。她在追求真相，也在利用玩家逼迫幕后人物露面。"
    },
    zhouheng: {
      id: "zhouheng",
      name: "周衡",
      role: "网安支队调查员",
      avatar: "assets/avatars/zhouheng.jpg",
      accent: "#76a9ff",
      status: "在线 · 连接受保护",
      unlocked: false,
      bio: "林夏的前男友，强调证据链和司法程序。三年前他修改过一名证人的询问时间，表面像伪造档案，实际是为了隐藏一名未成年证人的身份。"
    },
    tangli: {
      id: "tangli",
      name: "唐梨",
      role: "调查栏目编辑",
      avatar: "assets/avatars/tangli.jpg",
      accent: "#ff8fb5",
      status: "在线 · 正在整理素材",
      unlocked: false,
      bio: "林夏最信任的编辑和好友。她相信舆论速度比司法程序更重要，因此剪辑过关键录音，让报道看起来更有决定性。她可能帮助公开真相，也可能提前毁掉整条证据链。"
    },
    xuzhou: {
      id: "xuzhou",
      name: "许舟",
      role: "回声计划工程师",
      avatar: "assets/avatars/xuzhou.jpg",
      accent: "#ffcc66",
      status: "匿名节点 · 信号不稳定",
      unlocked: false,
      bio: "城市声学系统的核心程序员。他知道关闭七码头网络会影响警报，却仍执行了命令。事后留下解密后门，同时也保留着删除所有证据的权限。"
    },
    guwenchuan: {
      id: "guwenchuan",
      name: "顾闻川",
      role: "回声计划投资人",
      avatar: "assets/avatars/guwenchuan.jpg",
      accent: "#d6a6ff",
      status: "私人号码 · 已加密",
      unlocked: false,
      bio: "城市议员与项目投资人。三年前下令切断码头网络，间接关闭火灾警报。他的女儿也是事故死者，因此他既在掩盖责任，也坚信自己是在阻止更大的灾难。"
    }
  };
})(window);
