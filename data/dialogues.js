/*
  多人物对话节点
  ------------------------------------------------------------
  messages 是角色连续发来的长消息；choices 是玩家可选回复。
  每个选项可以改变 flags、信任值、证据数，也可以直接影响救援和最终结局。
*/
(function (root) {
  const content = root.GAME_CONTENT = root.GAME_CONTENT || {};

  content.dialogues = {
    linxia_intro: {
      id: "linxia_intro",
      contact: "linxia",
      title: "第一封定时信",
      messages: [
        "你终于打开这部手机了。先确认一件事：现在和你说话的内容，大部分是我提前写好的，不代表我此刻安全。",
        "三年前，七码头发生火灾，七个人没有出来。官方说是线路老化，但我找到的日志显示，起火前四十分钟，有人远程关闭了整个码头的网络节点。",
        "那套网络原本负责监听求救声和触发消防报警，后来被改造成了‘回声计划’：它能识别每一个经过公共区域的人。有人为了销毁监控测试记录，把报警一起关了。",
        "我把证据拆成了几份，因为任何一个人拿到全部内容，都可能选择对自己最有利的版本。先看相册里的 IMG_0717，然后联系周衡和唐梨。别急着相信我们中的任何一个，包括我。"
      ],
      choices: [
        {
          id: "intro_care",
          text: "先问她是否安全",
          reply: "我会查，但我首先要知道你是不是还活着。",
          response: ["这句话我可能无法及时回答。找到三份核心证据后，手机会尝试连接我的实时信号。到那时再判断我有没有骗你。"],
          effects: { flags: ["introComplete", "careAboutLinxia"], trust: { linxia: 1 }, unlockContacts: ["zhouheng", "tangli"] }
        },
        {
          id: "intro_evidence",
          text: "要求她先证明案件存在",
          reply: "我不接受只有结论的指令。先给我能核验的东西。",
          response: ["很好。相册有原始 EXIF，唐梨有录音，周衡有警方档案。三份材料彼此冲突，冲突的地方才是真相入口。"],
          effects: { flags: ["introComplete", "evidenceFirst"], trust: { linxia: 0 }, unlockContacts: ["zhouheng", "tangli"] }
        },
        {
          id: "intro_doubt",
          text: "直接质疑林夏在利用自己",
          reply: "你把手机交给我，就是想让我替你承担风险，对吗？",
          response: ["对。我没有资格把这说成请求。你可以随时停下，但一旦公开任何原始文件，就会同时暴露三万多人的声纹。别让愤怒替你做决定。"],
          effects: { flags: ["introComplete", "doubtedLinxia"], trust: { linxia: -1 }, unlockContacts: ["zhouheng", "tangli"] }
        }
      ]
    },

    zhou_warning: {
      id: "zhou_warning",
      contact: "zhouheng",
      title: "停止调查？",
      messages: [
        "这部手机为什么会在你手里？先别回答，也不要把序列号发给任何人。它在三年前的七码头案里被登记为遗失证物。",
        "林夏失踪前最后联系的人不是我，但她给我留过一句话：‘如果旧手机重新上线，说明有人准备让当年的记录再次消失。’",
        "我知道你现在最想听的是‘我会帮你’，可我必须说清楚：来路不明的文件就算是真的，也可能因为取证过程被污染而无法使用。",
        "你可以继续查，但每发现一份原始材料，都先保留哈希和修改时间。不要直接转给媒体，更不要相信一个突然出现的匿名工程师。"
      ],
      choices: [
        {
          id: "zhou_cooperate",
          text: "同意保留合法证据链",
          reply: "我会保留原文件，也会记录每一步。你需要把警方掌握的部分给我。",
          response: ["可以，但我要先确认照片和旧案确实相关。查到七码头公开通报后再联系我，我会申请调阅内部档案。"],
          effects: { flags: ["zhouAnswered", "wantLegalChain"], trust: { zhouheng: 1 } }
        },
        {
          id: "zhou_hide",
          text: "隐瞒林夏已经留下证据",
          reply: "我只是捡到手机，还没看到任何有价值的内容。",
          response: ["你在说谎时会把句子说得特别完整。没关系，但从现在开始我会假设这台设备上的每一次操作都可能被第三方看见。"],
          effects: { flags: ["zhouAnswered", "liedToZhou"], trust: { zhouheng: -1 } }
        },
        {
          id: "zhou_accuse",
          text: "质问警方为什么压了三年",
          reply: "如果警方可信，这件事不会被压三年。你凭什么要求我交东西？",
          response: ["你没有说错。压下它的人有权限改结论，我当时也没能阻止。但法律程序不是那个人，至少原始数字签名不会替他撒谎。"],
          effects: { flags: ["zhouAnswered", "challengedPolice"], trust: { zhouheng: 0 } }
        }
      ]
    },

    tang_audio: {
      id: "tang_audio",
      contact: "tangli",
      title: "未播出的录音",
      messages: [
        "林夏真的把手机给你了？我找了她六天，周衡只会让我等。他们总说再等一份手续、再等一次核验，可新闻不会停在原地。",
        "我这里有她失踪前交来的录音。里面有人说：‘关闭节点，别让今晚的数据离开七码头。’说话的人是顾闻川，我跟了他三年，不会认错。",
        "录音后半段损坏，画面也没有了。我已经把剩下的部分放进手机的视频 App。你会听到海浪、金属门和三短一长的蜂鸣。",
        "先别发给周衡。他会把材料送进内部系统，然后我们再也看不到。你找到能证明录音时间的东西，我就能在明早头版之前把报道发出去。"
      ],
      choices: [
        {
          id: "tang_wait",
          text: "要求核验完整录音",
          reply: "先别写结论。我需要原始文件和完整上下文。",
          response: ["你和林夏一样难缠。好，我把未压缩片段也同步过去，但它有一层工程密钥，我打不开。"],
          effects: { flags: ["tangAudioReceived", "askedRawAudio"], trust: { tangli: 1 } }
        },
        {
          id: "tang_publish",
          text: "承诺找到证据就让她发布",
          reply: "如果能核验顾闻川的声音，我支持你公开。",
          response: ["记住你这句话。三年前我们就是因为每个人都等别人先承担风险，才让七码头变成一页通报。"],
          effects: { flags: ["tangAudioReceived", "promisedPublication"], trust: { tangli: 1 } }
        },
        {
          id: "tang_suspect",
          text: "怀疑她在推动舆论审判",
          reply: "你需要的是事实，还是一个足够像凶手的人？",
          response: ["我需要有人为七条命负责。你可以审查我，但别把谨慎变成什么都不做的借口。录音我还是会给你。"],
          effects: { flags: ["tangAudioReceived", "suspectedTang"], trust: { tangli: -1 } }
        }
      ]
    },

    linxia_photo_followup: {
      id: "linxia_photo_followup",
      contact: "linxia",
      title: "过曝照片",
      messages: [
        "你应该已经看见车牌尾号 14 和护栏 P-07。那辆车登记在顾闻川基金会名下，但这还不能证明驾驶人是谁。",
        "照片时间是 21:46，官方火灾时间是 22:26。四十分钟足够关闭节点、清理机柜，再把停电解释成事故损坏。",
        "朋友圈里有一条顾闻川三年前发的机场动态。不要只看文字，观察玻璃反光。真正的储物柜密码也藏在照片日期和车牌里。"
      ],
      choices: [
        {
          id: "photo_follow",
          text: "继续核对朋友圈",
          reply: "我会核对动态，但不会把一张照片当成定罪证据。",
          response: ["这正是我把材料拆开的原因。任何单份证据都可能骗人，只有它们互相咬合时才有意义。"],
          effects: { flags: ["linxiaPhotoConfirmed"] }
        },
        {
          id: "photo_ask14",
          text: "追问车牌14意味着什么",
          reply: "14只是车牌尾号，还是也对应某个人？",
          response: ["周衡知道。三年前有一名证人也被标记为 witness-14。让他亲口解释。"],
          effects: { flags: ["linxiaPhotoConfirmed", "askedWitness14"] }
        }
      ]
    },

    xuzhou_anonymous: {
      id: "xuzhou_anonymous",
      contact: "xuzhou",
      title: "匿名节点 XZ-04",
      messages: [
        "不要回复真实姓名。我是你搜索记录里的 XZ-04，也是回声计划最后一个还活着并愿意承认自己写过代码的人。",
        "项目最初用声学定位寻找灾害中的求救者。后来顾闻川要求加入身份匹配、情绪标签和轨迹回放。我告诉自己这只是参数变化。",
        "七码头节点关闭命令是我部署的。我知道它和消防报警共用控制总线，但顾说现场已经清空，而且有人正在偷走整座城市的声纹数据库。",
        "唐梨给你的录音不是完整文件。我可以给你解码器，但你必须答应：在看见原始数据库之前，不把任何内容上传公共网络。"
      ],
      choices: [
        {
          id: "xu_accept",
          text: "接受解码器但保留怀疑",
          reply: "把解码器发来。是否公开，要等我看完数据再决定。",
          response: ["合理。视频 App 会识别新的音轨。听完以后，你会发现顾闻川说的话比唐梨留下的版本更复杂。"],
          effects: { flags: ["xuContacted", "decoderGranted"], trust: { xuzhou: 1 }, unlockContacts: ["xuzhou"] }
        },
        {
          id: "xu_demand",
          text: "要求他先承认技术责任",
          reply: "你不是旁观者。先承认你知道报警会一起关闭。",
          response: ["我知道风险，但我相信了‘现场已清空’。这不是无知，是我主动选择相信一个能让我继续工作的版本。解码器仍然给你。"],
          effects: { flags: ["xuContacted", "decoderGranted", "xuAdmitted"], trust: { xuzhou: 0 }, unlockContacts: ["xuzhou"] }
        },
        {
          id: "xu_reject",
          text: "拒绝他的保密要求",
          reply: "你没有资格为调查设条件。",
          response: ["那就把它当作警告，不是条件。我会发送一次性解码器，但不会远程帮你阻止删除。希望你知道自己在赌什么。"],
          effects: { flags: ["xuContacted", "decoderGranted", "rejectedXuTerms"], trust: { xuzhou: -1 }, unlockContacts: ["xuzhou"] }
        }
      ]
    },

    xuzhou_decode: {
      id: "xuzhou_decode",
      contact: "xuzhou",
      title: "被剪掉的后半句",
      messages: [
        "解码完成。唐梨给你的版本停在‘关闭节点’，但原始声道还有后半句：‘关闭节点以后，报警也会离线，先把现场的人撤出来。’",
        "顾闻川知道报警会断。他不是不知道后果，而是相信许诺给他的撤离已经完成。问题是撤离名单被伪造了，七码头里还有七个人。",
        "录音被剪辑不代表顾无罪，却会让辩护方轻易摧毁整篇报道。你必须决定是否立刻对质唐梨。",
        "另外，音轨背景里的三短一长不是码头警报，是 T-3 排水泵故障声。林夏失踪前可能去过某座潮汐站。"
      ],
      choices: [
        {
          id: "decode_confront",
          text: "马上对质唐梨",
          reply: "保留原始声道。我现在去问唐梨为什么剪掉后半句。",
          response: ["我会生成校验值。别只问她剪了什么，也问她为什么确信撤离名单是假的。"],
          effects: { flags: ["audioEditDiscovered", "willConfrontTang"], evidence: 1 }
        },
        {
          id: "decode_hold",
          text: "暂时隐瞒发现继续观察",
          reply: "先不要让她知道我有原始声道。我需要看她下一步会做什么。",
          response: ["谨慎有代价。她的报道已经排进明早版面，你没有太多时间。"],
          effects: { flags: ["audioEditDiscovered", "hidEditFromTang"], evidence: 1 }
        }
      ]
    },

    tang_confront: {
      id: "tang_confront",
      contact: "tangli",
      title: "被剪辑的真相",
      messages: [
        "你找到完整声道了。好，我承认，是我剪掉了顾闻川要求撤人的那句话。",
        "因为那句话会让所有人把注意力放在‘他是否真心想救人’，而不是他为什么有权一句话关闭公共报警系统。",
        "我没有伪造声音，也没有改变他下令断网的事实。我只是删掉了会被公关团队无限放大的借口。",
        "林夏发现后和我吵了一架。她说如果我们为了正确结论修改过程，最后会变成自己调查的那种人。也许她是对的，但三年前那篇完全谨慎的稿子什么都没改变。"
      ],
      choices: [
        {
          id: "tang_keep",
          text: "保留她，但要求使用完整录音",
          reply: "报道可以继续，但必须放回完整上下文，并公开说明剪辑错误。",
          response: ["我会撤下现在的版本，重新写。你找到最终证据后，我保证先让你检查脱敏结果。"],
          effects: { flags: ["tangConfronted", "tangCorrected"], trust: { tangli: 1 } }
        },
        {
          id: "tang_break",
          text: "终止合作",
          reply: "你已经让录音失去公信力。我不会再把证据交给你。",
          response: ["你可以不交，但我手里已经有足够多的片段。别逼我在你准备好之前发布。"],
          effects: { flags: ["tangConfronted", "brokeWithTang"], trust: { tangli: -2 } }
        },
        {
          id: "tang_secret",
          text: "替她隐瞒剪辑行为",
          reply: "暂时不公开剪辑问题，但最终版本必须使用原始录音。",
          response: ["成交。我欠你一次，也欠林夏一次。只是别把这理解成我后悔想让顾闻川付出代价。"],
          effects: { flags: ["tangConfronted", "protectedTang"], trust: { tangli: 2 } }
        }
      ]
    },

    zhou_archive: {
      id: "zhou_archive",
      contact: "zhouheng",
      title: "内部档案",
      messages: [
        "我查到了你说的 P-07。公开通报里没有，但原始勘验照片拍到过同一段护栏。林夏的照片是真的。",
        "我可以把三年前的询问记录发给你。文件带完整数字签名，只要不改动，就能进入司法程序。",
        "但里面有一个时间异常：正式记录是次日上午，底层日志却显示询问发生在事故当晚。修改账号是我的。",
        "你迟早会看到，所以我先说。拿到文件后先读，再决定要不要继续相信我。"
      ],
      choices: [
        {
          id: "archive_accept",
          text: "接收原始档案",
          reply: "发来。我会保留签名和原文件，不会直接编辑。",
          response: ["已经放进文档 App。读完以后来问我 witness-14 是谁。"],
          effects: { flags: ["zhouArchiveShared"], trust: { zhouheng: 1 } }
        },
        {
          id: "archive_copy",
          text: "要求同时提供独立校验值",
          reply: "文件和校验值分开发，我需要排除你再次改动的可能。",
          response: ["应该的。校验值会通过第二个节点发送。你比三年前的我更适合做这件事。"],
          effects: { flags: ["zhouArchiveShared", "verifiedArchive"], trust: { zhouheng: 0 } }
        }
      ]
    },

    zhou_confront: {
      id: "zhou_confront",
      contact: "zhouheng",
      title: "witness-14",
      messages: [
        "witness-14 当年十四岁，是七码头夜班工人的女儿。她躲在货柜里，看见顾闻川的车，也看见有人把撤离名单交给现场负责人。",
        "她父亲死在火里。询问结束后，有人试图从内部系统调取她的住址。我把正式时间改到第二天，并把原始记录留在离线证物库。",
        "这是违规。我没有上报，因为发起查询的人来自市政安全办公室。我以为先保护她，再找机会恢复记录，是当时唯一能做的事。",
        "结果这个机会拖了三年。你可以把我的修改一起公开，我不会为自己辩护。但别公开她的身份。"
      ],
      choices: [
        {
          id: "zhou_protect",
          text: "保护证人并保留原始签名",
          reply: "我会隐藏证人身份，但保留你的修改记录和原始签名。",
          response: ["谢谢。我会正式登记这部手机和现有材料，从现在开始建立完整证据链。"],
          effects: { flags: ["zhouConfronted", "legalChain", "witnessProtected"], trust: { zhouheng: 2 } }
        },
        {
          id: "zhou_independent",
          text: "不完全信任，独立保存两套档案",
          reply: "我会保护证人，但同时保存修改前后的两套记录。",
          response: ["这是正确做法。信任不应该取代备份。需要救援时，我仍然会带队。"],
          effects: { flags: ["zhouConfronted", "legalChain", "independentArchive"], trust: { zhouheng: 0 } }
        },
        {
          id: "zhou_expose",
          text: "把周衡也视为篡改者",
          reply: "理由不能抹掉你篡改系统的事实。我不会让你控制证据。",
          response: ["可以。至少把原始签名留好。你不需要信任我，法院也不应该只听我的解释。"],
          effects: { flags: ["zhouConfronted", "legalChainDamaged"], trust: { zhouheng: -2 } }
        }
      ]
    },

    gu_offer: {
      id: "gu_offer",
      contact: "guwenchuan",
      title: "交换条件",
      messages: [
        "终于轮到我出现在你的联系人里。林夏把你选作最后一个保险，说明她认为你比我们都更容易被‘正确’这个词打动。",
        "我承认下过断网命令。那晚有人准备把整座城市的声纹数据库复制出去，我得到的撤离报告显示七码头已经无人。报告是假的。",
        "我的女儿也在那七个人里面。她去现场阻止测试，却没有出现在任何值班名单上。你以为我掩盖事故是为了保住职位，其实我也在找是谁伪造了撤离。",
        "林夏还活着，但潮汐站的水位正在上涨。把硬件密钥交给我，我立刻给你精确位置，并停止追查这部手机。"
      ],
      choices: [
        {
          id: "gu_accept",
          text: "接受交易，优先救林夏",
          reply: "先给位置。我确认林夏安全后再谈密钥。",
          response: ["北岸潮汐站，T-3 检修廊道。你有四十分钟。我会让入口保持开启，但交易从现在开始生效。"],
          effects: { flags: ["guDecisionMade", "guDealAccepted", "linxiaLocated"], trust: { guwenchuan: 1 }, unlockContacts: ["guwenchuan"] }
        },
        {
          id: "gu_trace",
          text: "拖延对话并追踪信号",
          reply: "密钥可以谈。先证明你真的知道她在哪。",
          response: ["你在追踪这个号码。很遗憾，连接已经足够让我定位硬件密钥。服务器删除程序将在十分钟后启动。"],
          effects: { flags: ["guDecisionMade", "guTraced", "remoteWipeStarted"], trust: { guwenchuan: -1 }, unlockContacts: ["guwenchuan"] }
        },
        {
          id: "gu_refuse",
          text: "拒绝用证据交换人质",
          reply: "你没有资格拿林夏的命换沉默。位置我会自己找。",
          response: ["那就看你先找到她，还是服务器先清空。别把拒绝交易误认为道德上没有代价。"],
          effects: { flags: ["guDecisionMade", "guRefused", "remoteWipeStarted"], trust: { guwenchuan: -2 }, unlockContacts: ["guwenchuan"] }
        }
      ]
    },

    xuzhou_wipe: {
      id: "xuzhou_wipe",
      contact: "xuzhou",
      title: "十分钟倒计时",
      messages: [
        "顾启动了我写的清理程序。它不只删除证据，还会擦掉所有声纹模板。讽刺的是，这原本是我为防止数据库泄露留下的最后保险。",
        "硬件密钥可以中断程序。打开密钥库，输入项目名 ECHO 和事故日期后两位 17，中间不要连字符。",
        "如果你失败，服务器会变成空壳；如果你成功，三万多人的隐私也会留在你手里。阻止删除不是胜利，只是把最终责任转交给你。"
      ],
      choices: [
        {
          id: "wipe_try",
          text: "立即尝试阻断删除",
          reply: "保持连接。我去密钥库输入阻断码。",
          response: ["我会拖慢删除队列。别输错两次，第二次失败会触发物理锁死。"],
          effects: { flags: ["xuWipeBriefed"], trust: { xuzhou: 1 } }
        },
        {
          id: "wipe_question",
          text: "质问他是否也能主动删除",
          reply: "这个程序听你的还是听顾闻川的？",
          response: ["两边都能启动，只有硬件密钥能停止。这是我当年留下的制衡，也是我不敢把密钥放在自己手里的原因。"],
          effects: { flags: ["xuWipeBriefed", "questionedXuControl"], trust: { xuzhou: 0 } }
        }
      ]
    },

    linxia_live: {
      id: "linxia_live",
      contact: "linxia",
      title: "实时信号",
      messages: [
        "这次不是定时消息。能看到回复吗？潮汐站的备用电源只剩一格，我不知道连接能维持多久。",
        "顾闻川没有把我关在这里。我是自己进来的，为了等服务器恢复连接。入口后来被水压锁死，他知道位置，却一直在等我交出密钥。",
        "你已经拿到足够多的材料了。现在停止调查也可以，把位置交给周衡，让他来救人。继续拼证据，会让顾知道你还没有接受交易。",
        "还有一件事我一直没告诉你：我故意让顾的人知道调查地点。我想逼他亲自下令，这意味着七码头第二次险些断网。"
      ],
      choices: [
        {
          id: "live_rescue",
          text: "先救人，之后再谈责任",
          reply: "把环境声音和你能看到的编号发来。调查先停，先定位你。",
          response: ["收到。你会听到 T-3 排水泵的蜂鸣，墙上写着 NORTH-2。谢谢你没有先问我为什么骗你。"],
          effects: { flags: ["liveAcknowledged", "rescueFirst"], trust: { linxia: 2 } }
        },
        {
          id: "live_truth",
          text: "要求她完整交代诱导计划",
          reply: "你差点制造第二次事故。救援前，把你做过的事情全部说清楚。",
          response: ["你说得对。我会发送完整行动记录。不要因为我是失踪者就把我写成无辜的人。"],
          effects: { flags: ["liveAcknowledged", "demandedLinxiaTruth"], trust: { linxia: 0 } }
        },
        {
          id: "live_angry",
          text: "指责她把所有人当成棋子",
          reply: "你利用我、周衡、唐梨，甚至利用自己的失踪。",
          response: ["是。我害怕如果把选择提前交给任何人，他们都会选择最安全的沉默。所以我把选择拖到你已经无法假装不知道的时候。"],
          effects: { flags: ["liveAcknowledged", "angryAtLinxia"], trust: { linxia: -2 } }
        }
      ]
    },

    linxia_confession: {
      id: "linxia_confession",
      contact: "linxia",
      title: "没有英雄的版本",
      messages: [
        "完整记录已经发出。我提前泄露了错误的交接时间，让顾的安全团队以为有人会在潮汐站复制数据库。我的计划是记录他们再次启动清理程序。",
        "许舟不知道我会去现场，唐梨只知道我准备见消息源，周衡则明确反对我继续追踪。他们各自隐瞒了事情，但这一次风险主要是我制造的。",
        "我不后悔逼出远程删除命令，却后悔把你变成没有知情同意的执行者。最终公开时，请把这一段也放进去。",
        "真正的报道不应该需要一个完美受害者，也不应该为了方便理解而创造一个纯粹恶人。"
      ],
      choices: [
        {
          id: "confession_include",
          text: "承诺保留她的责任记录",
          reply: "最终证据会包括你的诱导计划，不把你包装成英雄。",
          response: ["这才是我想要却没能独自做到的版本。现在去找潮汐站位置，别再浪费电量回复我。"],
          effects: { flags: ["linxiaConfessionHandled", "includeAllFaults"] }
        },
        {
          id: "confession_protect",
          text: "先隐藏她的诱导行为",
          reply: "先救你。诱导记录是否公开，等你出来再决定。",
          response: ["我接受，但不要永远替我保存一个更好看的版本。那会让这场调查失去意义。"],
          effects: { flags: ["linxiaConfessionHandled", "protectedLinxia"] }
        }
      ]
    },

    zhou_rescue: {
      id: "zhou_rescue",
      contact: "zhouheng",
      title: "谁来进入潮汐站",
      messages: [
        "北岸潮汐站我查到了。正式入口封闭，北侧检修廊道仍能进，但水位每十分钟上涨十二厘米。",
        "我可以带救援队过去，但一旦登记行动，旧手机和硬件密钥会被列为证物。你之后不能随意把原件交给唐梨。",
        "也可以只把位置给我、不交密钥。我会救人，但服务器证据仍由你保管。第三种选择是让媒体先到场，这能防止内部压案，却会惊动顾闻川的人。",
        "告诉我你选哪一种。不要一个人去，现实里的水不会因为你选了勇敢选项就停下来。"
      ],
      choices: [
        {
          id: "rescue_police",
          text: "让周衡带正式救援队",
          reply: "登记行动。先把林夏救出来，密钥按证物程序封存。",
          response: ["收到。数字签名和封存过程会全程录像。二十五分钟后给你结果。"],
          effects: { flags: ["rescueComplete", "linxiaRescued", "rescuePolice", "legalChain"], trust: { zhouheng: 1 } }
        },
        {
          id: "rescue_split",
          text: "给位置但暂不交出密钥",
          reply: "你负责救援，密钥继续留在我这里，双方各自保留证据。",
          response: ["同意。这不是最方便的方案，但能防止任何一方独占材料。我们进站了。"],
          effects: { flags: ["rescueComplete", "linxiaRescued", "rescueSplit"], trust: { zhouheng: 0 } }
        },
        {
          id: "rescue_media",
          text: "让唐梨同步救援位置",
          reply: "救援队进去时让唐梨直播现场，避免行动记录消失。",
          response: ["风险很高，但我明白你的理由。我会让她延迟十分钟发布，至少先确保入口安全。"],
          effects: { flags: ["rescueComplete", "linxiaRescued", "rescueMedia", "publicPressure"], trust: { zhouheng: -1, tangli: 1 } }
        }
      ]
    },

    tang_publication: {
      id: "tang_publication",
      contact: "tangli",
      title: "明早头版",
      messages: [
        "林夏已经被救出来，我刚确认她能说话。现在轮到另一个问题：我们手上的材料今晚发，还是等周衡走完程序？",
        "今晚发，顾闻川来不及协调口径，但原始声纹名单也可能被镜像站复制。等程序，名单可以脱敏，顾却可能先把责任推给已经离职的现场人员。",
        "我已经撤掉剪辑录音的旧稿。新稿会写明我的错误，也会写明林夏的诱导计划，只要你把最终证据交给我。",
        "你不用安慰我。编辑的工作不是永远正确，是让每一处修改都经得起别人追问。"
      ],
      choices: [
        {
          id: "publish_wait_redact",
          text: "等完成脱敏后再发布",
          reply: "先处理声纹数据。报道可以晚，但普通人的身份不能成为代价。",
          response: ["我给你六小时。之后无论结果如何，我会先发布不含原文件的调查过程。"],
          effects: { flags: ["publicationPlan", "planRedactedPublication"] },
        },
        {
          id: "publish_now",
          text: "今晚公开全部原始材料",
          reply: "现在发布，任何延迟都可能让证据再次消失。",
          response: ["我会照做。但你要知道，一旦镜像扩散，我们再也收不回那三万多个名字。"],
          effects: { flags: ["publicationPlan", "planRawPublication", "publicLeak"] },
        },
        {
          id: "publish_police_first",
          text: "先交警方，报道只保留摘要",
          reply: "原件进入司法程序，你先发经过核验的摘要。",
          response: ["可以。我会保留独立副本和发布时间证明，防止它再次以‘调查中’为理由消失。"],
          effects: { flags: ["publicationPlan", "planPoliceFirst"] }
        }
      ]
    },

    xuzhou_privacy: {
      id: "xuzhou_privacy",
      contact: "xuzhou",
      title: "三万一千四百零六个人",
      messages: [
        "证据已经拼完整。最关键的命令日志嵌在声纹数据库索引里，不能简单删除整个文件，否则顾闻川可以说日志是后来伪造的。",
        "我能运行脱敏脚本：保留命令时间、设备签名和七名死者相关记录，删除其余人的声纹模板。脚本需要二十分钟，过程中任何远程连接都会让校验失效。",
        "另一种选择是保留原库交给警方，但你必须相信封存制度。第三种是彻底销毁数据库，放弃最有力的技术证据。",
        "这次我不替你选。我曾经用‘只是技术决定’逃避责任，现在知道每一个默认选项都是人的决定。"
      ],
      choices: [
        {
          id: "privacy_redact",
          text: "运行脱敏并保留犯罪日志",
          reply: "删除普通人声纹，保留命令日志、签名和事故相关记录。",
          response: ["开始执行。完成后会生成公开版和司法封存版，两者共享同一份来源证明。"],
          effects: { flags: ["privacyDecision", "privacySafe", "redactedEvidence"] }
        },
        {
          id: "privacy_preserve",
          text: "完整保留并交司法封存",
          reply: "不修改原库，只交给警方封存，媒体不接触名单。",
          response: ["技术上最完整，制度风险最高。我会生成只读副本，原件由周衡签收。"],
          effects: { flags: ["privacyDecision", "preservedRawDatabase"] }
        },
        {
          id: "privacy_destroy",
          text: "销毁整套声纹数据库",
          reply: "没有任何案件值得让这套系统继续存在。全部删除。",
          response: ["明白。我们会失去一部分定罪强度，但至少没有人能再次使用它。执行不可逆。"],
          effects: { flags: ["privacyDecision", "databaseDestroyed", "privacySafe"] }
        }
      ]
    },

    gu_final: {
      id: "gu_final",
      contact: "guwenchuan",
      title: "顾闻川的最后陈述",
      messages: [
        "林夏已经离开潮汐站，我没有阻止救援。你可能把这理解为我知道自己输了，也可能把它理解为我从没想让她死。",
        "撤离名单是假的，我的命令是真的，许舟的警告也是真的。我在女儿死亡后选择掩盖，因为一旦项目曝光，城市会把所有责任推给她参与的现场测试组。",
        "这三年我一直追查伪造名单的人，最后发现名单来自自动排班系统：一个没有任何人愿意负责的接口错误。没有第二个幕后凶手，只有一连串人选择相信最方便的数据。",
        "你可以公开我、起诉我，也可以用证据换取项目永久关闭。我只要求一件事：不要公开死者和普通市民的声纹。"
      ],
      choices: [
        {
          id: "gu_reject_final",
          text: "拒绝私下交易",
          reply: "项目是否关闭不能靠你我的秘密协议。责任和证据都必须进入公开程序。",
          response: ["那就让程序决定。希望它这一次比三年前更勇敢。"],
          effects: { flags: ["guFinalHandled", "rejectedFinalDeal"] }
        },
        {
          id: "gu_record",
          text: "保存陈述并要求他自首",
          reply: "这段话会完整保存。你可以带着它主动投案，或者等周衡来找你。",
          response: ["我会去。但别把自首写成赎罪，它只是我终于无法继续控制结局。"],
          effects: { flags: ["guFinalHandled", "guWillSurrender"], evidence: 1 }
        },
        {
          id: "gu_silence_option",
          text: "保留关闭项目的交换可能",
          reply: "我不会现在答应，但会把永久关闭项目作为最终选项。",
          response: ["至少你理解，公开真相和阻止系统继续运行并不总是同一件事。"],
          effects: { flags: ["guFinalHandled", "keptSilenceOption"] }
        }
      ]
    },

    final_council: {
      id: "final_council",
      contact: "linxia",
      title: "最后的选择",
      messages: [
        "我们五个人都留下了最后意见。周衡要完整证据链，唐梨要公开调查过程，许舟要删除普通人的声纹，顾闻川要用关闭项目交换沉默。",
        "而我希望你公开所有人的责任，包括我的诱导计划。但希望不是命令，所以最终按钮只能由你按。",
        "没有一种选择能保存全部东西。原始公开最透明，也最伤害隐私；只交警方最合法，也可能再次沉没；接受交易能立刻关闭系统，却让七名死者继续没有答案。",
        "这不是找密码。你已经知道所有密码了。现在决定什么值得被留下，什么必须被删除。"
      ],
      choices: [
        {
          id: "final_redacted",
          text: "分级公开：脱敏报道 + 司法原件",
          reply: "公开脱敏调查和所有人的责任，司法原件按证据链封存。",
          response: ["收到。公开版将在十分钟后发送，任何人都不能再单独控制它。"],
          effects: { flags: ["finalDecisionMade"], decision: "redacted" }
        },
        {
          id: "final_raw",
          text: "向全网公开全部原始文件",
          reply: "全部公开。让任何人都无法再次删除或篡改。",
          response: ["文件开始上传。它会带来真相，也会带来我们无法收回的伤害。"],
          effects: { flags: ["finalDecisionMade", "publicLeak"], decision: "raw_public" }
        },
        {
          id: "final_police",
          text: "只提交警方与检察机关",
          reply: "原件全部进入司法程序，媒体暂不公开核心材料。",
          response: ["周衡已经签收。接下来可能很慢，也可能再次令人失望，但这是你的决定。"],
          effects: { flags: ["finalDecisionMade"], decision: "police" }
        },
        {
          id: "final_all_faults",
          text: "公开五个人全部过错与完整过程",
          reply: "不塑造英雄，也不寻找替罪羊。公开每一次隐瞒、剪辑、篡改和利用。",
          response: ["那就让所有人一起承担。包括我。"],
          effects: { flags: ["finalDecisionMade", "includeAllFaults"], decision: "full_confession" }
        },
        {
          id: "final_deal",
          text: "接受顾的条件，永久关闭项目",
          reply: "删除证据，换取回声计划永久关闭和所有声纹销毁。",
          response: ["我会尊重这个选择，但七码头的公开记录仍会停在‘线路老化’。"],
          effects: { flags: ["finalDecisionMade", "databaseDestroyed"], decision: "deal" }
        }
      ]
    }
  };
})(window);
