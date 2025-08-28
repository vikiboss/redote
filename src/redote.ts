import EventEmitter from 'eventemitter3'
import { readFileSync } from 'node:fs'
import { RedoteWebSocketClient } from './websocket-client.js'
import { RedoteCrypto } from './crypto.js'
import { logger } from './logger.js'
import { MessageParser, MessageBuilder } from './message.js'
import {
  RedoteConfig,
  UserInfo,
  UserDetail,
  MessageData,
  ImageUploadResult,
  MessageType,
  UserStatus,
  BotEventMap,
  WebSocketMessage,
  MessageEvent,
  MessageChain,
} from './types.js'

// 常量定义
const DEFAULT_REQUEST_TIMEOUT = 60000
const DEFAULT_IMAGE_DIMENSIONS = { width: 800, height: 600 }
const UPLOADER_VERSION = '1'
const UPLOADER_SOURCE = 'web'

/**
 * 小红书机器人主类，提供消息发送、接收和管理功能
 */
export class Redote extends EventEmitter<BotEventMap> {
  private readonly config: RedoteConfig
  private readonly baseUrl = 'https://sxt.xiaohongshu.com/api-sxt/edith'
  private readonly headers: Record<string, string>

  private userInfo?: UserInfo
  private userDetail?: UserDetail
  private websocketClient?: RedoteWebSocketClient
  private isInitialized = false

  public readonly userId: string = ''
  public readonly sellerId: string = ''
  public readonly accountNo: string = ''

  /**
   * 创建 Redote 机器人实例
   * @param config 机器人配置
   */
  constructor(config: RedoteConfig) {
    super()

    // 先展开 config，再设置默认值，避免多次指定同一属性被覆盖
    this.config = {
      ...config,
      platform: config.platform ?? 1,
      contactWay: config.contactWay ?? 'octopus',
      timeout: config.timeout ?? 60,
      websocket: config.websocket ?? {},
    }

    if (!config.cookies) {
      throw new Error('cookies 配置不能为空')
    }

    this.headers = {
      authority: 'sxt.xiaohongshu.com',
      referer: 'https://sxt.xiaohongshu.com/im/multiCustomerService',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      'x-subsystem': 'sxt',
    }
  }

