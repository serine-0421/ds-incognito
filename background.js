const DELETE_URL = 'https://chat.deepseek.com/api/v0/chat_session/delete';

async function sget(k) { const r = await chrome.storage.session.get(k); return r[k]; }
async function sset(o) { await chrome.storage.session.set(o); }

// 从所有发往 DeepSeek API 的请求里截取 Authorization 头，缓存在 session storage
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      const headers = details.requestHeaders || [];
      for (const h of headers) {
        if (h.name && h.name.toLowerCase() === 'authorization' && h.value) {
          sset({ token: h.value });
          return;
        }
      }
    } catch (e) {}
  },
  { urls: ['https://chat.deepseek.com/api/*'] },
  ['requestHeaders']
);

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender || !sender.tab) return;
  const tabId = sender.tab.id;
  
  if (msg.type === 'update-state') {
    sset({ ['tab_' + tabId]: { enabled: !!msg.enabled, pending: msg.pending || [] } });
  } else if (msg.type === 'doc-extracted') {
    // 接收到提取成功的信号，寻找或新建 DS 标签页
    handleDocInjection();
  }
});

// 新增处理文档注入的函数
async function handleDocInjection() {
  const tabs = await chrome.tabs.query({ url: '*://chat.deepseek.com/*' });
  if (tabs.length > 0) {
    // 如果有打开的 DS 页面，激活它并发送注入消息
    await chrome.tabs.update(tabs[0].id, { active: true });
    // 稍等一下确保标签页切换完成
    setTimeout(() => chrome.tabs.sendMessage(tabs[0].id, { type: 'inject-doc' }), 300);
  } else {
    // 没有就新建一个
    const newTab = await chrome.tabs.create({ url: 'https://chat.deepseek.com' });
    // 新标签页加载需要时间，延迟发送
    setTimeout(() => chrome.tabs.sendMessage(newTab.id, { type: 'inject-doc' }), 2500);
  }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const key = 'tab_' + tabId;
  const state = await sget(key);
  await chrome.storage.session.remove(key);
  if (!state || !state.enabled || !state.pending || state.pending.length === 0) return;

  const token = await sget('token');
  if (!token) {
    console.warn('[ds-incognito] 未捕获到 token，跳过删除', state.pending);
    return;
  }

  try {
    const resp = await fetch(DELETE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'authorization': token,
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-locale': 'zh_CN',
        'x-client-platform': 'web',
        'x-client-version': '2.5.0'
      },
      body: JSON.stringify({ chat_session_ids: state.pending })
    });
    const text = await resp.text();
    console.log('[ds-incognito] 删除结果', resp.status, text, state.pending);
  } catch (e) {
    console.error('[ds-incognito] 删除失败', e, state.pending);
  }
});