# Redote

Modern TypeScript framework for Xiaohongshu (RedBook) direct message bot development.

## Features

- 🚀 **Modern TypeScript**: Built with TypeScript and modern ES modules
- 🔄 **Auto-reconnection**: Robust WebSocket connection with automatic reconnection
- 📝 **Type Safety**: Full type definitions with Zod schema validation
- 🎯 **Event-driven**: Clean event-based architecture using EventEmitter
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- 📦 **Zero Config**: Works out of the box with sensible defaults
- 🔧 **Extensible**: Easy to extend and customize for your needs

## Installation

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build project
bun run build

# Run production
bun run start
```

## Quick Start

```typescript
import { Redote, MessageBuilder, MessageParser, logger } from './src/index.js';

const bot = new Redote({
  cookies: {
    'web_session': 'your_session_token',
    'xsecappid': 'xhs-pc-web',
    // Add other required cookies...
  },
});

// Initialize and start the bot
await bot.initialize();

// Handle all messages with unified event (similar to oicq)
bot.on('message', async (event) => {
  console.log(`收到消息 from ${event.userId}:`, MessageParser.chainToText(event.chain));
  
  // Check if message contains text
  if (MessageParser.hasSegmentType(event.chain, 'text')) {
    const textContent = MessageParser.getTextContent(event.chain);
    await event.reply(`Echo: ${textContent}`);
  }
  
  // Check for images
  if (MessageParser.hasSegmentType(event.chain, 'image')) {
    await event.reply('I received your image! 📸');
  }
});

// Start listening for messages
await bot.start();
```

## Configuration

### Basic Configuration

```typescript
const config = {
  cookies: {
    // Required: Your Xiaohongshu session cookies
    'web_session': 'your_session_token',
    'xsecappid': 'xhs-pc-web',
  },
  platform: 1, // Platform ID (default: 1)
  contactWay: 'octopus', // Contact method (default: 'octopus')
  timeout: 60, // Request timeout in seconds (default: 60)
  websocket: {
    uri: 'wss://zelda.xiaohongshu.com/websocketV2', // WebSocket URI
    retryInterval: 3, // Reconnection interval in seconds
    appId: '647e8f23d15d890d5cc02700', // App ID
    token: '7f54749ef19aaf9966ed7a616982c016bda5dfba', // Token
    appName: 'walle-ad', // App name
    appVersion: '0.21.0', // App version
  },
};
```

## Message Chain Architecture

The framework uses a message chain architecture similar to oicq, where messages are composed of different segments:

### Message Segment Types

- `text` - Text content
- `image` - Image files
- `video` - Video files  
- `voice` - Voice messages
- `card` - Card content
- `note` - Note sharing
- `emoticon` - Emoji/sticker messages
- `at` - @ mentions

### Message Chain Examples

```typescript
// Create message segments
const textSegment = MessageBuilder.text('Hello world!');
const imageSegment = MessageBuilder.image({ file: './image.png' });
const atSegment = MessageBuilder.at('user123', 'Username');

// Build message chain
const messageChain = MessageBuilder.fromSegments(
  MessageBuilder.text('Hello '),
  MessageBuilder.at('user123', 'Alice'),
  MessageBuilder.text('! Check this out:'),
  MessageBuilder.image({ file: './cool-image.png' })
);

// Send message chain
await bot.sendMessageChain(receiverId, messageChain);

// Parse and analyze message chains
const textContent = MessageParser.getTextContent(messageChain);
const hasImages = MessageParser.hasSegmentType(messageChain, 'image');
const imageSegments = MessageParser.getSegmentsByType(messageChain, 'image');

// Convert message chain to plain text for logging
const plainText = MessageParser.chainToText(messageChain);
console.log('Message:', plainText);
```

### Message Chain Utilities

```typescript
import { MessageChainUtils } from './src/index.js';

// Check if chain is empty
const isEmpty = MessageChainUtils.isEmpty(chain);

// Check if chain contains only text
const isTextOnly = MessageChainUtils.isTextOnly(chain);

// Merge multiple chains
const merged = MessageChainUtils.merge(chain1, chain2, chain3);

// Filter chain segments
const textOnly = MessageChainUtils.filter(chain, seg => seg.type === 'text');

