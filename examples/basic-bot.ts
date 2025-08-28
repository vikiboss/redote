import { Redote, MessageBuilder, MessageParser, logger, LogLevel } from '../src/index.js'

// Enable debug logging
logger.setLevel(LogLevel.DEBUG)

// Bot configuration
const config = {
  cookies: process.env.XHS_COOKIE || '',
  platform: 1,
  contactWay: 'octopus',
  timeout: 60,
  websocket: {
    retryInterval: 3,
  },
}

async function main(): Promise<void> {
  const bot = new Redote(config)

  try {
    // Initialize the bot
    await bot.initialize()

    // Handle all messages with unified event
    bot.on('message', async event => {
      logger.info(`收到消息 from ${event.userId}:`, MessageParser.chainToText(event.chain))

      // 检查是否包含文本消息
      if (MessageParser.hasSegmentType(event.chain, 'text')) {
        const textContent = MessageParser.getTextContent(event.chain)

        // 简单的回显功能
        await event.reply(`回显: ${textContent}`)
      }

      // 检查是否包含图片
      if (MessageParser.hasSegmentType(event.chain, 'image')) {
        await event.reply('我收到了你的图片! 📸')
      }

      // 检查是否包含其他类型的消息
      if (MessageParser.hasSegmentType(event.chain, 'card')) {
        await event.reply('感谢分享卡片内容!')
      }

      if (MessageParser.hasSegmentType(event.chain, 'note')) {
        await event.reply('收到笔记分享，谢谢!')
      }
    })

    // Handle connection events
    bot.on('connected', () => {
      logger.info('✅ 机器人已连接到 WebSocket')
    })

    bot.on('disconnected', () => {
      logger.warn('❌ 机器人已断开 WebSocket 连接')
    })

    bot.on('reconnecting', () => {
      logger.info('🔄 机器人正在重连...')
    })

    bot.on('error', error => {
      logger.error('💥 机器人错误:', error)
    })

    // Start the bot
    await bot.start()

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 正在关闭机器人...')
      await bot.stop()
      process.exit(0)
    })

    logger.info('🚀 机器人正在运行，按 Ctrl+C 停止')
  } catch (error) {
    logger.error('💥 启动机器人失败:', error)
    process.exit(1)
  }
}

// Run the bot
main().catch(error => {
  logger.error('💥 未处理的错误:', error)
  process.exit(1)
})
