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
  }
});

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