// Clone a chain
const cloned = MessageChainUtils.clone(originalChain);
```

## API Reference

### Bot Methods

#### `async initialize(): Promise<void>`
Initialize the bot with user information and WebSocket client.

#### `async start(): Promise<void>`
Start the WebSocket connection and begin listening for messages.

#### `async stop(): Promise<void>`
Stop the bot and close all connections.

#### `async sendText(receiverId: string, content: string): Promise<unknown>`
Send a text message to a user.

#### `async sendImage(receiverId: string, filePath: string): Promise<unknown>`
Send an image file to a user.

#### `async sendNote(receiverId: string, noteId: string): Promise<unknown>`
Share a note with a user.

#### `async sendMessageChain(receiverId: string, chain: MessageChain): Promise<unknown[]>`
Send a message chain to a user.

#### `async getChats(isActive?: boolean, limit?: number): Promise<unknown>`
Get chat list.

#### `async getChatMessages(customerUserId: string, limit?: number): Promise<unknown>`
Get messages from a specific chat.

### Events

#### Unified Message Event (Similar to oicq)
```typescript
bot.on('message', (event) => {
  // event.messageId - Message ID
  // event.userId - Sender user ID  
  // event.userName - Sender name
  // event.timestamp - Message timestamp
  // event.chain - Message chain (array of segments)
  // event.raw - Raw WebSocket message
  // event.reply() - Reply function
  
  // Check message content
  if (MessageParser.hasSegmentType(event.chain, 'text')) {
    const text = MessageParser.getTextContent(event.chain);
    console.log('Text content:', text);
  }
  
  // Reply to user
  await event.reply('Hello back!');
  
  // Reply with message chain
  const replyChain = MessageBuilder.fromSegments(
    MessageBuilder.text('Thanks for your message!'),
    MessageBuilder.emoticon('smile')
  );
  await event.reply(replyChain);
});
```

#### Connection Events
```typescript
bot.on('connected', () => {
  // WebSocket connected
});

bot.on('disconnected', () => {
  // WebSocket disconnected
});

bot.on('reconnecting', () => {
  // WebSocket reconnecting
});

bot.on('error', (error) => {
  // Handle errors
});
```

## Examples

### Basic Echo Bot with Message Chain

```typescript
import { Redote, MessageBuilder, MessageParser } from './src/index.js';

const bot = new Redote({ cookies: { /* your cookies */ } });
await bot.initialize();

bot.on('message', async (event) => {
  console.log(`Message from ${event.userId}:`, MessageParser.chainToText(event.chain));
  
  // Echo text messages
  if (MessageParser.hasSegmentType(event.chain, 'text')) {
    const textContent = MessageParser.getTextContent(event.chain);
    await event.reply(`Echo: ${textContent}`);
  }
  
  // Handle images
  if (MessageParser.hasSegmentType(event.chain, 'image')) {
    const replyChain = MessageBuilder.fromSegments(
      MessageBuilder.text('Nice image! '),
      MessageBuilder.emoticon('heart', { name: '❤️' })
    );
    await event.reply(replyChain);
  }
});

await bot.start();
```

### Command Bot with Message Chain

```typescript
bot.on('message', async (event) => {
  const textContent = MessageParser.getTextContent(event.chain);
  
  if (textContent.startsWith('/')) {
    const [cmd, ...args] = textContent.slice(1).split(' ');
    
    switch (cmd) {
      case 'time':
        await event.reply(`Current time: ${new Date().toLocaleString()}`);
        break;
        
      case 'help':
        const helpChain = MessageBuilder.fromSegments(
          MessageBuilder.text('Available commands:\n'),
          MessageBuilder.text('/time - Get current time\n'),
          MessageBuilder.text('/help - Show this help'),
          MessageBuilder.emoticon('info', { name: 'ℹ️' })
        );
        await event.reply(helpChain);
        break;
        
      case 'echo':
        const echoText = args.join(' ');
        await event.reply(echoText || 'Nothing to echo!');
        break;
    }
  }
});
```

## Getting Cookies

To use this framework, you'll need to obtain session cookies from Xiaohongshu:

1. Open Xiaohongshu in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Navigate to the messaging interface
5. Look for requests to `sxt.xiaohongshu.com`
6. Copy the cookies from the request headers

Required cookies typically include:
- `web_session`
- `xsecappid`
- Other session-related cookies

## Development

```bash
# Install dependencies
bun install

# Run in development mode with auto-reload
bun run dev

# Type checking
bun run type-check

# Linting
bun run lint

# Build for production
bun run build
```

## Architecture

The framework consists of several key components:

- **Redote**: Main bot class that orchestrates everything
- **RedoteWebSocketClient**: Handles WebSocket communication
- **RedoteCrypto**: Cryptographic utilities for message encryption
- **Logger**: Configurable logging system
- **Types**: Full TypeScript type definitions

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This framework is for educational and development purposes. Please ensure you comply with Xiaohongshu's Terms of Service when using this framework.
