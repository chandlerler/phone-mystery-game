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
  document.documentElement.dataset.engineVersion = META.version;
  document.documentElement.dataset.messageMode = "queued";

  const startMenu = $("#startMenu");
  const lockScreen = $("#lockScreen");
  const homeScreen = $("#homeScreen");
  const appScreen = $("#appScreen");
  const appBody = $("#appBody");
  const appTitle = $("#appTitle");
  const notificationShade = $("#notificationShade");

  let gameSessionStarted = false;
  let deliveryTimer = null;
  let typingContactId = null;
  let audioContext = null;

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
      dialogueProgress: {},
      pendingResponses: {},
      settings: {
        sound: true,
        vibration: true
      },
      firedEvents: [],
      searchHistory: [],
      puzzleAttempts: {},
      decision: null,
      endingId: null,
      messageSerial: 0,
      storyClock: {
        stageId: DATA.timeline?.[0]?.id || "intro",
        elapsedMs: 0,
        realAnchor: Date.now()
      }
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
      dialogueProgress: { ...base.dialogueProgress, ...(saved.dialogueProgress || {}) },
      pendingResponses: { ...base.pendingResponses, ...(saved.pendingResponses || {}) },
      settings: { ...base.settings, ...(saved.settings || {}) },
      puzzleAttempts: { ...base.puzzleAttempts, ...(saved.puzzleAttempts || {}) },
      unlockedContacts: Array.from(new Set([...(saved.unlockedContacts || []), "linxia"])),
      activatedDialogues: Array.from(new Set(saved.activatedDialogues || [])),
      completedDialogues: Array.from(new Set(saved.completedDialogues || [])),
      firedEvents: Array.from(new Set(saved.firedEvents || [])),
      searchHistory: Array.from(new Set(saved.searchHistory || [])),
      storyClock: {
        ...base.storyClock,
        ...(saved.storyClock || {}),
        realAnchor: Date.now()
      }
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
    syncStoryClockElapsed();
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

  /*
    对话数据既可以继续写普通字符串，也可以写图片/内部链接对象。
    统一入口让旧存档和旧剧情文件无需迁移即可继续显示。
  */
  function normalizeMessageContent(value) {
    if (value && typeof value === "object") {
      return { type: value.type || "text", ...value };
    }
    return { type: "text", text: String(value == null ? "" : value) };
  }

  function messagePreview(value) {
    const content = normalizeMessageContent(value);
    if (content.type === "image") return content.caption || content.alt || "[图片]";
    if (content.type === "link") return content.title || "[链接]";
    return content.text || "";
  }

  /* 浏览器要求声音必须在一次真实点击后解锁，因此首次交互时只初始化音频上下文。 */
  function primeAudio() {
    if (!state.settings.sound) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }

  function playMessageTone(kind = "incoming") {
    if (!state.settings.sound) return;
    primeAudio();
    if (!audioContext || audioContext.state !== "running") return;

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "incoming" ? 0.055 : 0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    gain.connect(audioContext.destination);

    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(kind === "incoming" ? 720 : 480, now);
    if (kind === "incoming") oscillator.frequency.setValueAtTime(920, now + 0.08);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  function messageFeedback(kind = "incoming") {
    playMessageTone(kind);
    if (state.settings.vibration && navigator.vibrate) {
      navigator.vibrate(kind === "incoming" ? [45, 35, 55] : 24);
    }
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

  /*
    剧情时钟不读取玩家设备的当前日期，只借用 Date.now() 计算现实经过了多久。
    月份在数据里按人类习惯使用 1-12，因此创建 Date 时需要减一。
  */
  function timelinePoint(parts = [2026, 7, 17, 22, 17]) {
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], 0, 0).getTime();
  }

  function getTimelineStage(stageId = state.storyClock?.stageId) {
    return (DATA.timeline || []).find((stage) => stage.id === stageId) || DATA.timeline?.[0];
  }

  function syncStoryClockElapsed() {
    if (!state.storyClock) return;
    const stage = getTimelineStage();
    if (!stage) return;
    const now = Date.now();
    const duration = Math.max(0, timelinePoint(stage.end) - timelinePoint(stage.start));
    const realElapsed = Math.max(0, now - Number(state.storyClock.realAnchor || now));
    state.storyClock.elapsedMs = Math.min(duration, Number(state.storyClock.elapsedMs || 0) + realElapsed);
    state.storyClock.realAnchor = now;
  }

  function syncTimelineStage() {
    const available = (DATA.timeline || []).filter((stage) => conditionMet(stage.requires));
    const nextStage = available[available.length - 1];
    if (!nextStage) return;
    syncStoryClockElapsed();
    if (state.storyClock.stageId !== nextStage.id) {
      state.storyClock = { stageId: nextStage.id, elapsedMs: 0, realAnchor: Date.now() };
    }
  }

  function getStoryDate() {
    const stage = getTimelineStage();
    if (!stage) return new Date(2026, 6, 17, 22, 17);
    const duration = Math.max(0, timelinePoint(stage.end) - timelinePoint(stage.start));
    const realElapsed = Math.max(0, Date.now() - Number(state.storyClock.realAnchor || Date.now()));
    const elapsed = Math.min(duration, Number(state.storyClock.elapsedMs || 0) + realElapsed);
    return new Date(timelinePoint(stage.start) + elapsed);
  }

  function storyTimeText() {
    return getStoryDate().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function unlockContacts(ids = []) {
    ids.forEach((id) => {
      if (DATA.characters[id] && !state.unlockedContacts.includes(id)) state.unlockedContacts.push(id);
    });
  }

  function addMessage(contactId, from, content, time = null) {
    const payload = normalizeMessageContent(content);
    state.messageSerial += 1;
    state.messages[contactId] = state.messages[contactId] || [];
    state.messages[contactId].push({
      ...payload,
      id: `m${state.messageSerial}`,
      from,
      time: time || storyTimeText()
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
    state.activatedDialogues.push(dialogueId);
    state.activeNodeByContact[node.contact] = dialogueId;
    state.dialogueProgress[dialogueId] = 0;

    const isReadingThisThread = state.activeApp === "chat" && state.activeContact === node.contact;
    if (!isReadingThisThread) state.unread[node.contact] = Math.max(1, state.unread[node.contact] || 0);
    showToast(node.contact, "有一条新消息，打开对话后接收。");
    if (isReadingThisThread) scheduleNextMessage(node.contact);
    return true;
  }

  /* 文本越长，角色保持“正在输入”的时间越长；上下限避免过快闪现或等待过久。 */
  function messageDelay(content) {
    return Math.max(1300, Math.min(4200, 850 + messagePreview(content).length * 24));
  }

  function clearMessageDelivery() {
    if (deliveryTimer) clearTimeout(deliveryTimer);
    deliveryTimer = null;
    typingContactId = null;
  }

  function queuedMessageFor(contactId) {
    const pending = state.pendingResponses[contactId];
    if (pending) {
      const node = DATA.dialogues[pending.nodeId];
      const choice = node?.choices.find((item) => item.id === pending.choiceId);
      const responses = choice?.response || [];
      if (pending.index < responses.length) {
        return { kind: "response", content: responses[pending.index], pending, node, choice };
      }
    }

    const nodeId = state.activeNodeByContact[contactId];
    const node = DATA.dialogues[nodeId];
    const progress = Number(state.dialogueProgress[nodeId] || 0);
    if (node && progress < node.messages.length) {
      return { kind: "node", content: node.messages[progress], node, index: progress };
    }
    return null;
  }

  function finishDialogueChoice(contactId, pending) {
    const node = DATA.dialogues[pending.nodeId];
    const choice = node?.choices.find((item) => item.id === pending.choiceId);
    if (!node || !choice) return;
    delete state.pendingResponses[contactId];
    applyEffects(choice.effects);
    if (!state.completedDialogues.includes(node.id)) state.completedDialogues.push(node.id);
    if (state.activeNodeByContact[contactId] === node.id) delete state.activeNodeByContact[contactId];
    evaluateEvents();
  }

  function scheduleNextMessage(contactId) {
    if (deliveryTimer || state.activeApp !== "chat" || state.activeContact !== contactId) return;
    const queued = queuedMessageFor(contactId);
    if (!queued) {
      typingContactId = null;
      return;
    }

    typingContactId = contactId;
    const status = $("#typingStatus");
    if (status) {
      status.textContent = "正在输入中";
      status.classList.add("active");
    }

    const delay = messageDelay(queued.content);
    deliveryTimer = setTimeout(() => {
      deliveryTimer = null;
      typingContactId = null;
      addMessage(contactId, contactId, queued.content);
      messageFeedback("incoming");

      if (queued.kind === "node") {
        state.dialogueProgress[queued.node.id] = queued.index + 1;
      } else {
        queued.pending.index += 1;
        const responses = queued.choice?.response || [];
        if (queued.pending.index >= responses.length) finishDialogueChoice(contactId, queued.pending);
      }

      saveState();
      if (state.activeApp === "chat" && state.activeContact === contactId) renderChat();
    }, delay);
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
    syncTimelineStage();
  }

  function completeDialogue(contactId, choiceId) {
    const nodeId = state.activeNodeByContact[contactId];
    const node = DATA.dialogues[nodeId];
    if (!node || state.completedDialogues.includes(nodeId)) return;
    const choice = node.choices.find((item) => item.id === choiceId);
    if (!choice) return;

    clearMessageDelivery();
    addMessage(contactId, "player", choice.reply);
    messageFeedback("sent");
    state.pendingResponses[contactId] = { nodeId, choiceId, index: 0 };
    if (!(choice.response || []).length) finishDialogueChoice(contactId, state.pendingResponses[contactId]);
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
    const continueButton = $("#continueGameBtn");
    const closeButton = $("#menuCloseBtn");
    if (continueButton) continueButton.hidden = !gameSessionStarted;
    if (closeButton) closeButton.classList.toggle("visible", gameSessionStarted);
    if ($("#menuVersion")) $("#menuVersion").textContent = `v${META.version}`;
    if ($("#saveSummary")) {
      $("#saveSummary").textContent = message || (meta ? `上次保存：${formatSaveTime(meta.savedAt)} · v${meta.version || "未知"}` : "尚未建立《回声盲区》存档");
      $("#saveSummary").classList.toggle("success", success);
    }
  }

  function openStartMenu() {
    clearMessageDelivery();
    startMenu.classList.add("active");
    startMenu.setAttribute("aria-hidden", "false");
    updateStartMenu();
  }

  function closeStartMenu() {
    if (!gameSessionStarted) return;
    startMenu.classList.remove("active");
    startMenu.setAttribute("aria-hidden", "true");
    if (state.activeApp === "chat" && state.activeContact) scheduleNextMessage(state.activeContact);
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
      updateStartMenu(`没有可读取的 v${META.version} 存档。`, false);
      return;
    }
    state = loadState();
    const savedApp = state.activeApp;
    const savedContact = state.activeContact;
    gameSessionStarted = true;
    closeStartMenu();
    initScreen();
    if (state.phoneUnlocked && savedApp) {
      state.activeContact = savedContact;
      openApp(savedApp);
    }
    showToast("linxia", "存档已读取，调查继续。");
  }

  function manuallySaveGame() {
    if (!gameSessionStarted) return;
    saveState();
    updateStartMenu("游戏已保存到当前浏览器。", true);
  }

  function initScreen() {
    clearMessageDelivery();
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
      help: renderHelp,
      settings: renderSettings
    };
    if (!renderMap[appName]) return;

    clearMessageDelivery();
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
    clearMessageDelivery();
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
        const hasPending = Boolean(queuedMessageFor(id));
        return `
          <button class="contact-row" type="button" data-contact="${id}">
            <img class="contact-row-avatar character-avatar" src="${character.avatar}" alt="${escapeHtml(character.name)}">
            <span class="contact-row-copy">
              <span class="contact-row-top"><b>${escapeHtml(character.name)}</b><small>${lastMessage ? escapeHtml(lastMessage.time) : ""}</small></span>
              <span class="contact-role">${escapeHtml(character.role)}</span>
              <span class="contact-preview">${escapeHtml(lastMessage ? messagePreview(lastMessage) : (hasPending ? "点击接收新消息" : "暂无新消息"))}</span>
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
            ${renderMessageContent(message)}
          </div>
          <div class="msg-time">${escapeHtml(message.time)}</div>
        </div>
      `;
    }).join("");

    const activeNodeId = state.activeNodeByContact[contactId];
    const activeNode = DATA.dialogues[activeNodeId];
    const nodeMessagesComplete = activeNode && Number(state.dialogueProgress[activeNodeId] || 0) >= activeNode.messages.length;
    const waitingForResponse = Boolean(state.pendingResponses[contactId]);
    const choicesHtml = activeNode && nodeMessagesComplete && !waitingForResponse ? activeNode.choices.map((choice, index) => `
      <button class="choice-btn ${index === 0 ? "primary" : ""}" type="button" data-dialogue-choice="${choice.id}">${escapeHtml(choice.text)}</button>
    `).join("") : queuedMessageFor(contactId)
      ? '<div class="quiet-state">等待对方输入…</div>'
      : '<div class="quiet-state">暂时没有新消息。继续调查其他 App，新的线索会改变对话。</div>';

    appBody.innerHTML = `
      <div class="chat-layout">
        <div class="contact-card">
          <button class="thread-back" type="button" data-chat-list aria-label="返回联系人">‹</button>
          <img class="avatar character-avatar" src="${character.avatar}" alt="${escapeHtml(character.name)}">
          <div class="contact-card-copy"><b>${escapeHtml(character.name)}</b><span class="typing-status ${typingContactId === contactId ? "active" : ""}" id="typingStatus">${typingContactId === contactId ? "正在输入中" : ""}</span></div>
        </div>
        <div class="messages" id="messages">${messagesHtml || '<div class="empty-hint">等待对方发送消息。</div>'}</div>
        <div class="choice-panel">${choicesHtml}</div>
      </div>
    `;
    $("#messages").scrollTop = $("#messages").scrollHeight;
    updateBadges();
    scheduleNextMessage(contactId);
  }

  function renderMessageContent(message) {
    const content = normalizeMessageContent(message);
    const targetAttributes = content.targetApp
      ? `data-message-target-app="${escapeHtml(content.targetApp)}" data-message-target-id="${escapeHtml(content.targetId || "")}"`
      : "";

    if (content.type === "image") {
      return `
        <button class="bubble chat-image-message" type="button" ${targetAttributes} aria-label="${escapeHtml(content.caption || content.alt || "查看图片")}">
          <img src="${escapeHtml(content.src)}" alt="${escapeHtml(content.alt || "聊天图片")}">
          ${content.caption ? `<span>${escapeHtml(content.caption)}</span>` : ""}
        </button>
      `;
    }

    if (content.type === "link") {
      return `
        <button class="bubble chat-link-message" type="button" ${targetAttributes}>
          <small>${escapeHtml(content.eyebrow || "内部链接")}</small>
          <b>${escapeHtml(content.title || "打开内容")}</b>
          ${content.description ? `<span>${escapeHtml(content.description)}</span>` : ""}
          <i>打开 ›</i>
        </button>
      `;
    }

    return `<div class="bubble">${escapeHtml(content.text)}</div>`;
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
    return `<button class="browser-result" type="button" data-browser-article="${result.id}"><span class="result-url">${escapeHtml(result.url)}</span><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.text)}</p></button>`;
  }

  function inspectBrowserArticle(resultId) {
    const result = DATA.clues.searches.find((item) => item.id === resultId);
    if (!result || !conditionMet(result.requires)) return;
    if (!state.searchHistory.includes(result.id)) state.searchHistory.push(result.id);
    markClue(result.setFlag, 0);
    appBody.innerHTML = `
      <article class="browser-article">
        <span class="result-url">${escapeHtml(result.url)}</span>
        <h2>${escapeHtml(result.title)}</h2>
        <p>${escapeHtml(result.text)}</p>
        <button class="choice-btn" type="button" data-open-app="browser">返回浏览器</button>
      </article>
    `;
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

  function settingSupported(key) {
    if (key === "sound") return Boolean(window.AudioContext || window.webkitAudioContext);
    if (key === "vibration") return Boolean(navigator.vibrate);
    return false;
  }

  function updateSystemControls() {
    ["sound", "vibration"].forEach((key) => {
      const enabled = Boolean(state.settings[key]);
      $$(`[data-setting-toggle="${key}"]`).forEach((button) => {
        button.classList.toggle("on", enabled);
        button.setAttribute("aria-pressed", String(enabled));
        const stateLabel = button.querySelector("[data-setting-state]");
        if (stateLabel) stateLabel.textContent = enabled ? "开启" : "关闭";
      });
    });
  }

  function renderSettings() {
    const settingRows = [
      { key: "sound", icon: "♪", title: "消息提示音", detail: "角色消息与玩家回复" },
      { key: "vibration", icon: "⌁", title: "消息震动", detail: "由当前浏览器与设备支持" }
    ].map((item) => `
      <div class="setting-row">
        <span class="setting-symbol">${item.icon}</span>
        <span class="setting-copy"><b>${item.title}</b><small>${settingSupported(item.key) ? item.detail : "此设备暂不支持"}</small></span>
        <button class="system-switch" type="button" data-setting-toggle="${item.key}" aria-label="切换${item.title}" aria-pressed="${String(Boolean(state.settings[item.key]))}">
          <span class="switch-track"><i></i></span><small data-setting-state>${state.settings[item.key] ? "开启" : "关闭"}</small>
        </button>
      </div>
    `).join("");

    appBody.innerHTML = `
      <div class="settings-page">
        <section class="settings-group"><h3>通知反馈</h3>${settingRows}</section>
        <section class="settings-note"><b>浏览器权限</b><span>声音会在首次点击后启用；部分 iPhone 浏览器不提供网页震动。</span></section>
      </div>
    `;
    updateSystemControls();
  }

  function toggleSystemSetting(key) {
    if (!Object.prototype.hasOwnProperty.call(state.settings, key)) return;
    state.settings[key] = !state.settings[key];
    saveState();
    updateSystemControls();
    if (state.settings[key]) {
      if (key === "sound") playMessageTone("sent");
      if (key === "vibration" && navigator.vibrate) navigator.vibrate(35);
    }
  }

  function openMessageTarget(button) {
    const appName = button.dataset.messageTargetApp;
    const targetId = button.dataset.messageTargetId;
    if (!appName) return;
    openApp(appName);
    if (appName === "gallery" && targetId) inspectPhoto(targetId);
    if (appName === "social" && targetId) inspectPost(targetId);
    if (appName === "browser" && targetId) inspectBrowserArticle(targetId);
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
    const latestText = thread.length ? messagePreview(thread[thread.length - 1]) : "旧手机里留下了新的调查线索。";
    if ($("#noticeText")) $("#noticeText").textContent = latestText;
    if ($("#shadeNoticeText")) $("#shadeNoticeText").textContent = latestText;
    const noticeName = document.querySelector("#homeScreen .notice b");
    if (noticeName) noticeName.textContent = character.name;
    const shadeName = document.querySelector("#notificationShade .shade-card b");
    if (shadeName) shadeName.textContent = `微讯 · ${character.name}`;
    updateSystemControls();
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
    syncTimelineStage();
    const now = getStoryDate();
    const text = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const shortDate = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
    const fullDate = `${shortDate} · 雾港市`;
    if ($("#clock")) $("#clock").textContent = text;
    if ($("#homeTime")) $("#homeTime").textContent = text;
    if ($("#lockTime")) $("#lockTime").textContent = text;
    if ($("#lockDate")) $("#lockDate").textContent = fullDate;
    if ($("#homeDate")) $("#homeDate").textContent = fullDate;
    if ($("#shadeDate")) $("#shadeDate").textContent = shortDate;
  }

  /* 所有动态按钮都走事件委托，重新渲染 App 后不需要重复绑定。 */
  document.addEventListener("click", (event) => {
    primeAudio();
    if (event.target.closest("#newGameBtn")) return startNewGame();
    if (event.target.closest("#loadGameBtn")) return loadSavedGame();
    if (event.target.closest("#saveGameBtn")) return manuallySaveGame();
    if (event.target.closest("#continueGameBtn")) return closeStartMenu();
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

    const settingButton = event.target.closest("[data-setting-toggle]");
    if (settingButton) return toggleSystemSetting(settingButton.dataset.settingToggle);

    const messageTarget = event.target.closest("[data-message-target-app]");
    if (messageTarget) return openMessageTarget(messageTarget);

    const appButton = event.target.closest("[data-open-app]");
    if (appButton) return openApp(appButton.dataset.openApp);

    const contactButton = event.target.closest("[data-contact]");
    if (contactButton) {
      clearMessageDelivery();
      state.activeContact = contactButton.dataset.contact;
      state.unread[state.activeContact] = 0;
      saveState();
      return renderChat();
    }
    if (event.target.closest("[data-chat-list]")) {
      clearMessageDelivery();
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
    const articleButton = event.target.closest("[data-browser-article]");
    if (articleButton) return inspectBrowserArticle(articleButton.dataset.browserArticle);
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

  /*
    顶部下拉通知栏手势。
    Pointer Events 覆盖鼠标和大多数触屏，Touch Events 作为部分安卓内置浏览器的兜底。
    只有从状态栏开始或通知栏已经打开时才拦截纵向手势，不影响聊天列表正常滚动。
  */
  const phoneElement = $(".phone");
  let shadeGestureStartY = null;

  function canStartShadeGesture(clientY) {
    const relativeY = clientY - phoneElement.getBoundingClientRect().top;
    return relativeY < 88 || notificationShade.classList.contains("open");
  }

  function beginShadeGesture(clientY) {
    if (canStartShadeGesture(clientY)) shadeGestureStartY = clientY;
  }

  function finishShadeGesture(clientY) {
    if (shadeGestureStartY === null) return;
    const deltaY = clientY - shadeGestureStartY;
    shadeGestureStartY = null;
    if (deltaY > 34) toggleNotificationShade(true);
    if (deltaY < -28) closeNotificationShade();
  }

  phoneElement.addEventListener("pointerdown", (event) => beginShadeGesture(event.clientY));
  phoneElement.addEventListener("pointerup", (event) => finishShadeGesture(event.clientY));
  phoneElement.addEventListener("pointercancel", () => { shadeGestureStartY = null; });

  phoneElement.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    if (touch) beginShadeGesture(touch.clientY);
  }, { passive: true });

  phoneElement.addEventListener("touchmove", (event) => {
    if (shadeGestureStartY !== null) event.preventDefault();
  }, { passive: false });

  phoneElement.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    if (touch) finishShadeGesture(touch.clientY);
  }, { passive: true });

  tickClock();
  setInterval(tickClock, 1000);
  initScreen();
  updateStartMenu();
  openStartMenu();
})();
