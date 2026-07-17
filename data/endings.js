/*
  多结局条件
  ------------------------------------------------------------
  按从严格到宽松的顺序排列。game.js 会选择第一个满足条件的结局。
*/
(function (root) {
  const content = root.GAME_CONTENT = root.GAME_CONTENT || {};

  content.endings = [
    {
      id: "silent_after",
      name: "真结局 · 静默之后",
      tone: "hope",
      requires: {
        decision: "redacted",
        flags: ["linxiaRescued", "legalChain", "privacySafe", "redactedEvidence"],
        minEvidence: 5
      },
      summary: "林夏获救，脱敏报道与司法原件同时送达不同机构，没有任何一个人能够再次独占真相。",
      detail: "顾闻川以滥用公共系统、妨碍调查和重大责任事故被起诉。唐梨公开更正剪辑错误，周衡接受内部调查，许舟参与销毁普通人的声纹模板，林夏则在报道署名下附上自己的诱导记录。七码头七名死者第一次以真实时间出现在公开档案中。"
    },
    {
      id: "shared_guilt",
      name: "结局 · 共同罪人",
      tone: "clear",
      requires: { decision: "full_confession", flags: ["linxiaRescued", "includeAllFaults"], minEvidence: 4 },
      summary: "没有英雄，也没有被方便地推上祭坛的唯一恶人。五个人的每一次隐瞒都进入了报道。",
      detail: "报道引发漫长争论：有人认为它削弱了对顾闻川的指控，也有人第一次看见系统性事故如何由许多看似合理的小决定组成。案件推进得更慢，却没有任何人能用‘正确立场’掩盖自己的行为。"
    },
    {
      id: "wildfire",
      name: "结局 · 烈火新闻",
      tone: "danger",
      requires: { decision: "raw_public" },
      summary: "全部原始数据库在十二分钟内被数百个镜像站复制。顾闻川无法再删除证据，普通人的声纹也再也无法收回。",
      detail: "回声计划震动全国，多名官员辞职，案件迅速重启。但数万人的身份、地点和情绪标签被搜索引擎永久缓存。真相获得了最大传播，代价由没有参与选择的人承担。"
    },
    {
      id: "legal_silence",
      name: "结局 · 合法的沉默",
      tone: "cold",
      requires: { decision: "police" },
      summary: "原始材料进入司法程序，顾闻川被限制出境，但回声计划以国家安全为由转入不公开调查。",
      detail: "周衡每月发来一次简短进度。林夏活着，证人受到保护，普通人的数据库没有泄露。公众只知道七码头案重新调查，却不知道系统曾经怎样聆听整座城市。"
    },
    {
      id: "one_person_trade",
      name: "结局 · 一个人的交换",
      tone: "amber",
      requires: { decision: "deal" },
      summary: "顾闻川兑现承诺，回声计划服务器被永久销毁，林夏安全回来，七码头案仍停留在线路老化的官方结论。",
      detail: "没有新的监控系统上线，也没有人因三年前的命令被起诉。林夏偶尔会问这是否值得，你始终无法给出同一个答案。城市变得安静，却不是因为所有人都知道了真相。"
    },
    {
      id: "echo_gone",
      name: "结局 · 回声消失",
      tone: "lost",
      requires: { decision: "lost" },
      summary: "第二次错误阻断触发物理锁死。服务器、定时信号和林夏的位置缓存同时消失。",
      detail: "周衡后来找到潮汐站，但北侧廊道已经被水淹没。没人能证明顾闻川启动过删除，也没人能证明林夏最后是否离开。旧手机只剩一条无法打开的通知：‘别让沉默看起来像没有发生过。’"
    }
  ];
})(window);
