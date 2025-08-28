# Redote - 小红书私信机器人框架

## 项目概述

Redote 是一个现代化的 TypeScript 小红书私信机器人框架，参考了 pysxt Python 项目的协议实现，并采用类似 oicq 包的消息链架构设计。

## 架构特点

### 🔗 消息链架构 (类似 oicq)
- **统一事件处理**: 使用单一的 `message` 事件处理所有消息类型，而不是每种类型一个事件
- **消息段组合**: 消息由不同类型的段组成（text, image, video, voice, card, note, emoticon, at）
- **链式构建**: 支持复杂消息的组合和构建

### 🛠️ 现代化技术栈
- **TypeScript**: 完整的类型安全和现代 ES 模块
- **Zod**: 运行时类型验证
- **EventEmitter3**: 高性能事件处理
- **Bun**: 快速的 JavaScript 运行时（不打包）

### 🔄 协议兼容性
- 参考 pysxt 项目的协议实现
- 兼容小红书的 WebSocket 和 HTTP API
- AES ECB 加密算法与 Python 版本保持一致

## 核心组件

### 1. 消息段类型 (MessageSegment)
```typescript
- text: 文本消息段
- image: 图片消息段
- video: 视频消息段
- voice: 语音消息段
- card: 卡片消息段
- note: 笔记消息段
- emoticon: 表情消息段
- at: @ 提及消息段
```

### 2. 主要类
- **Redote**: 主机器人类
- **RedoteWebSocketClient**: WebSocket 客户端
- **MessageBuilder**: 消息构建器
- **MessageParser**: 消息解析器
- **MessageChainUtils**: 消息链工具类
- **RedoteCrypto**: 加密工具类

### 3. 事件系统
```typescript
// 统一消息事件
bot.on('message', (event) => {
  // event.messageId: 消息 ID
  // event.userId: 发送者用户 ID
  // event.userName: 发送者用户名
  // event.timestamp: 消息时间戳
  // event.chain: 消息链
  // event.reply(): 回复函数
  // event.raw: 原始 WebSocket 消息
});

// 连接事件
bot.on('connected', () => {});
bot.on('disconnected', () => {});
bot.on('reconnecting', () => {});
bot.on('error', (error) => {});
```

## API 使用示例

### 基础使用
```typescript
import { Redote, MessageBuilder, MessageParser } from './src/index.js';

const bot = new Redote({
  cookies: {
    'web_session': 'your_session_token',
    'xsecappid': 'xhs-pc-web',
  },
});

await bot.initialize();

bot.on('message', async (event) => {
  // 检查文本消息
  if (MessageParser.hasSegmentType(event.chain, 'text')) {
    const text = MessageParser.getTextContent(event.chain);
    await event.reply(`回显: ${text}`);
  }
  
  // 检查图片消息
  if (MessageParser.hasSegmentType(event.chain, 'image')) {
    await event.reply('收到图片！');
  }
});

await bot.start();
```

### 消息链构建
```typescript
// 简单文本
const textChain = MessageBuilder.fromString('Hello world!');

// 复合消息
const complexChain = MessageBuilder.fromSegments(
  MessageBuilder.text('Hello '),
  MessageBuilder.at('user123', 'Alice'),
  MessageBuilder.text('! 看看这个：'),
  MessageBuilder.image({ file: './image.png' })
);

// 发送消息链
await bot.sendMessageChain(receiverId, complexChain);
```

### 消息解析
```typescript
// 获取纯文本内容
const textContent = MessageParser.getTextContent(chain);

// 检查消息类型
const hasImages = MessageParser.hasSegmentType(chain, 'image');

// 获取特定类型的段
const imageSegments = MessageParser.getSegmentsByType(chain, 'image');

// 转换为纯文本（用于日志）
const plainText = MessageParser.chainToText(chain);
```

## 项目结构

```
src/
├── types.ts           # 类型定义和 Zod 模式
├── crypto.ts          # 加密工具类
├── logger.ts          # 日志系统
├── message.ts         # 消息链相关类
├── websocket-client.ts # WebSocket 客户端
├── redote.ts          # 主要机器人类
└── index.ts           # 导出入口

examples/
├── basic-bot.ts       # 基础回显机器人示例
└── advanced-bot.ts    # 高级命令机器人示例
```

## 配置要求

### 必需的 cookies
从小红书网页版获取以下 cookies：
- `web_session`: 会话令牌
- `xsecappid`: 应用 ID (通常是 'xhs-pc-web')
- 其他会话相关的 cookies

### 获取方法
1. 打开小红书网页版
2. F12 开发者工具 -> Network 标签
3. 访问消息界面
4. 查找对 `sxt.xiaohongshu.com` 的请求
5. 复制请求头中的 cookies

## 开发命令

```bash
# 安装依赖
bun install

# 开发模式（自动重载）
bun run dev

# 运行示例
bun run examples/basic-bot.ts

# 类型检查
bun run type-check

# 代码检查
bun run lint

# 构建
bun run build
```

## 与 pysxt 的差异

### 架构改进
1. **消息链架构**: 使用消息段组合，而不是单一消息类型
2. **统一事件**: 所有消息通过 `message` 事件处理
3. **类型安全**: 完整的 TypeScript 类型定义
4. **现代化**: ES 模块、异步/等待、Promise

### 协议保持一致
1. **加密算法**: AES ECB 加密与 Python 版本兼容
2. **API 端点**: 保持相同的 URL 和参数
3. **WebSocket 协议**: 消息格式和处理逻辑一致
4. **认证方式**: cookies 和 token 处理方式相同

## 注意事项

1. **Cookie 安全**: 不要在代码中硬编码真实的 cookies
2. **频率限制**: 注意小红书的 API 调用频率限制
3. **合规使用**: 确保符合小红书的服务条款
4. **错误处理**: 框架内置了重连和错误恢复机制

## 扩展性

框架设计支持：
- 自定义消息段类型
- 插件系统扩展
- 中间件支持
- 多机器人实例管理

这个框架提供了现代化的开发体验，同时保持了与小红书协议的完全兼容性。