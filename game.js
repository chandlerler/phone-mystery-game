/*
  《雾港来信：回声盲区》游戏引擎
  ============================================================
  内容全部来自 data/*.js，本文件只负责：
  1. 保存和读取状态；
  2. 判断事件条件并投递新消息；
  3. 渲染模拟手机中的各个 App；
  4. 把玩家操作转换为剧情 flag、信任值、证据数和结局。
*/
(function () {
  "use strict";

  const DATA = window.GAME_CONTENT;
  if (!DATA || !DATA.meta || !DATA.characters || !DATA.dialogues || !DATA.clues || !DATA.events || !DATA.endings) {
    document.body.innerHTML = '<main style="padding:24px;color:white;background:#111;min-height:100vh">剧情数据加载失败，请确认 data 目录已完整上传。</main>';
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const META = DATA.meta;

  const startMenu = $("#startMenu");
  const lockScreen = $("#lockScreen");
  const homeScreen = $("#homeScreen");
  const appScreen = $("#appScreen");
  const appBody = $("#appBody");
  const appTitle = $("#appTitle");
  const notificationShade = $("#notificationShade");

  let gameSessionStarted = false;

  /* 创建一份完全干净的新游戏状态。复杂对象必须逐层初始化，避免角色消息互相引用。 */
  function createDefaultState() {
    const messages = {};
    const unread = {};
    const trust = {};
    Object.keys(DATA.characters).forEach((id) => {
      messages[id] = [];
      unread[id] = 0;
      trust[id] = 0;
    });

    return {
      phoneUnlocked: false,
      activeApp: null,
      activeContact: null,
      flags: {},
      trust,
      evidence: 0,
      messages,
      unread,
      unlockedContacts: Object.values(DATA.characters).filter((character) => character.unlocked).map((character) => character.id),
      activatedDialogues: [],
      completedDialogues: [],
      activeNodeByContact: {},
      firedEvents: [],
      searchHistory: [],
      puzzleAttempts: {},
      decision: null,
      endingId: null,
      messageSerial: 0
    };
  }

  /* 旧存档缺少的新字段会从默认状态补齐；这也是以后继续增加角色时的兼容入口。 */
  function normalizeState(saved) {
    const base = createDefaultState();
    if (!saved || typeof saved !== "object") return base;

    const mergedMessages = { ...base.messages };
    Object.keys(mergedMessages).forEach((id) => {
      mergedMessages[id] = Array.isArray(saved.messages && saved.messages[id]) ? saved.messages[id] : [];
    });

    return {
      ...base,
      ...saved,
      flags: { ...base.flags, ...(saved.flags || {}) },
      trust: { ...base.trust, ...(saved.trust || {}) },
      unread: { ...base.unread, ...(saved.unread || {}) },
      messages: mergedMessages,
      activeNodeByContact: { ...base.activeNodeByContact, ...(saved.activeNodeByContact || {}) },
      puzzleAttempts: { ...base.puzzleAttempts, ...(saved.puzzleAttempts || {}) },
      unlockedContacts: Array.from(new Set([...(saved.unlockedContacts || []), "linxia"])),
      activatedDialogues: Array.from(new Set(saved.activatedDialogues || [])),
      completedDialogues: Array.from(new Set(saved.completedDialogues || [])),
      firedEvents: Array.from(new Set(saved.firedEvents || [])),
      searchHistory: Array.from(new Set(saved.searchHistory || []))
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(META.storageKey)));
    } catch {
      return createDefaultState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(META.storageKey, JSON.stringify(state));
    localStorage.setItem(META.saveMetaKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      version: META.version
    }));
    renderProgress();
    updateBadges();
    updateStartMenu();
  }

  function readSaveMeta() {
    try {
      return JSON.parse(localStorage.getItem(META.saveMetaKey));
    } catch {
      return null;
    }
  }

  function hasStoredSave() {
    return Boolean(localStorage.getItem(META.storageKey));
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function appLogoMarkup(appName, className = "app-logo-svg") {
    const safeName = Object.prototype.hasOwnProperty.call(DATA.apps, appName) ? appName : "help";
    return `<svg class="${className} logo-${safeName}" aria-hidden="true"><use href="#logo-${safeName}"></use></svg>`;
  }

  function conditionMet(requires = {}) {
    if ((requires.flags || []).some((flag) => !state.flags[flag])) return false;
    if (requires.anyFlags && !requires.anyFlags.some((flag) => state.flags[flag])) return false;
    if ((requires.dialogues || []).some((id) => !state.completedDialogues.includes(id))) return false;
    if (typeof requires.minEvidence === "number" && state.evidence < requires.minEvidence) return false;
    if (requires.trust) {
      for (const [characterId, minimum] of Object.entries(requires.trust)) {
        if ((state.trust[characterId] || 0) < minimum) return false;
      }
    }
    if (requires.decision && state.decision !== requires.decision) return false;
    return true;
  }

  function unlockContacts(ids = []) {
    ids.forEach((id) => {
      if (DATA.characters[id] && !state.unlockedContacts.includes(id)) state.unlockedContacts.push(id);
    });
  }

  function addMessage(contactId, from, text, time = "刚刚") {
    state.messageSerial += 1;
    state.messages[contactId] = state.messages[contactId] || [];
    state.messages[contactId].push({
      id: `m${state.messageSerial}`,
      from,
      text,
      time
    });
  }

  function showToast(characterId, text) {
    if (!state.phoneUnlocked) return;
    const character = DATA.characters[characterId] || DATA.characters.linxia;
    const oldToast = $(".toast");
    if (oldToast) oldToast.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <img class="notice-icon character-avatar" src="${character.avatar}" alt="">
      <span><b>${escapeHtml(character.name)}</b><span>${escapeHtml(text)}</span></span>
    `;
    $(".phone").appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
  }

  function applyEffects(effects = {}) {
    (effects.flags || []).forEach((flag) => { state.flags[flag] = true; });
    unlockContacts(effects.unlockContacts || []);
    if (effects.trust) {
      Object.entries(effects.trust).forEach(([id, amount]) => {
        state.trust[id] = (state.trust[id] || 0) + amount;
      });
    }
    if (effects.evidence) state.evidence += effects.evidence;
    if (effects.decision) state.decision = effects.decision;
  }

  function activateDialogue(dialogueId) {
    if (state.activatedDialogues.includes(dialogueId)) return false;
    const node = DATA.dialogues[dialogueId];
    if (!node) return false;

    unlockContacts([node.contact]);
    node.messages.forEach((text, index) => {
      addMessage(node.contact, node.contact, text, index === 0 && dialogueId === "linxia_intro" ? "22:17" : "刚刚");
    });
    state.activatedDialogues.push(dialogueId);
    state.activeNodeByContact[node.contact] = dialogueId;

    const isReadingThisThread = state.activeApp === "chat" && state.activeContact === node.contact;
    if (!isReadingThisThread) state.unread[node.contact] = (state.unread[node.contact] || 0) + node.messages.length;
    showToast(node.contact, node.messages[0]);
    return true;
  }

  /*
    事件扫描会持续到没有新事件发生。这样解开一个谜题后，可以连续解锁联系人、
    投递消息和打开下一阶段，而不需要每个 App 手写专属跳转代码。
  */
  function evaluateEvents() {
    let changed;
    let guard = 0;
    do {
      changed = false;
      for (const event of DATA.events) {
        if (state.firedEvents.includes(event.id) || !conditionMet(event.requires)) continue;
        state.firedEvents.push(event.id);
        applyEffects(event.effects);
        (event.effects.activateDialogues || []).forEach((id) => activateDialogue(id));
        changed = true;
      }
      guard += 1;
    } while (changed && guard < 20);
  }

  function completeDialogue(contactId, choiceId) {
    const nodeId = state.activeNodeByContact[contactId];
    const node = DATA.dialogues[nodeId];
    if (!node || state.completedDialogues.includes(nodeId)) return;
    const choice = node.choices.find((item) => item.id === choiceId);
    if (!choice) return;

    addMessage(contactId, "player", choice.reply, "已发送");
    (choice.response || []).forEach((text) => addMessage(contactId, contactId, text));
    applyEffects(choice.effects);
    state.completedDialogues.push(nodeId);
    delete state.activeNodeByContact[contactId];
    evaluateEvents();
    saveState();
    renderChat();
  }

  function markClue(flag, evidence = 0) {
    if (!state.flags[flag]) {
      state.flags[flag] = true;
      state.evidence += evidence;
      evaluateEvents();
      saveState();
    }
  }

  function formatSaveTime(isoText) {
    if (!isoText) return "暂无存档";
    const date = new Date(isoText);
    if (Number.isNaN(date.getTime())) return "存档时间未知";
    return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function updateStartMenu(message = "", success = false) {
    const loadButton = $("#loadGameBtn");
    const saveButton = $("#saveGameBtn");
    const meta = readSaveMeta();
    if (loadButton) loadButton.disabled = !hasStoredSave();
    if (saveButton) saveButton.disabled = !gameSessionStarted;
    if ($("#menuVersion")) $("#menuVersion").textContent = `v${META.version}`;
    if ($("#saveSummary")) {
      $("#saveSummary").textContent = message || (meta ? `上次保存：${formatSaveTime(meta.savedAt)} · v${meta.version || "未知"}` : "尚未建立《回声盲区》存档");
      $("#saveSummary").classList.toggle("success", success);
    }
  }

  function openStartMenu() {
    startMenu.classList.add("active");
    startMenu.setAttribute("aria-hidden", "false");
    updateStartMenu();
  }

  function closeStartMenu() {
    if (!gameSessionStarted) return;
    startMenu.classList.remove("active");
    startMenu.setAttribute("aria-hidden", "true");
  }

  function startNewGame() {
    state = createDefaultState();
    gameSessionStarted = true;
    localStorage.removeItem(META.storageKey);
    localStorage.removeItem(META.saveMetaKey);
    saveState();
    closeStartMenu();
    initScreen();
  }

  function loadSavedGame() {
    if (!hasStoredSave()) {
      updateStartMenu("没有可读取的 v1.04 存档。", false);
      return;
    }
    state = loadState();
    gameSessionStarted = true;
    closeStartMenu();
    initScreen();
    if (state.phoneUnlocked && state.activeApp) openApp(state.activeApp);
    showToast("linxia", "存档已读取，调查继续。");
  }

  function manuallySaveGame() {
    if (!gameSessionStarted) return;
    saveState();
    updateStartMenu("游戏已保存到当前浏览器。", true);
  }

  function initScreen() {
    closeNotificationShade();
    lockScreen.classList.toggle("active", !state.phoneUnlocked);
    homeScreen.classList.toggle("active", state.phoneUnlocked);
    appScreen.classList.remove("active");
    if (!state.phoneUnlocked) {
      $("#phonePassInput").value = "";
      $("#phoneLockError").textContent = "";
    }
    updateBadges();
  }

  function unlockPhone() {
    const input = $("#phonePassInput");
    if (input.value !== META.phonePassword) {
      $("#phoneLockError").textContent = "密码不对。提示：林夏最后同步时间是 22:17。";
      input.value = "";
      input.focus();
      return;
    }
    state.phoneUnlocked = true;
    state.flags.phoneUnlocked = true;
    evaluateEvents();
    saveState();
    lockScreen.classList.remove("active");
    homeScreen.classList.add("active");
    showToast("linxia", "你终于打开这部手机了。");
  }

  function openApp(appName) {
    if (!state.phoneUnlocked) {
      $("#phoneLockError").textContent = "先解锁手机。提示：最后同步时间是 22:17。";
      return;
    }
    const renderMap = {
      chat: renderChat,
      gallery: renderGallery,
      docs: renderDocs,
      browser: renderBrowser,
      social: renderSocial,
      videos: renderVideos,
      vault: renderVault,
      ending: renderEnding,
      help: renderHelp
    };
    if (!renderMap[appName]) return;

    state.activeApp = appName;
    closeNotificationShade();
    lockScreen.classList.remove("active");
    homeScreen.classList.remove("active");
    appScreen.classList.add("active");
    appTitle.innerHTML = `${appLogoMarkup(appName, "app-header-logo")}<span>${escapeHtml(DATA.apps[appName])}</span>`;
    renderMap[appName]();
    saveState();
  }

  function goHome() {
    state.activeApp = null;
    state.activeContact = null;
    closeNotificationShade();
    appScreen.classList.remove("active");
    lockScreen.classList.remove("active");
    homeScreen.classList.add("active");
    saveState();
  }

  function renderChat() {
    if (!state.activeContact) {
      const contactsHtml = state.unlockedContacts.map((id) => {
        const character = DATA.characters[id];
        const thread = state.messages[id] || [];
        const lastMessage = thread[thread.length - 1];
        const unread = state.unread[id] || 0;
        return `
          <button class="contact-row" type="button" data-contact="${id}">
            <img class="contact-row-avatar character-avatar" src="${character.avatar}" alt="${escapeHtml(character.name)}">
            <span class="contact-row-copy">
              <span class="contact-row-top"><b>${escapeHtml(character.name)}</b><small>${lastMessage ? escapeHtml(lastMessage.time) : ""}</small></span>
              <span class="contact-role">${escapeHtml(character.role)}</span>
              <span class="contact-preview">${escapeHtml(lastMessage ? lastMessage.text : character.status)}</span>
            </span>
            ${unread ? `<span class="contact-unread">${Math.min(unread, 99)}</span>` : ""}
          </button>
        `;
      }).join("");

      appBody.innerHTML = `
        <div class="messenger-shell">
          <div class="messenger-summary">
            <div><span>加密联系人</span><b>${state.unlockedContacts.length} / 5</b></div>
            <div><span>证据</span><b>${state.evidence}</b></div>
          </div>
          <div class="contact-list">${contactsHtml}</div>
        </div>
      `;
      return;
    }

    const contactId = state.activeContact;
    const character = DATA.characters[contactId];
    state.unread[contactId] = 0;
    const messages = state.messages[contactId] || [];
    const messagesHtml = messages.map((message) => {
      const incoming = message.from !== "player";
      return `
        <div class="msg ${incoming ? "npc" : "player"}">
          <div class="msg-row">
            ${incoming ? `<img class="msg-avatar character-avatar" src="${character.avatar}" alt="">` : ""}
            <div class="bubble">${escapeHtml(message.text)}</div>
          </div>
          <div class="msg-time">${escapeHtml(message.time)}</div>
        </div>
      `;
    }).join("");

    const activeNodeId = state.activeNodeByContact[contactId];
    const activeNode = DATA.dialogues[activeNodeId];
    const choicesHtml = activeNode ? activeNode.choices.map((choice, index) => `
      <button class="choice-btn ${index === 0 ? "primary" : ""}" type="button" data-dialogue-choice="${choice.id}">${escapeHtml(choice.text)}</button>
    `).join("") : '<div class="quiet-state">暂时没有新消息。继续调查其他 App，新的线索会改变对话。</div>';

    appBody.innerHTML = `
      <div class="chat-layout">
        <div class="contact-card">
          <button class="thread-back" type="button" data-chat-list aria-label="返回联系人">‹</button>
          <img class="avatar character-avatar" src="${character.avatar}" alt="${escapeHtml(character.name)}">
          <div class="contact-card-copy"><b>${escapeHtml(character.name)}</b><span>${escapeHtml(character.status)} · 信任 ${formatTrust(state.trust[contactId])}</span></div>
        </div>
        <div class="messages" id="messages">${messagesHtml || '<div class="empty-hint">等待对方发送消息。</div>'}</div>
        <div class="choice-panel">${choicesHtml}</div>
      </div>
    `;
    $("#messages").scrollTop = $("#messages").scrollHeight;
    updateBadges();
  }

  function formatTrust(value) {
    if (value >= 2) return "信赖";
    if (value >= 1) return "合作";
    if (value <= -2) return "决裂";
    if (value <= -1) return "警惕";
    return "观望";
  }

  function renderGallery() {
    const photos = DATA.clues.photos.filter((photo) => conditionMet(photo.requires));
    appBody.innerHTML = `<div class="gallery">${photos.map((photo) => `
      <button class="photo-card evidence-card" type="button" data-photo="${photo.id}">
        <img class="evidence-thumb" src="${photo.image}" alt="${escapeHtml(photo.title)}">
        <span class="photo-label"><span><b>${escapeHtml(photo.title)}</b><br>${escapeHtml(photo.summary)}</span><span class="clue-chip">${state.flags[photo.setFlag] ? "已检查" : escapeHtml(photo.badge)}</span></span>
      </button>
    `).join("")}</div>`;
  }

  function inspectPhoto(photoId) {
    const photo = DATA.clues.photos.find((item) => item.id === photoId);
    if (!photo || !conditionMet(photo.requires)) return;
    markClue(photo.setFlag, photo.evidence);
    appBody.innerHTML = `
      <div class="clue-detail">
        <img class="evidence-hero" src="${photo.image}" alt="${escapeHtml(photo.title)}">
        <div class="clue-detail-copy"><span class="clue-chip">证据 +${photo.evidence}</span><h2>${escapeHtml(photo.title)}</h2><p>${escapeHtml(photo.detail)}</p></div>
        <button class="choice-btn" type="button" data-open-app="gallery">返回相册</button>
      </div>
    `;
  }

  function renderDocs() {
    const docs = DATA.clues.documents.filter((doc) => conditionMet(doc.requires));
    appBody.innerHTML = `<div class="notes-list">${docs.map((doc) => `
      <button class="doc-card clue-button" type="button" data-doc="${doc.id}">
        <span><b>${escapeHtml(doc.title)}</b><small>${escapeHtml(doc.modified)}</small></span>
        <span class="clue-chip">${state.flags[doc.setFlag] ? "已读" : "未读"}</span>
      </button>
    `).join("")}</div>`;
  }

  function inspectDoc(docId) {
    const doc = DATA.clues.documents.find((item) => item.id === docId);
    if (!doc || !conditionMet(doc.requires)) return;
    markClue(doc.setFlag, doc.evidence);
    appBody.innerHTML = `
      <div class="document-reader">
        <div class="document-title"><span>只读文档</span><h2>${escapeHtml(doc.title)}</h2><small>${escapeHtml(doc.modified)}</small></div>
        <p>${escapeHtml(doc.text).replaceAll("\n", "<br>")}</p>
        <button class="choice-btn" type="button" data-open-app="docs">返回文档</button>
      </div>
    `;
  }

  function renderBrowser() {
    const history = state.searchHistory.map((id) => DATA.clues.searches.find((item) => item.id === id)).filter(Boolean);
    appBody.innerHTML = `
      <div class="browser-page">
        <div class="search-bar"><input id="searchInput" type="search" placeholder="搜索线索，例如：七码头"><button id="searchBtn" type="button">搜索</button></div>
        <div id="searchResults">${history.length ? history.map(searchResultMarkup).join("") : '<div class="empty-hint">搜索结果会保存在本机历史中。关键词来自照片、文档、录音和人物对话。</div>'}</div>
      </div>
    `;
  }

  function searchResultMarkup(result) {
    return `<article class="browser-result"><span class="result-url">${escapeHtml(result.url)}</span><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.text)}</p></article>`;
  }

  function doSearch() {
    const input = $("#searchInput");
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const result = DATA.clues.searches.find((item) => conditionMet(item.requires) && item.keywords.some((word) => query.includes(word.toLowerCase()) || word.toLowerCase().includes(query)));
    if (!result) {
      $("#searchResults").innerHTML = '<div class="empty-hint">没有命中有效档案。尝试使用照片编号、项目名称、蜂鸣设备或地点关键词。</div>';
      return;
    }
    if (!state.searchHistory.includes(result.id)) state.searchHistory.push(result.id);
    markClue(result.setFlag, 0);
    $("#searchResults").innerHTML = state.searchHistory.map((id) => DATA.clues.searches.find((item) => item.id === id)).filter(Boolean).map(searchResultMarkup).join("");
  }

  function renderSocial() {
    const posts = DATA.clues.socialPosts.filter((post) => conditionMet(post.requires));
    appBody.innerHTML = `<div class="social-list">${posts.map((post) => {
      const character = Object.values(DATA.characters).find((item) => item.name === post.author);
      return `
        <button class="post-card social-post" type="button" data-post="${post.id}">
          <span class="post-author">${character ? `<img class="character-avatar" src="${character.avatar}" alt="">` : ""}<span><b>${escapeHtml(post.author)}</b><small>${escapeHtml(post.time)}</small></span></span>
          <span class="post-copy">${escapeHtml(post.text)}</span>
          <span class="post-image">定位：${escapeHtml(post.location)}</span>
          <span class="post-meta">${state.flags[post.setFlag] ? escapeHtml(post.reveal) : "点击检查动态细节"}</span>
        </button>
      `;
    }).join("")}</div>`;
  }

  function inspectPost(postId) {
    const post = DATA.clues.socialPosts.find((item) => item.id === postId);
    if (!post || !conditionMet(post.requires)) return;
    markClue(post.setFlag, post.evidence);
    renderSocial();
  }

  function renderVideos() {
    const videos = DATA.clues.videos.filter((video) => conditionMet(video.requires));
    appBody.innerHTML = `<div class="gallery">${videos.length ? videos.map((video) => `
      <button class="video-card media-video" type="button" data-video="${video.id}">
        <span class="video-poster"><img src="${video.poster}" alt=""><span class="play">▶</span><small>${video.duration}</small></span>
        <span class="photo-label"><span><b>${escapeHtml(video.title)}</b><br>${escapeHtml(video.description)}</span><span class="clue-chip">${state.flags[video.setFlag] ? "已播放" : "加密"}</span></span>
      </button>
    `).join("") : '<div class="empty-hint">目前没有可播放文件。唐梨掌握着一段损坏的录音。</div>'}</div>`;
  }

  function inspectVideo(videoId) {
    const video = DATA.clues.videos.find((item) => item.id === videoId);
    if (!video || !conditionMet(video.requires)) return;
    markClue(video.setFlag, video.evidence);
    appBody.innerHTML = `
      <div class="clue-detail">
        <div class="video-poster large"><img src="${video.poster}" alt=""><span class="audio-wave">▂▅▃▇▆▂▁▅▃▆▂</span></div>
        <div class="clue-detail-copy"><span class="clue-chip">${video.duration}</span><h2>${escapeHtml(video.title)}</h2><p>${escapeHtml(video.description)}</p></div>
        <button class="choice-btn" type="button" data-open-app="videos">返回视频</button>
      </div>
    `;
  }

  function currentPuzzle() {
    const { locker, wipe } = DATA.clues.puzzles;
    if (conditionMet(wipe.requires) && !state.flags.wipeStopped) return wipe;
    if (conditionMet(locker.requires) && !state.flags.lockerOpened) return locker;
    return null;
  }

  function renderVault() {
    const puzzle = currentPuzzle();
    if (puzzle) {
      appBody.innerHTML = `
        <div class="locked puzzle-panel">
          <div class="lock-icon">⌁</div><h2>${escapeHtml(puzzle.title)}</h2><p>${escapeHtml(puzzle.hint)}</p>
          <div class="passcode"><input id="passInput" type="text" autocomplete="off" maxlength="${puzzle.maxlength}" placeholder="输入 ${puzzle.maxlength} 位代码"><button class="small-btn" id="unlockBtn" type="button">确认</button></div>
          <div class="error" id="passError"></div>
        </div>
      `;
      return;
    }

    if (!state.flags.lockerCodeKnown) {
      appBody.innerHTML = '<div class="locked"><div class="lock-icon">⌁</div><h2>没有可用密钥</h2><p>先检查相册日期和顾闻川朋友圈中的定位矛盾。</p></div>';
      return;
    }

    appBody.innerHTML = `
      <div class="key-vault">
        <div class="key-chip"><span>HARDWARE KEY</span><b>ECHO / P-07</b><small>${state.flags.wipeStopped ? "删除已阻断" : "密钥已连接"}</small></div>
        <p>硬件密钥中恢复了机柜快照。去相册检查 RECOVERY_02，再到文档读取声纹清单。</p>
        <button class="choice-btn" type="button" data-open-app="gallery">查看恢复照片</button>
      </div>
    `;
  }

  function tryUnlock() {
    const puzzle = currentPuzzle();
    if (!puzzle) return;
    const input = $("#passInput");
    const value = input.value.trim().toUpperCase();
    if (value === puzzle.code) {
      puzzle.successFlags.forEach((flag) => { state.flags[flag] = true; });
      if (puzzle.evidence) state.evidence += puzzle.evidence;
      evaluateEvents();
      saveState();
      showToast(puzzle.id === "locker" ? "guwenchuan" : "xuzhou", puzzle.id === "locker" ? "硬件密钥上线。" : "远程删除已阻断。");
      renderVault();
      return;
    }

    state.puzzleAttempts[puzzle.id] = (state.puzzleAttempts[puzzle.id] || 0) + 1;
    input.value = "";
    if (puzzle.id === "wipe" && state.puzzleAttempts[puzzle.id] >= 2) {
      state.flags.remoteWipeSucceeded = true;
      state.flags.finalDecisionMade = true;
      state.flags.endingReady = true;
      state.decision = "lost";
      saveState();
      openApp("ending");
      return;
    }
    $("#passError").textContent = puzzle.id === "wipe" ? "阻断码错误。只剩一次机会。" : "密码不匹配。重新检查日期和车牌尾号。";
    saveState();
  }

  function endingMatches(ending) {
    return conditionMet(ending.requires);
  }

  function renderEnding() {
    if (!state.flags.endingReady) {
      const completed = DATA.storyNodes.filter(isStoryNodeComplete).length;
      appBody.innerHTML = `<div class="ending locked-ending"><span class="ending-kicker">INVESTIGATION OPEN</span><h2>最终抉择尚未出现</h2><p>当前完成 ${completed} / ${DATA.storyNodes.length} 个剧情节点。继续调查，直到五个人都给出最后意见。</p><button class="choice-btn" type="button" data-open-app="help">打开调查簿</button></div>`;
      return;
    }

    const ending = DATA.endings.find(endingMatches) || DATA.endings[DATA.endings.length - 1];
    state.endingId = ending.id;
    localStorage.setItem(META.storageKey, JSON.stringify(state));
    appBody.innerHTML = `
      <div class="ending final-ending tone-${ending.tone}">
        <span class="ending-kicker">CASE CLOSED · ${escapeHtml(META.version)}</span>
        <h2>${escapeHtml(ending.name)}</h2>
        <p class="ending-summary">${escapeHtml(ending.summary)}</p>
        <div class="ending-detail">${escapeHtml(ending.detail)}</div>
        <div class="ending-stats"><span>证据 <b>${state.evidence}</b></span><span>获救 <b>${state.flags.linxiaRescued ? "是" : "否"}</b></span><span>隐私 <b>${state.flags.privacySafe ? "已保护" : "未保护"}</b></span></div>
        <button class="choice-btn" type="button" data-open-app="help">回看调查路径</button>
      </div>
    `;
  }

  function isStoryNodeComplete(node) {
    const check = node.completeWhen || {};
    if (check.flag) return Boolean(state.flags[check.flag]);
    if (check.anyFlags) return check.anyFlags.some((flag) => state.flags[flag]);
    if (check.dialogue) return state.completedDialogues.includes(check.dialogue);
    return false;
  }

  function currentHint() {
    const next = DATA.storyNodes.find((node) => !isStoryNodeComplete(node));
    return next ? `${next.id} ${next.title}：${next.hint}` : "全部剧情节点已完成，可以在“抉择”中查看结局。";
  }

  function renderHelp() {
    const completeCount = DATA.storyNodes.filter(isStoryNodeComplete).length;
    const trustHtml = state.unlockedContacts.map((id) => {
      const character = DATA.characters[id];
      const value = Math.max(-2, Math.min(2, state.trust[id] || 0));
      const percent = ((value + 2) / 4) * 100;
      return `<div class="trust-row"><img class="character-avatar" src="${character.avatar}" alt=""><span><b>${character.name}</b><small>${formatTrust(value)}</small></span><i><em style="width:${percent}%;background:${character.accent}"></em></i></div>`;
    }).join("");

    appBody.innerHTML = `
      <div class="help-page">
        <section class="help-band"><span>调查进度</span><b>${completeCount} / ${DATA.storyNodes.length}</b><p>${escapeHtml(currentHint())}</p></section>
        <section class="help-section"><h3>人物关系</h3>${trustHtml}</section>
        <section class="help-section"><h3>剧情节点</h3><div id="progressList" class="progress-list"></div></section>
        <section class="help-section"><h3>操作</h3><button class="choice-btn" id="desktopHint" type="button">查看当前提示</button><button class="choice-btn danger-choice" id="resetGame" type="button">清除存档并重新开始</button></section>
      </div>
    `;
    renderProgress();
  }

  function renderProgress() {
    const progressList = $("#progressList");
    if (!progressList) return;
    progressList.innerHTML = DATA.storyNodes.map((node) => `
      <div class="progress-item ${isStoryNodeComplete(node) ? "done" : ""}"><span class="progress-dot"></span><span><b>${node.id} · ${escapeHtml(node.title)}</b><small>${escapeHtml(node.chapter)} · ${escapeHtml(node.app)}</small></span></div>
    `).join("");
  }

  function updateBadges() {
    const totalUnread = Object.values(state.unread).reduce((sum, value) => sum + Number(value || 0), 0);
    const badge = $("#chatBadge");
    if (badge) {
      badge.style.display = totalUnread ? "grid" : "none";
      badge.textContent = totalUnread > 9 ? "9+" : String(totalUnread || "");
    }

    const latestCharacterId = state.unlockedContacts.slice().reverse().find((id) => (state.unread[id] || 0) > 0) || "linxia";
    const character = DATA.characters[latestCharacterId];
    const thread = state.messages[latestCharacterId] || [];
    const latestText = thread.length ? thread[thread.length - 1].text : "旧手机里留下了新的调查线索。";
    if ($("#noticeText")) $("#noticeText").textContent = latestText;
    if ($("#shadeNoticeText")) $("#shadeNoticeText").textContent = latestText;
    const noticeName = document.querySelector("#homeScreen .notice b");
    if (noticeName) noticeName.textContent = character.name;
    const shadeName = document.querySelector("#notificationShade .shade-card b");
    if (shadeName) shadeName.textContent = `微讯 · ${character.name}`;
  }

  function resetGame() {
    localStorage.removeItem(META.storageKey);
    localStorage.removeItem(META.saveMetaKey);
    state = createDefaultState();
    gameSessionStarted = true;
    saveState();
    initScreen();
  }

  function toggleNotificationShade(forceOpen) {
    if (!state.phoneUnlocked) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !notificationShade.classList.contains("open");
    notificationShade.classList.toggle("open", shouldOpen);
    notificationShade.setAttribute("aria-hidden", String(!shouldOpen));
  }

  function closeNotificationShade() {
    notificationShade.classList.remove("open");
    notificationShade.setAttribute("aria-hidden", "true");
  }

  function tickClock() {
    const now = new Date();
    const text = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    if ($("#clock")) $("#clock").textContent = text;
    if ($("#homeTime")) $("#homeTime").textContent = text;
    if ($("#lockTime")) $("#lockTime").textContent = text;
    if ($("#shadeDate")) $("#shadeDate").textContent = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  }

  /* 所有动态按钮都走事件委托，重新渲染 App 后不需要重复绑定。 */
  document.addEventListener("click", (event) => {
    if (event.target.closest("#newGameBtn")) return startNewGame();
    if (event.target.closest("#loadGameBtn")) return loadSavedGame();
    if (event.target.closest("#saveGameBtn")) return manuallySaveGame();
    if (event.target.closest("#menuLauncher")) return openStartMenu();
    if (event.target.closest("#menuCloseBtn")) return closeStartMenu();
    if (event.target.closest("#phoneUnlockBtn")) return unlockPhone();
    if (event.target.closest("#shadeGrip")) return toggleNotificationShade();
    if (event.target.closest("#shadeClose")) return closeNotificationShade();
    if (event.target.closest("[data-lock-open-chat]")) {
      $("#phonePassInput").focus();
      $("#phoneLockError").textContent = "先解锁手机。提示：最后同步时间是 22:17。";
      return;
    }
    if (event.target.closest("#desktopHint")) return alert(currentHint());
    if (event.target.closest("#resetGame")) return resetGame();

    const appButton = event.target.closest("[data-open-app]");
    if (appButton) return openApp(appButton.dataset.openApp);

    const contactButton = event.target.closest("[data-contact]");
    if (contactButton) {
      state.activeContact = contactButton.dataset.contact;
      state.unread[state.activeContact] = 0;
      saveState();
      return renderChat();
    }
    if (event.target.closest("[data-chat-list]")) {
      state.activeContact = null;
      saveState();
      return renderChat();
    }

    const choiceButton = event.target.closest("[data-dialogue-choice]");
    if (choiceButton && state.activeContact) return completeDialogue(state.activeContact, choiceButton.dataset.dialogueChoice);

    const photoButton = event.target.closest("[data-photo]");
    if (photoButton) return inspectPhoto(photoButton.dataset.photo);
    const docButton = event.target.closest("[data-doc]");
    if (docButton) return inspectDoc(docButton.dataset.doc);
    const postButton = event.target.closest("[data-post]");
    if (postButton) return inspectPost(postButton.dataset.post);
    const videoButton = event.target.closest("[data-video]");
    if (videoButton) return inspectVideo(videoButton.dataset.video);
    if (event.target.closest("#searchBtn")) return doSearch();
    if (event.target.closest("#unlockBtn")) return tryUnlock();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "phonePassInput") unlockPhone();
    if (event.key === "Enter" && event.target.id === "searchInput") doSearch();
    if (event.key === "Enter" && event.target.id === "passInput") tryUnlock();
  });

  $("#backBtn").addEventListener("click", goHome);
  $("#homeBtn").addEventListener("click", goHome);
  $("#hintBtn").addEventListener("click", () => alert(currentHint()));

  /* 顶部下拉通知栏手势，同时兼容鼠标和触屏。 */
  let pointerStartY = null;
  $(".phone").addEventListener("pointerdown", (event) => {
    const isTopArea = event.clientY - $(".phone").getBoundingClientRect().top < 76;
    if (isTopArea || notificationShade.classList.contains("open")) pointerStartY = event.clientY;
  });
  $(".phone").addEventListener("pointerup", (event) => {
    if (pointerStartY === null) return;
    const deltaY = event.clientY - pointerStartY;
    pointerStartY = null;
    if (deltaY > 42) toggleNotificationShade(true);
    if (deltaY < -36) closeNotificationShade();
  });

  tickClock();
  setInterval(tickClock, 20000);
  initScreen();
  updateStartMenu();
  openStartMenu();
})();
