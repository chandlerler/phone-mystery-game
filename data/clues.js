/*
  线索与谜题数据
  ------------------------------------------------------------
  每条线索只描述“内容、出现条件、完成后设置什么状态”。
  界面如何呈现由 game.js 决定，因此以后换图或改谜面不需要碰引擎。
*/
(function (root) {
  const content = root.GAME_CONTENT = root.GAME_CONTENT || {};

  content.clues = {
    photos: [
      {
        id: "pier_exposure",
        title: "IMG_0717 · 过曝的七码头",
        image: "assets/photos/pier-night.jpg",
        summary: "林夏反复备份的一张雾夜港口照片。画面右侧像是有一辆车。",
        detail: "降低曝光后，护栏编号显示为 P-07，车牌尾号是 14。EXIF 时间为 7 月 17 日 21:46，比官方通报早了四十分钟。",
        requires: {},
        setFlag: "photoExif",
        evidence: 1,
        badge: "关键"
      },
      {
        id: "server_snapshot",
        title: "RECOVERY_02 · 机柜快照",
        image: "assets/photos/echo-server.jpg",
        summary: "从储物柜硬件密钥中恢复的服务器照片。",
        detail: "机柜标签写着 ECHO-CIVIL-07。右下角的维护单证明，声纹数据库与七码头消防报警使用了同一条控制总线。",
        requires: { flags: ["hardwareKey"] },
        setFlag: "serverPhoto",
        evidence: 1,
        badge: "恢复"
      },
      {
        id: "station_map",
        title: "CACHE_MAP · 潮汐站平面图",
        image: "assets/videos/tide-station-poster.jpg",
        summary: "林夏实时信号里附带的一张模糊路径图。",
        detail: "平面图缺少站名，但排水泵编号 T-3 与录音中的三短一长蜂鸣相符。入口应该在废弃潮汐站北侧检修廊道。",
        requires: { flags: ["linxiaLive"] },
        setFlag: "stationMap",
        evidence: 0,
        badge: "定位"
      }
    ],

    documents: [
      {
        id: "linxia_note",
        title: "未发送的备忘.txt",
        modified: "今天 22:17",
        requires: {},
        setFlag: "readLinxiaNote",
        evidence: 0,
        text: "如果你读到这里，说明我没有按约定回来。不要只问谁在说谎，要问每个人为什么必须说谎。照片给地点，录音给时间，警方档案给责任人。最后得到的东西不能原样公开。"
      },
      {
        id: "official_report",
        title: "七码头火灾公开通报.pdf",
        modified: "三年前 23:58",
        requires: { flags: ["searchedPier"] },
        setFlag: "readOfficialReport",
        evidence: 0,
        text: "事故时间：22:26。初步原因：老化线路短路。现场报警设备因高温损坏，未能上传完整记录。附件中的网络断开时间被涂黑，但页脚仍残留审批编号 GW-0717。"
      },
      {
        id: "police_archive",
        title: "内部档案_询问记录.zip",
        modified: "由周衡发送",
        requires: { flags: ["zhouArchiveShared"] },
        setFlag: "policeTimestamp",
        evidence: 1,
        text: "原始询问记录显示，一名未成年证人在 21:52 看见顾闻川的车辆进入七码头。系统中的正式记录却被改为次日 09:10。修改账号属于周衡，但原始文件保留了完整数字签名，可建立司法证据链。"
      },
      {
        id: "voice_manifest",
        title: "ECHO_voice_manifest.csv",
        modified: "从机柜快照恢复",
        requires: { flags: ["serverPhoto"] },
        setFlag: "readVoiceManifest",
        evidence: 1,
        text: "数据表包含 31,406 名普通市民的声纹模板、通话地点和情绪标签。最后一列标记为 emergency_link，证明监控系统与消防报警共用关闭指令。公开原文件可以定罪，也会永久泄露所有人的身份数据。"
      }
    ],

    searches: [
      {
        id: "pier_search",
        keywords: ["七码头", "雾港七码头", "P-07", "码头火灾"],
        requires: { flags: ["photoExif"] },
        setFlag: "searchedPier",
        title: "雾港七码头火灾旧闻",
        url: "archive.local/pier-07",
        text: "官方称事故发生于 22:26，但附近居民上传的停电照片时间是 21:49。相关讨论在两小时后被集中删除。"
      },
      {
        id: "echo_search",
        keywords: ["回声计划", "ECHO-CIVIL", "GW-0717", "城市声纹"],
        requires: { flags: ["searchedPier"] },
        setFlag: "searchedEcho",
        title: "回声计划采购记录",
        url: "archive.local/echo-civil",
        text: "项目名义用途是灾害声学定位，投资方为顾闻川控制的闻川城市基金。核心承包人一栏只留下工程师代号 XZ-04。"
      },
      {
        id: "tide_search",
        keywords: ["潮汐站", "T-3", "检修廊道", "三短一长"],
        requires: { flags: ["linxiaLive", "watchedClip"] },
        setFlag: "tideLocation",
        title: "废弃潮汐站维护手册",
        url: "archive.local/tide-t3",
        text: "T-3 排水泵只安装在北岸潮汐站。三短一长蜂鸣代表北侧检修廊道积水，紧急出口在旧铁路桥下方。"
      }
    ],

    socialPosts: [
      {
        id: "gu_trip",
        author: "顾闻川",
        time: "三年前 21:41",
        text: "结束临时会议，准备离开雾港。愿这座城市今晚平安。",
        location: "雾港国际机场",
        requires: { flags: ["searchedPier"] },
        setFlag: "socialContradiction",
        evidence: 1,
        reveal: "动态声称人在机场，但照片玻璃倒影里出现 P-07 护栏和七码头黄色吊机。这条动态很可能是预先发布的不在场证明。"
      },
      {
        id: "tang_deadline",
        author: "唐梨",
        time: "今天 20:12",
        text: "有些报道等证据完全干净，真相就已经死了。",
        location: "雾港新闻中心",
        requires: {},
        setFlag: "sawTangPost",
        evidence: 0,
        reveal: "唐梨的态度很明确：她愿意承担失实风险，也不愿再次错过报道窗口。"
      },
      {
        id: "zhou_rain",
        author: "周衡",
        time: "昨天 23:08",
        text: "程序不会替人承担后果。",
        location: "仅自己可见",
        requires: { flags: ["policeTimestamp"] },
        setFlag: "sawZhouPost",
        evidence: 0,
        reveal: "配图文件名含有 witness-14，似乎对应照片里的车牌尾号和那名未成年证人。"
      }
    ],

    videos: [
      {
        id: "pier_ambient",
        title: "AUDIO_0717 · 码头背景声",
        poster: "assets/videos/tide-station-poster.jpg",
        duration: "00:43",
        requires: { flags: ["tangAudioReceived"] },
        setFlag: "watchedClip",
        evidence: 0,
        description: "画面损坏，只剩海浪、金属门、三短一长的蜂鸣，以及一句被截断的话：‘关闭节点以后，报警也会……’"
      }
    ],

    puzzles: {
      locker: {
        id: "locker",
        title: "七码头储物柜",
        code: "071714",
        maxlength: 6,
        requires: { flags: ["photoExif", "socialContradiction"] },
        successFlags: ["lockerOpened", "hardwareKey"],
        evidence: 1,
        hint: "六位数字：照片日期 0717 + 车牌尾号 14。"
      },
      wipe: {
        id: "wipe",
        title: "远程删除阻断",
        code: "ECHO17",
        maxlength: 6,
        requires: { flags: ["remoteWipeStarted", "hardwareKey"] },
        successFlags: ["wipeStopped"],
        evidence: 0,
        hint: "硬件密钥标签上的项目英文名 + 事故日期后两位，不输入连字符。"
      }
    }
  };
})(window);
