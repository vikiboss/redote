import WebSocket from 'ws'
import EventEmitter from 'eventemitter3'
import { logger } from './logger.js'
import { RedoteCrypto } from './crypto.js'
import type { WebSocketMessage, BotEventMap } from './types.js'

interface WebSocketClientConfig {
  userId: string
  sellerId: string
  uri?: string
  appId?: string
  token?: string
  appName?: string
  appVersion?: string
  retryInterval?: number
}

export class RedoteWebSocketClient extends EventEmitter<BotEventMap> {
  private readonly config: Required<WebSocketClientConfig>
  private websocket: WebSocket | null = null
  private seq = 0
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isConnecting = false
  private shouldReconnect = true

  constructor(config: WebSocketClientConfig) {
    super()

    this.config = {
      uri: 'wss://zelda.xiaohongshu.com/websocketV2',
      appId: '647e8f23d15d890d5cc02700',
      token: '7f54749ef19aaf9966ed7a616982c016bda5dfba',
      appName: 'walle-ad',
      appVersion: '0.21.0',
      retryInterval: 3,
      ...config,
    }
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.websocket?.readyState === WebSocket.OPEN) {
      return
    }

    this.isConnecting = true
    this.emit('reconnecting')

    try {
      this.websocket = new WebSocket(this.config.uri)
      this.setupEventHandlers()

      await new Promise<void>((resolve, reject) => {
        if (!this.websocket) {
          reject(new Error('WebSocket creation failed'))
          return
        }

        this.websocket.once('open', () => {
          this.isConnecting = false
          logger.info('WebSocket connection established')
          this.emit('connected')
          this.sendAuthMessage()
          resolve()
        })

        this.websocket.once('error', error => {
          this.isConnecting = false
          reject(error)
        })
      })
    } catch (error) {
      this.isConnecting = false
      logger.error('Failed to connect:', error)
      this.emit('error', error as Error)

      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.websocket) return

    this.websocket.on('message', data => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage
        logger.debug('< Received:', message)
        this.handleMessage(message)
      } catch (error) {
        logger.error('Failed to parse message:', error)
      }
    })

    this.websocket.on('close', () => {
      logger.debug('WebSocket connection closed')
      this.emit('disconnected')
      this.cleanup()

      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    })

    this.websocket.on('error', error => {
      logger.error('WebSocket error:', error)
      this.emit('error', error)
    })
  }

  private async sendAuthMessage(): Promise<void> {
    await this.send({
      type: 1,
      token: this.config.token,
      appId: this.config.appId,
    })
  }

  private async send(data: Partial<WebSocketMessage>): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    if (typeof data.type !== 'number') {
      throw new Error('WebSocketMessage 缺少必需的 type 字段')
    }

    const message: WebSocketMessage = {
      type: data.type,
      ...data,
      seq: ++this.seq,
    }

    this.websocket.send(JSON.stringify(message))
    logger.debug('> Sent:', message)
  }

  private async handleMessage(message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 2: // Server requires ACK
        await this.send({ type: 130, ack: message.seq })

        if (message.data?.type === 'PUSH_SIXINTONG_MSG') {
          // 统一发送 message 事件，而不是按类型分发
          this.emit('rawMessage', message)
        }
        break

      case 4: // Keep-alive ping
        await this.send({ type: 132 })
        break

      case 129: // Server returns secureKey
        await this.send({
          type: 10,
          topic: RedoteCrypto.aesEcbEncrypt(message.secureKey!, this.config.userId),
          encrypt: true,
        })
        break

      case 132: // Server heartbeat response
        this.startHeartbeat(60000)
        break

      case 138: // Server requests userAgent & additionalInfo
        await this.send({
          type: 12,
          data: {
            userAgent: {
              appName: this.config.appName,
              appVersion: this.config.appVersion,
            },
            additionalInfo: {
              userId: this.config.userId,
              sellerId: this.config.sellerId,
            },
          },
        })
        break

      case 140: // Extended heartbeat
        this.startHeartbeat(30000)
        break

      default:
        logger.warn(`Unknown message type: ${message.type}`, message)
    }
  }

  private startHeartbeat(interval: number): void {
    this.clearHeartbeat()

    this.heartbeatTimer = setTimeout(async () => {
      try {
        await this.send({ type: 4 })
      } catch (error) {
        logger.error('Heartbeat failed:', error)
      }
    }, interval)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      logger.info(`Reconnecting in ${this.config.retryInterval}s...`)
      this.connect()
    }, this.config.retryInterval * 1000)
  }

  private cleanup(): void {
    this.seq = 0
    this.clearHeartbeat()
    this.websocket = null
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.clearHeartbeat()

    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }
}
