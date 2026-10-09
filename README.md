# DeepSeek Incognito

DeepSeek 网页端无痕模式扩展：开启后，新建的对话在关闭标签页时自动删除。已有对话不受影响。

## 功能

- 在 `chat.deepseek.com` 页面右下角注入悬浮开关
- 开启后，插件对比侧边栏会话列表，识别本次会话中新建的对话
- 关闭标签页时，自动调用 DeepSeek 删除接口清除这些新对话
- 在已有对话下继续聊天，不会被记录或删除

## 安装（开发者模式）

1. 下载或克隆本仓库
2. 打开 `edge://extensions/`（Edge）或 `chrome://extensions/`（Chrome）
3. 开启"开发人员模式"
4. 点击"加载解压缩的扩展"，选择本仓库目录

## 隐私

详见 [隐私政策](https://你的用户名.github.io/ds-incognito/privacy.html)。

## License

MIT