  /**
   * 初始化机器人，获取用户信息并建立 WebSocket 连接
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('机器人已经初始化，跳过重复初始化')
      return
    }

    try {
      logger.info('开始初始化机器人...')
      this.userInfo = await this.getUserInfo()
      this.userDetail = await this.getUserDetail(this.userInfo.data.account_no)

      // Update readonly properties through object assignment
      Object.assign(this, {
        userId: this.userInfo.data.b_user_id,
        sellerId: this.userDetail.data.flow_user.cs_provider_id,
        accountNo: this.userInfo.data.account_no,
      })

      // 由于 WebSocketClientConfig 类型要求各属性不能为 undefined，这里需要显式处理
      const websocketConfig: Record<string, any> = {
        ...this.config.websocket,
        userId: this.userId,
        sellerId: this.sellerId,
      }

      // 移除 undefined 属性，确保类型安全
      Object.keys(websocketConfig).forEach(key => {
        if (websocketConfig[key] === undefined) {
          delete websocketConfig[key]
        }
      })

      this.websocketClient = new RedoteWebSocketClient(websocketConfig as any)

      // 转发 WebSocket 事件到 bot 事件
      this.websocketClient.on('connected', () => this.emit('connected'))
      this.websocketClient.on('disconnected', () => this.emit('disconnected'))
      this.websocketClient.on('reconnecting', () => this.emit('reconnecting'))
      this.websocketClient.on('error', error => this.emit('error', error))

      // 处理原始消息并转换为统一的消息事件
      this.websocketClient.on('rawMessage', rawMessage => {
        this.handleRawMessage(rawMessage)
      })

      this.isInitialized = true
      logger.info(
        `机器人初始化成功 - 用户: ${this.userDetail.data.flow_user.name} [${this.userDetail.data.flow_user.status}]`
      )
    } catch (error) {
      logger.error('机器人初始化失败:', error)
      throw new Error(`机器人初始化失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 发送 HTTP 请求
   * @param url 请求 URL
   * @param options 请求选项
   * @returns Promise<T> 请求响应
   */
  private async request<T>(
    url: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT'
      params?: Record<string, string>
      body?: unknown
      headers?: Record<string, string>
    } = {}
  ): Promise<T> {
    const { method = 'GET', params, body, headers = {} } = options

    const fullUrl = new URL(url)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        fullUrl.searchParams.append(key, value)
      })
    }

    const requestHeaders: Record<string, string> = {
      ...this.headers,
      ...headers,
      cookie: this.config.cookies,
    }

    if (body) {
      requestHeaders['content-type'] = 'application/json'
    }

    // 修复 fetch 的 body 类型问题，避免 undefined
    const fetchBody = body ? JSON.stringify(body) : null

    const response = await fetch(fullUrl.toString(), {
      method,
      headers: requestHeaders,
      body: fetchBody,
      signal: AbortSignal.timeout(this.config.timeout * 1000),
    })

    if (!response.ok) {
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`
      logger.error(`请求失败: ${errorMessage}`, { url: fullUrl.toString(), method })
      const result = await response.json()
      console.error('错误详情:', result)
      throw new Error(errorMessage)
    }

    const result = await response.json()
    logger.debug(`请求成功: ${method} ${url}`, result)
    return result as T
  }

  private async getUserInfo(): Promise<UserInfo> {
    return this.request<UserInfo>(`${this.baseUrl}/ads/user/info`)
  }

  private async getUserDetail(accountNo: string): Promise<UserDetail> {
    return this.request<UserDetail>(`${this.baseUrl}/pc/flow/user/detail`, {
      params: {
        account_no: accountNo,
        contact_way: this.config.contactWay,
      },
    })
  }

  /**
   * 获取聊天列表
   * @param isActive 是否只获取活跃的聊天
   * @param limit 限制数量
   * @returns Promise<unknown> 聊天列表
   */
  async getChats(isActive = true, limit = 80): Promise<unknown> {
    this.ensureInitialized()
    return this.request(`${this.baseUrl}/chatline/chat`, {
      params: {
        porch_user_id: this.userId,
        limit: limit.toString(),
        is_active: isActive.toString(),
      },
    })
  }

  /**
   * 获取聊天消息
   * @param customerUserId 客户用户 ID
   * @param limit 限制数量
   * @returns Promise<unknown> 消息列表
   */
  async getChatMessages(customerUserId: string, limit = 20): Promise<unknown> {
    this.ensureInitialized()
    if (!customerUserId) {
      throw new Error('客户用户 ID 不能为空')
    }
    return this.request(`${this.baseUrl}/chatline/msg`, {
      params: {
        porch_user_id: this.userId,
        customer_user_id: customerUserId,
        limit: limit.toString(),
      },
    })
  }

  /**
   * 搜索聊天
   * @param query 搜索关键词
   * @returns Promise<unknown> 搜索结果
   */
  async searchChats(query: string): Promise<unknown> {
    this.ensureInitialized()
    if (!query.trim()) {
      throw new Error('搜索关键词不能为空')
    }
    return this.request(`${this.baseUrl}/chatline/chat/search`, {
      method: 'POST',
      params: { porch_user_id: this.userId },
      body: { query: query.trim(), key_type: 2 },
    })
  }

  /**
   * 切换用户状态
   * @param status 用户状态
   * @returns Promise<unknown> 切换结果
   */
  async switchStatus(status: UserStatus): Promise<unknown> {
    this.ensureInitialized()
    return this.request(`${this.baseUrl}/pc/chatline/user/switch_status`, {
      method: 'POST',
      body: {
        status,
        account_no: this.accountNo,
        contact_way: this.config.contactWay,
      },
    })
  }

  /**
   * 检查机器人是否已初始化
   * @throws {Error} 如果未初始化则抛出错误
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('机器人未初始化，请先调用 initialize() 方法')
    }
  }

  /**
   * 处理原始消息并转换为消息事件
   * @param rawMessage 原始 WebSocket 消息
   */
  private handleRawMessage(rawMessage: WebSocketMessage): void {
    try {
      const payload = rawMessage.data?.payload?.sixin_message
      if (!payload) {
        logger.debug('消息 payload 为空，跳过处理')
        return
      }

      const messageType = payload.message_type as MessageType
      const messageId = payload.message_id || 'unknown'
      const userId = payload.sender_user_id || 'unknown'
      const userName = payload.sender_name
      const timestamp = payload.create_time || Date.now()
      const content = payload.content || ''

      // 解析消息链
      const chain = MessageParser.parseMessage(messageType, content)

      // 创建回复函数
      const reply = async (replyContent: MessageChain | string): Promise<unknown> => {
        if (typeof replyContent === 'string') {
          return this.sendText(userId, replyContent)
        } else {
          return this.sendMessageChain(userId, replyContent)
        }
      }

      // 创建消息事件
      const messageEvent: MessageEvent = {
        messageId,
        userId,
        userName,
        timestamp,
        chain,
        raw: rawMessage,
        reply,
      }

      // 发送统一的消息事件
      this.emit('message', messageEvent)

      logger.debug(`处理消息事件: ${messageType} from ${userId}`, { chain })
    } catch (error) {
      logger.error('处理原始消息失败:', error)
      this.emit('error', error as Error)
    }
  }

  /**
   * 获取上传 Token
   * @param bizName 业务名称
   * @param scene 场景
   * @returns Promise<any> 上传 Token 信息
   */
  private async getUploadToken(bizName: string, scene: string): Promise<any> {
    return this.request(`${this.baseUrl}/uploader/v3/token`, {
      params: {
        biz_name: bizName,
        scene,
        file_count: '1',
        version: UPLOADER_VERSION,
        source: UPLOADER_SOURCE,
      },
    })
  }

  /**
   * 生成上传签名
   * @param startTime 开始时间
   * @param expireTime 过期时间
   * @param fileId 文件 ID
   * @param fileSize 文件大小
   * @returns string 签名
   */
  private makeQSignature(
    startTime: number,
    expireTime: number,
    fileId: string,
    fileSize: number
  ): string {
    const c = RedoteCrypto.hmacSha1('null', `${startTime};${expireTime}`)
    const x = RedoteCrypto.sha1Hash(
      `put\n/${fileId}\n\ncontent-length=${fileSize}&host=ros-upload.xiaohongshu.com\n`
    )
    const k = `sha1\n${startTime};${expireTime}\n${x}\n`
    return RedoteCrypto.hmacSha1(c, k)
  }

  /**
   * 上传图片文件
   * @param filePath 文件路径
   * @returns Promise<ImageUploadResult> 上传结果
   */
  async uploadImage(filePath: string): Promise<ImageUploadResult> {
    this.ensureInitialized()

    if (!filePath) {
      throw new Error('文件路径不能为空')
    }

    try {
      const bizName = 'cs'
      const scene = 'feeva_img'

      const uploadToken = await this.getUploadToken(bizName, scene)
      const uploadTempPermit = uploadToken.data.upload_temp_permits[0]
      const fileId = uploadTempPermit.file_ids[0]
      const expireTime = Math.floor(uploadTempPermit.expire_time / 1000)
      const startTime = expireTime - 86400

      const fileData = readFileSync(filePath)
      const fileSize = fileData.length

      if (fileSize === 0) {
        throw new Error('文件为空')
      }

      // 使用默认尺寸（未来可以集成图像处理库获取真实尺寸）
      const { width, height } = DEFAULT_IMAGE_DIMENSIONS

      const uploadUrl = `https://ros-upload.xiaohongshu.com/${fileId}`
      const signature = this.makeQSignature(startTime, expireTime, fileId, fileSize)

      const uploadHeaders = {
        accept: '*/*',
        authorization: `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${startTime};${expireTime}&q-key-time=${startTime};${expireTime}&q-header-list=content-length;host&q-url-param-list=&q-signature=${signature}`,
        'content-type': 'image/png',
        'content-length': fileSize.toString(),
        'x-cos-security-token': uploadTempPermit.token,
      }

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: fileData,
      })

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status} ${response.statusText}`)
      }

      logger.info(`图片上传成功: ${filePath}`)

      return {
        link: {
          cloudType: uploadTempPermit.cloud_type,
          bizName,
          scene,
          fileId,
          preViewUrl: response.headers.get('X-Ros-Preview-Url') || '',
        },
        size: { width, height },
      }
    } catch (error) {
      logger.error(`图片上传失败: ${filePath}`, error)
      throw new Error(`图片上传失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 发送消息的内部方法
   * @param receiverId 接收者 ID
   * @param content 消息内容
   * @param messageType 消息类型
   * @returns Promise<unknown> 发送结果
   */
  private async sendMessage(
    receiverId: string,
    content: string,
    messageType: MessageType
  ): Promise<unknown> {
    this.ensureInitialized()

    if (!receiverId) {
      throw new Error('接收者 ID 不能为空')
    }
    if (!content) {
      throw new Error('消息内容不能为空')
    }
    const messageData: MessageData = {
      sender_porch_id: this.userId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      uuid: RedoteCrypto.generateUuid(),
      c_user_id: this.userInfo!.data.c_user_id,
      platform: this.config.platform,
    }

    return this.request(`${this.baseUrl}/chatline/msg`, {
      method: 'POST',
      params: { porch_user_id: this.userId },
      body: messageData,
    })
  }

  /**
   * 发送文本消息
   * @param receiverId 接收者 ID
   * @param content 文本内容
   * @returns Promise<unknown> 发送结果
   */
  async sendText(receiverId: string, content: string): Promise<unknown> {
    return this.sendMessage(receiverId, content, MessageType.TEXT)
  }

  /**
   * 发送图片消息
   * @param receiverId 接收者 ID
   * @param filePath 图片文件路径
   * @returns Promise<unknown> 发送结果
   */
  async sendImage(receiverId: string, filePath: string): Promise<unknown> {
    const uploadResult = await this.uploadImage(filePath)
    return this.sendMessage(receiverId, JSON.stringify(uploadResult), MessageType.IMAGE)
  }

  /**
   * 发送笔记消息
   * @param receiverId 接收者 ID
   * @param noteId 笔记 ID
   * @returns Promise<unknown> 发送结果
   */
  async sendNote(receiverId: string, noteId: string): Promise<unknown> {
    return this.sendMessage(receiverId, noteId, MessageType.NOTE)
  }

  /**
   * 发送卡片消息
   * @param receiverId 接收者 ID
   * @param card 卡片内容
   * @returns Promise<unknown> 发送结果
   */
  async sendCard(receiverId: string, card: string): Promise<unknown> {
    return this.sendMessage(receiverId, card, MessageType.CARD)
  }

  /**
   * 发送消息链
   * @param receiverId 接收者 ID
   * @param chain 消息链
   * @returns Promise<unknown[]> 发送结果数组
   */
  async sendMessageChain(receiverId: string, chain: MessageChain): Promise<unknown[]> {
    const results: unknown[] = []

    for (const segment of chain) {
      try {
        let result: unknown

        switch (segment.type) {
          case 'text':
            result = await this.sendText(receiverId, segment.data.text)
            break

          case 'image':
            if (segment.data.file) {
              result = await this.sendImage(receiverId, segment.data.file)
            } else {
              // 如果没有文件路径，暂时作为文本发送 URL
              result = await this.sendText(receiverId, segment.data.url || '[图片]')
            }
            break

          case 'card':
            result = await this.sendCard(receiverId, segment.data.content)
            break

          case 'note':
            result = await this.sendNote(receiverId, segment.data.noteId)
            break

          case 'emoticon':
            // 表情消息作为文本发送
            result = await this.sendText(receiverId, segment.data.name || '[表情]')
            break

          case 'at':
            // @ 消息作为文本发送
            result = await this.sendText(receiverId, `@${segment.data.name || segment.data.userId}`)
            break

          default:
            // 未知类型作为文本发送
            result = await this.sendText(receiverId, '[未知消息类型]')
        }

        results.push(result)
      } catch (error) {
        logger.error(`发送消息段失败: ${segment.type}`, error)
        results.push({ error: error instanceof Error ? error.message : String(error) })
      }
    }

    return results
  }

  /**
   * 启动机器人，开始监听消息
   */
  async start(): Promise<void> {
    this.ensureInitialized()

    if (!this.websocketClient) {
      throw new Error('机器人未初始化，请先调用 initialize() 方法')
    }

    logger.info('启动消息监听器...')
    await this.websocketClient.connect()
  }

  /**
   * 停止机器人，断开 WebSocket 连接
   */
  async stop(): Promise<void> {
    if (this.websocketClient) {
      await this.websocketClient.disconnect()
    }
    this.isInitialized = false
    logger.info('机器人已停止')
  }
}
