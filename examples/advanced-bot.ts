import { Redote, MessageBuilder, MessageParser, MessageChainUtils, logger, LogLevel } from '../src/index.js';

// Enable debug logging
logger.setLevel(LogLevel.DEBUG);

// Bot configuration
const config = {
  cookies: {
    // Add your actual cookies here
    'web_session': 'your_session_token',
    'xsecappid': 'xhs-pc-web',
  },
  platform: 1,
  contactWay: 'octopus',
  timeout: 60,
};

class AdvancedBot {
  private bot: Redote;
  private userSessions = new Map<string, { lastMessage: Date; messageCount: number }>();

  constructor(config: any) {
    this.bot = new Redote(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // 统一消息处理
    this.bot.on('message', async (event) => {
      const { userId, userName, chain } = event;
      
      // 更新用户会话
      this.updateUserSession(userId);

      logger.info(`收到来自 ${userName || userId} 的消息:`, MessageParser.chainToText(chain));

      // 处理命令（如果消息以 / 开头）
      const textContent = MessageParser.getTextContent(chain);
      if (textContent.startsWith('/')) {
        await this.handleCommand(event, textContent);
        return;
      }

      // 处理不同类型的消息
      await this.handleMessage(event);
    });

    // Connection event handlers
    this.bot.on('connected', () => {
      logger.info('🟢 高级机器人连接成功');
    });

    this.bot.on('disconnected', () => {
      logger.warn('🔴 高级机器人已断开连接');
    });

    this.bot.on('error', (error) => {
      logger.error('❌ 高级机器人错误:', error);
    });
  }

  private updateUserSession(userId: string): void {
    const session = this.userSessions.get(userId) || { lastMessage: new Date(), messageCount: 0 };
    session.lastMessage = new Date();
    session.messageCount++;
    this.userSessions.set(userId, session);
  }

  private async handleCommand(event: any, command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).toLowerCase().split(' ');

    switch (cmd) {
      case 'help':
        await this.sendHelpMessage(event);
        break;

      case 'stats':
        await this.sendUserStats(event);
        break;

      case 'time':
        await event.reply(`🕐 当前时间: ${new Date().toLocaleString()}`);
        break;

      case 'echo':
        const text = args.join(' ');
        await event.reply(text || '回显: (空消息)');
        break;

      case 'ping':
        await event.reply('🏓 Pong!');
        break;

      case 'chain':
        // 演示消息链构建
        const demoChain = MessageBuilder.fromSegments(
          MessageBuilder.text('这是一个消息链示例: '),
          MessageBuilder.text('文本消息'),
          MessageBuilder.text(' + '),
          MessageBuilder.emoticon('smile', { name: '😊' })
        );
        await event.reply(demoChain);
        break;

      default:
        await event.reply(`❓ 未知命令: ${cmd}. 输入 /help 查看可用命令`);
    }
  }

  private async handleMessage(event: any): Promise<void> {
    const { chain } = event;
    const textContent = MessageParser.getTextContent(chain).toLowerCase();

    // 检查是否包含图片
    if (MessageParser.hasSegmentType(chain, 'image')) {
      const imageSegments = MessageParser.getSegmentsByType(chain, 'image');
      await event.reply(`🖼️ 收到了 ${imageSegments.length} 张图片！很漂亮！`);
    }

    // 检查是否包含笔记
    if (MessageParser.hasSegmentType(chain, 'note')) {
      await event.reply('📝 感谢分享笔记！');
    }

    // 检查是否包含卡片
    if (MessageParser.hasSegmentType(chain, 'card')) {
      await event.reply('📇 收到卡片内容，谢谢分享！');
    }

    // 基于关键词的智能回复
    if (textContent.includes('hello') || textContent.includes('hi') || textContent.includes('你好')) {
      const greeting = MessageBuilder.fromSegments(
        MessageBuilder.text('👋 你好！'),
        MessageBuilder.text('有什么可以帮助你的吗？')
      );
      await event.reply(greeting);
    } else if (textContent.includes('thank') || textContent.includes('谢谢')) {
      await event.reply('😊 不客气！很高兴能帮到你！');
    } else if (textContent.includes('bye') || textContent.includes('再见')) {
      await event.reply('👋 再见！祝你度过美好的一天！');
    } else if (MessageParser.hasSegmentType(chain, 'text')) {
      // 默认回复
      await event.reply(`我收到了你的消息: "${MessageParser.chainToText(chain)}". 输入 /help 查看我能做什么！`);
    }
  }

  private async sendHelpMessage(event: any): Promise<void> {
    const helpChain = MessageBuilder.fromSegments(
      MessageBuilder.text('🤖 **机器人命令**\n\n'),
      MessageBuilder.text('/help - 显示此帮助信息\n'),
      MessageBuilder.text('/stats - 显示你的消息统计\n'),
      MessageBuilder.text('/time - 获取当前时间\n'),
      MessageBuilder.text('/echo <文本> - 回显你的文本\n'),
      MessageBuilder.text('/ping - 测试机器人响应\n'),
      MessageBuilder.text('/chain - 演示消息链\n\n'),
      MessageBuilder.text('你也可以直接和我聊天！'),
      MessageBuilder.emoticon('smile', { name: '😊' })
    );

    await event.reply(helpChain);
  }

  private async sendUserStats(event: any): Promise<void> {
    const session = this.userSessions.get(event.userId);
    if (!session) {
      await event.reply('📊 暂无统计数据，多发些消息吧！');
      return;
    }

    const statsChain = MessageBuilder.fromSegments(
      MessageBuilder.text('📊 **你的统计数据**\n\n'),
      MessageBuilder.text(`总消息数: ${session.messageCount}\n`),
      MessageBuilder.text(`最后消息时间: ${session.lastMessage.toLocaleString()}`)
    );

    await event.reply(statsChain);
  }

  async start(): Promise<void> {
    await this.bot.initialize();
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }
}

async function main(): Promise<void> {
  const advancedBot = new AdvancedBot(config);

  try {
    await advancedBot.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 正在关闭高级机器人...');
      await advancedBot.stop();
      process.exit(0);
    });

    logger.info('🚀 高级机器人正在运行，按 Ctrl+C 停止');

  } catch (error) {
    logger.error('💥 启动高级机器人失败:', error);
    process.exit(1);
  }
}

// Run the advanced bot
main().catch((error) => {
  logger.error('💥 未处理的错误:', error);
  process.exit(1);
});