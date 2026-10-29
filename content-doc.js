(function () {
  'use strict';

  function extractDoc88() {
    // 道客88的文本通常藏在带有特定 class 的 div 或 textarea 中
    let text = '';
    // 尝试抓取所有的文本层
    const textLayers = document.querySelectorAll('.text-layer, .txt-layer, .textLayer, textarea');
    textLayers.forEach(layer => {
      text += (layer.innerText || layer.value || '') + '\n';
    });
    
    // 如果上面的抓不到，就抓取整个文档区域
    if (text.trim().length < 100) {
      const mainContent = document.querySelector('.doc-content, #doc-content, .content');
      if (mainContent) text = mainContent.innerText;
    }
    return text.trim();
  }

  function extractBaidu() {
    let text = '';
    // 百度文库通常会有 p 标签或 span 标签
    const paragraphs = document.querySelectorAll('.reader-txt-layer p, .reader-txt-layer span, .content p');
    paragraphs.forEach(p => {
      text += (p.innerText || '') + '\n';
    });
    return text.trim();
  }

  function createUI() {
    if (document.getElementById('ds-doc-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'ds-doc-btn';
    btn.style.cssText = `
      position: fixed; right: 20px; bottom: 80px; z-index: 2147483647;
      padding: 12px 18px; background: #0078D7; color: white; 
      border-radius: 8px; font-size: 14px; font-weight: bold;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: system-ui, sans-serif; transition: background 0.2s;
    `;
    btn.textContent = '📄 提取全文并发送给 DS';
    
    btn.addEventListener('click', async () => {
      btn.textContent = '提取中...';
      btn.style.background = '#555';

      try {
        const url = window.location.href;
        let content = '';
        
        if (url.includes('doc88.com')) {
          content = extractDoc88();
        } else if (url.includes('wenku.baidu.com')) {
          content = extractBaidu();
        }

        if (!content || content.length < 50) {
          alert('未能提取到有效文字，请确保文档已完全加载，或您已点击“继续阅读”。');
          btn.textContent = '📄 提取全文并发送给 DS';
          btn.style.background = '#0078D7';
          return;
        }

        // 将抓到的文本保存到扩展存储中
        await chrome.storage.local.set({ 
          docToDS: { content: content, title: document.title } 
        });

        // 通知用户并在现有 DS 标签页中打开
        btn.textContent = '发送中...';
        chrome.runtime.sendMessage({ type: 'doc-extracted' });
        
        btn.textContent = '✅ 已发送';
        setTimeout(() => {
          btn.textContent = '📄 提取全文并发送给 DS';
          btn.style.background = '#0078D7';
        }, 3000);

      } catch (err) {
        console.error(err);
        alert('提取失败：' + err.message);
        btn.textContent = '📄 提取全文并发送给 DS';
        btn.style.background = '#0078D7';
      }
    });

    document.body.appendChild(btn);
  }

  if (document.body) createUI();
  else new MutationObserver((_, o) => {
    if (document.body) { o.disconnect(); createUI(); }
  }).observe(document.documentElement, { childList: true });

})();