/*
  剧情节点与触发条件
  ------------------------------------------------------------
  storyNodes 用于调查簿、进度和提示；events 用于真正触发新消息。
  条件只引用状态名，因此调整前后顺序时不必重写界面函数。
*/
(function (root) {
  const content = root.GAME_CONTENT = root.GAME_CONTENT || {};

  content.storyNodes = [
    { id: "N01", chapter: "序章", title: "解锁旧手机", app: "锁屏", completeWhen: { flag: "phoneUnlocked" }, hint: "手机密码是林夏最后同步时间：22:17。" },
    { id: "N02", chapter: "序章", title: "林夏的第一封信", app: "微讯", completeWhen: { dialogue: "linxia_intro" }, hint: "打开微讯，读完林夏的定时消息并回复。" },
    { id: "N03", chapter: "第一幕", title: "两个互相怀疑的人", app: "微讯", completeWhen: { flag: "contactsReady" }, hint: "林夏回复后，周衡和唐梨会同时进入联系人。" },
    { id: "N04", chapter: "第一幕", title: "过曝的七码头", app: "相册", completeWhen: { flag: "photoExif" }, hint: "检查相册 IMG_0717，读取照片的时间、护栏和车牌。" },
    { id: "N05", chapter: "第一幕", title: "周衡的警告", app: "微讯", completeWhen: { dialogue: "zhou_warning" }, hint: "阅读周衡关于证据链的警告并作出回应。" },
    { id: "N06", chapter: "第一幕", title: "唐梨的录音", app: "微讯", completeWhen: { dialogue: "tang_audio" }, hint: "唐梨会发送一段未播出的录音。" },
    { id: "N07", chapter: "第一幕", title: "搜索旧案", app: "浏览器", completeWhen: { flag: "searchedPier" }, hint: "根据照片搜索‘七码头’或‘P-07’。" },
    { id: "N08", chapter: "第一幕", title: "机场动态的倒影", app: "朋友圈", completeWhen: { flag: "socialContradiction" }, hint: "检查顾闻川三年前的动态，观察定位与照片倒影。" },
    { id: "N09", chapter: "第二幕", title: "匿名节点 XZ-04", app: "微讯", completeWhen: { dialogue: "xuzhou_anonymous" }, hint: "搜索‘回声计划’，等待匿名工程师联系。" },
    { id: "N10", chapter: "第二幕", title: "三短一长", app: "视频", completeWhen: { flag: "watchedClip" }, hint: "播放唐梨发送的损坏录音，记住背景蜂鸣。" },
    { id: "N11", chapter: "第二幕", title: "被剪掉的后半句", app: "微讯", completeWhen: { flag: "audioEditDiscovered" }, hint: "取得许舟解码器后重新检查录音。" },
    { id: "N12", chapter: "第二幕", title: "对质唐梨", app: "微讯", completeWhen: { dialogue: "tang_confront" }, hint: "决定如何处理唐梨剪辑关键录音的行为。" },
    { id: "N13", chapter: "第二幕", title: "警方内部档案", app: "微讯", completeWhen: { dialogue: "zhou_archive" }, hint: "完成旧案搜索后，周衡会提供带签名的档案。" },
    { id: "N14", chapter: "第二幕", title: "被修改的时间戳", app: "文档", completeWhen: { flag: "policeTimestamp" }, hint: "打开周衡发送的内部询问记录。" },
    { id: "N15", chapter: "第二幕", title: "witness-14", app: "微讯", completeWhen: { dialogue: "zhou_confront" }, hint: "要求周衡解释为什么修改证人记录。" },
    { id: "N16", chapter: "第二幕", title: "六位储物柜密码", app: "密钥库", completeWhen: { flag: "lockerCodeKnown" }, hint: "拼接照片日期 0717 和车牌尾号 14。" },
    { id: "N17", chapter: "第二幕", title: "硬件密钥", app: "密钥库", completeWhen: { flag: "lockerOpened" }, hint: "在密钥库输入六位储物柜密码。" },
    { id: "N18", chapter: "第三幕", title: "顾闻川来电", app: "微讯", completeWhen: { dialogue: "gu_offer" }, hint: "取得硬件密钥后，顾闻川会主动联系。" },
    { id: "N19", chapter: "第三幕", title: "交换、追踪或拒绝", app: "微讯", completeWhen: { flag: "guDecisionMade" }, hint: "决定是否用密钥交换林夏的位置。" },
    { id: "N20", chapter: "第三幕", title: "服务器倒计时", app: "系统", completeWhen: { anyFlags: ["remoteWipeStarted", "guDealAccepted"] }, hint: "拒绝或追踪顾会启动删除；交易则直接绕过它。" },
    { id: "N21", chapter: "第三幕", title: "阻止远程删除", app: "密钥库", completeWhen: { anyFlags: ["wipeStopped", "guDealAccepted"] }, hint: "输入 ECHO17 阻断删除，或承担与顾交易的后果。" },
    { id: "N22", chapter: "第三幕", title: "林夏实时上线", app: "微讯", completeWhen: { flag: "linxiaLive" }, hint: "至少取得三份证据，并确保服务器没有继续删除。" },
    { id: "N23", chapter: "第三幕", title: "林夏的诱导计划", app: "微讯", completeWhen: { flag: "linxiaConfessionHandled" }, hint: "听完林夏对第二次诱导行动的完整说明。" },
    { id: "N24", chapter: "第三幕", title: "三点定位", app: "浏览器", completeWhen: { anyFlags: ["tideLocation", "guDealAccepted"] }, hint: "结合潮汐站平面图、T-3 蜂鸣和检修廊道搜索位置。" },
    { id: "N25", chapter: "第四幕", title: "选择救援者", app: "微讯", completeWhen: { flag: "linxiaLocated" }, hint: "位置确认后决定由谁进入潮汐站。" },
    { id: "N26", chapter: "第四幕", title: "潮汐站救援", app: "微讯", completeWhen: { flag: "rescueComplete" }, hint: "在周衡的对话中选择正式救援、分离保管或媒体监督。" },
    { id: "N27", chapter: "第四幕", title: "拼合完整证据", app: "文档", completeWhen: { flag: "evidenceAssembled" }, hint: "检查硬件密钥恢复的机柜照片，并阅读声纹清单。" },
    { id: "N28", chapter: "第四幕", title: "三万人的隐私", app: "微讯", completeWhen: { flag: "privacyDecision" }, hint: "和许舟决定脱敏、司法封存或销毁数据库。" },
    { id: "N29", chapter: "终幕", title: "五个人的最后意见", app: "微讯", completeWhen: { dialogue: "final_council" }, hint: "完成唐梨的发布计划、许舟的隐私处理和顾闻川的陈述。" },
    { id: "N30", chapter: "终幕", title: "按下最终按钮", app: "抉择", completeWhen: { flag: "finalDecisionMade" }, hint: "在林夏的最后对话中决定如何处置证据。" }
  ];

  /*
    事件会被 game.js 反复扫描。满足 requires 且尚未 fired 时，执行 effects。
    扫描采用循环，因此一个事件设置的新 flag 可以立刻触发下一事件。
  */
  content.events = [
    { id: "E01_INTRO", requires: { flags: ["phoneUnlocked"] }, effects: { activateDialogues: ["linxia_intro"] } },
    { id: "E02_CONTACTS", requires: { flags: ["introComplete"] }, effects: { flags: ["contactsReady"], unlockContacts: ["zhouheng", "tangli"], activateDialogues: ["zhou_warning", "tang_audio"] } },
    { id: "E03_PHOTO_REPLY", requires: { flags: ["photoExif"] }, effects: { activateDialogues: ["linxia_photo_followup"] } },
    { id: "E04_XU_APPEARS", requires: { flags: ["searchedEcho"] }, effects: { unlockContacts: ["xuzhou"], activateDialogues: ["xuzhou_anonymous"] } },
    { id: "E05_DECODE", requires: { flags: ["decoderGranted", "watchedClip"] }, effects: { activateDialogues: ["xuzhou_decode"] } },
    { id: "E06_TANG_CONFRONT", requires: { flags: ["audioEditDiscovered"] }, effects: { activateDialogues: ["tang_confront"] } },
    { id: "E07_ARCHIVE", requires: { flags: ["searchedPier", "zhouAnswered"] }, effects: { activateDialogues: ["zhou_archive"] } },
    { id: "E08_ZHOU_CONFRONT", requires: { flags: ["policeTimestamp"] }, effects: { activateDialogues: ["zhou_confront"] } },
    { id: "E09_LOCKER_CODE", requires: { flags: ["photoExif", "socialContradiction"] }, effects: { flags: ["lockerCodeKnown"] } },
    { id: "E10_GU_APPEARS", requires: { flags: ["lockerOpened"] }, effects: { unlockContacts: ["guwenchuan"], activateDialogues: ["gu_offer"] } },
    { id: "E11_WIPE", requires: { flags: ["remoteWipeStarted"] }, effects: { activateDialogues: ["xuzhou_wipe"] } },
    { id: "E12_LINXIA_LIVE_SAFE", requires: { minEvidence: 3, flags: ["wipeStopped"] }, effects: { flags: ["linxiaLive"], activateDialogues: ["linxia_live"] } },
    { id: "E12B_LINXIA_LIVE_DEAL", requires: { minEvidence: 3, flags: ["guDealAccepted"] }, effects: { flags: ["linxiaLive"], activateDialogues: ["linxia_live"] } },
    { id: "E13_CONFESSION", requires: { flags: ["liveAcknowledged"] }, effects: { activateDialogues: ["linxia_confession"] } },
    { id: "E14_LOCATED_SEARCH", requires: { flags: ["tideLocation", "linxiaConfessionHandled"] }, effects: { flags: ["linxiaLocated"], activateDialogues: ["zhou_rescue"] } },
    { id: "E14B_LOCATED_DEAL", requires: { flags: ["guDealAccepted", "linxiaConfessionHandled"] }, effects: { flags: ["linxiaLocated"], activateDialogues: ["zhou_rescue"] } },
    { id: "E15_AFTER_RESCUE", requires: { flags: ["rescueComplete"] }, effects: { activateDialogues: ["tang_publication", "gu_final"] } },
    { id: "E16_ASSEMBLE", requires: { flags: ["rescueComplete", "readVoiceManifest", "policeTimestamp", "audioEditDiscovered"] }, effects: { flags: ["evidenceAssembled"], activateDialogues: ["xuzhou_privacy"] } },
    { id: "E17_COUNCIL", requires: { flags: ["privacyDecision", "publicationPlan", "guFinalHandled"] }, effects: { activateDialogues: ["final_council"] } },
    { id: "E18_ENDING_READY", requires: { flags: ["finalDecisionMade"] }, effects: { flags: ["endingReady"] } }
  ];
})(window);
