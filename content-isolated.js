(function () {
  'use strict';
  var STATE_KEY = 'ds_incognito_state';
  var SID_RE = /\/a\/chat\/s\/([0-9a-f-]{36})/;

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return { enabled: false, baseline: [], pending: [] };
      var s = JSON.parse(raw);
      s.baseline = s.baseline || [];
      s.pending = s.pending || [];
      return s;
    } catch (e) { return { enabled: false, baseline: [], pending: [] }; }
  }
  function saveState(s) {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function currentSid() {
    var m = location.pathname.match(SID_RE);
    return m ? m[1] : null;
  }
  function sidebarIds() {
    var set = {};
    var list = document.querySelectorAll('a[href^="/a/chat/s/"]');
    for (var i = 0; i < list.length; i++) {
      var m = list[i].getAttribute('href').match(SID_RE);
      if (m) set[m[1]] = 1;
    }
    return Object.keys(set);
  }

  var state = loadState();

  function syncToBackground() {
    try {
      chrome.runtime.sendMessage({
        type: 'update-state',
        enabled: !!state.enabled,
        pending: state.pending || []
      }).catch(function () {});
    } catch (e) {}
  }

  var lastUrl = location.href;
  setInterval(function () {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    onUrlChange();
  }, 500);

  function onUrlChange() {
    if (!state.enabled) return;
    var sid = currentSid();
    if (!sid) return;
    if (state.baseline.indexOf(sid) !== -1) return;
    if (state.pending.indexOf(sid) !== -1) return;
    state.pending.push(sid);
    saveState(state);
    syncToBackground();
    updateUI();
  }

  function toggle() {
    if (state.enabled) {
      state = { enabled: false, baseline: [], pending: [] };
    } else {
      var baseline = sidebarIds();
      var cur = currentSid();
      if (cur && baseline.indexOf(cur) === -1) baseline.push(cur);
      if (baseline.length === 0) {
        alert('无痕模式：未能读取到侧边栏会话列表，请等页面加载完成后再开启。');
        return;
      }
      state = { enabled: true, baseline: baseline, pending: [] };
    }
    saveState(state);
    syncToBackground();
    updateUI();
  }

  var btn = null;
  function createUI() {
    btn = document.createElement('div');
    btn.id = 'ds-incognito-btn';
    btn.style.cssText = [
      'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
      'padding:10px 14px', 'border-radius:20px', 'font-size:13px',
      'font-family:system-ui,-apple-system,sans-serif', 'cursor:pointer',
      'user-select:none', 'box-shadow:0 2px 10px rgba(0,0,0,.25)',
      'transition:background .15s,color .15s'
    ].join(';');
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
    updateUI();
  }
  function updateUI() {
    if (!btn) return;
    if (state.enabled) {
      btn.textContent = '无痕模式：已开启 (待删 ' + state.pending.length + ')';
      btn.style.background = '#d9534f';
      btn.style.color = '#fff';
    } else {
      btn.textContent = '无痕模式：已关闭';
      btn.style.background = '#2b2b2b';
      btn.style.color = '#ddd';
    }
  }

  if (document.body) createUI();
  else new MutationObserver(function (_, o) {
    if (document.body) { o.disconnect(); createUI(); }
  }).observe(document.documentElement, { childList: true });

  syncToBackground();
})();
  // ====== 新增：接收文库文档并填入 DS 输入框 ======
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'inject-doc') {
      chrome.storage.local.get('docToDS', (data) => {
        if (!data.docToDS || !data.docToDS.content) return;
        
        const { title, content } = data.docToDS;
        // 构造 Prompt
        const prompt = `我刚刚提取了文档《${title}》的内容。请帮我基于以下内容进行分析：\n\n${content}\n\n---\n（注意：以上为文档全文，请直接针对我的问题进行解答。如果文档内容不完整或断层，请告诉我。）\n\n我的问题：`;
        
        // 寻找输入框
        const textarea = document.querySelector('textarea');
        if (textarea) {
          // 设置输入框的值 (需要触发 React 的 input 事件)
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          nativeInputValueSetter.call(textarea, prompt);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          // 清理存储，防止重复发送
          chrome.storage.local.remove('docToDS');
          
          // 提示用户
          console.log('文档已填入 DS 输入框，请点击发送。');
          // 可以加一个页面内提示
          const toast = document.createElement('div');
          toast.textContent = '文档已填入输入框，请按回车发送';
          toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:4px;z-index:9999;font-family:sans-serif;';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        }
      });
    }
  });

  // 如果用户是刚打开的 DS 页面（由后台新建），主动检查一次
  setTimeout(() => {
    chrome.storage.local.get('docToDS', (data) => {
      if (data.docToDS) {
        chrome.runtime.sendMessage({ type: 'inject-doc' }); // 触发上面的逻辑
      }
    });
  }, 2000);