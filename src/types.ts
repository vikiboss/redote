import { z } from 'zod'

// 消息段类型定义
export const MessageSegmentType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  VOICE: 'voice',
  CARD: 'card',
  NOTE: 'note',
  EMOTICON: 'emoticon',
  AT: 'at',
} as const

export type MessageSegmentType = (typeof MessageSegmentType)[keyof typeof MessageSegmentType]

// 原始消息类型（保持与 pysxt 兼容）
export const MessageType = {
  TEXT: 'TEXT',
  EMOTICON: 'EMOTICON',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  VOICE: 'VOICE',
  CARD: 'CARD',
  NOTE: 'NOTE',
  HINT: 'HINT',
  RICH_HINT: 'RICH_HINT',
  SMILES: 'SMILES',
  GOODS_DETAIL: 'GOODS_DETAIL',
  GOODS_CARD: 'GOODS_CARD',
  COMMON: 'COMMON',
  GENERAL_CARD: 'GENERAL_CARD',
  LIVE_CARD: 'LIVE_CARD',
  SERVICE_CARD: 'SERVICE_CARD',
  BUSINESS_CARD: 'BUSINESS_CARD',
  WELCOME: 'WELCOME',
  PURCHASE_COMMENTS: 'PURCHASE_COMMENTS',
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

export const WebSocketMessageTypeSchema = z.object({
  type: z.number(),
  seq: z.number().optional(),
  ack: z.number().optional(),
  token: z.string().optional(),
  appId: z.string().optional(),
  topic: z.string().optional(),
  encrypt: z.boolean().optional(),
  secureKey: z.string().optional(),
  data: z.any().optional(),
})

export type WebSocketMessage = z.infer<typeof WebSocketMessageTypeSchema>

export const UserInfoSchema = z.object({
  data: z.object({
    c_user_id: z.string(),
    b_user_id: z.string(),
    account_no: z.string(),
  }),
})

export type UserInfo = z.infer<typeof UserInfoSchema>

export const UserDetailSchema = z.object({
  data: z.object({
    flow_user: z.object({
      cs_provider_id: z.string(),
      status: z.string(),
      name: z.string(),
    }),
  }),
})

export type UserDetail = z.infer<typeof UserDetailSchema>

export const MessageDataSchema = z.object({
  sender_porch_id: z.string(),
  receiver_id: z.string(),
  content: z.string(),
  message_type: z.string(),
  uuid: z.string(),
  c_user_id: z.string(),
  platform: z.number(),
})

export type MessageData = z.infer<typeof MessageDataSchema>

export const ImageUploadResultSchema = z.object({
  link: z.object({
    cloudType: z.string(),
    bizName: z.string(),
    scene: z.string(),
    fileId: z.string(),
    preViewUrl: z.string(),
  }),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }),
})

export type ImageUploadResult = z.infer<typeof ImageUploadResultSchema>

export const RedoteConfigSchema = z.object({
  cookies: z.string(),
  platform: z.number().default(1),
  contactWay: z.string().default('octopus'),
  timeout: z.number().default(60),
  websocket: z
    .object({
      uri: z.string().default('wss://zelda.xiaohongshu.com/websocketV2'),
      appId: z.string().default('647e8f23d15d890d5cc02700'),
      token: z.string().default('7f54749ef19aaf9966ed7a616982c016bda5dfba'),
      appName: z.string().default('walle-ad'),
      appVersion: z.string().default('0.21.0'),
      retryInterval: z.number().default(3),
    })
    .partial(),
})

export type RedoteConfig = z.infer<typeof RedoteConfigSchema>

export const UserStatusSchema = z.enum(['online', 'rest', 'offline'])
export type UserStatus = z.infer<typeof UserStatusSchema>

// 消息段基础接口
export interface MessageSegmentBase {
  type: MessageSegmentType
  data: Record<string, any>
}

// 文本消息段
export interface TextSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.TEXT
  data: {
    text: string
  }
}

// 图片消息段
export interface ImageSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.IMAGE
  data: {
    file?: string // 本地文件路径
    url?: string // 图片 URL
    width?: number
    height?: number
    size?: number
  }
}

// 视频消息段
export interface VideoSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.VIDEO
  data: {
    file?: string
    url?: string
    duration?: number
    size?: number
  }
}

// 语音消息段
export interface VoiceSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.VOICE
  data: {
    file?: string
    url?: string
    duration?: number
    size?: number
  }
}

// 卡片消息段
export interface CardSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.CARD
  data: {
    content: string
    cardType?: string
  }
}

// 笔记消息段
export interface NoteSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.NOTE
  data: {
    noteId: string
    title?: string
    content?: string
    url?: string
  }
}

// 表情消息段
export interface EmoticonSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.EMOTICON
  data: {
    id: string
    name?: string
    url?: string
  }
}

// @ 消息段
export interface AtSegment extends MessageSegmentBase {
  type: typeof MessageSegmentType.AT
  data: {
    userId: string
    name?: string
  }
}

// 联合消息段类型
export type MessageSegment =
  | TextSegment
  | ImageSegment
  | VideoSegment
  | VoiceSegment
  | CardSegment
  | NoteSegment
  | EmoticonSegment
  | AtSegment

// 消息链
export interface MessageChain extends Array<MessageSegment> {}

// 消息事件
export interface MessageEvent {
  messageId: string
  userId: string
  userName?: string
  timestamp: number
  chain: MessageChain
  raw: WebSocketMessage // 原始消息数据
  reply: (chain: MessageChain | string) => Promise<unknown>
  recall?: () => Promise<unknown>
}

// 机器人事件映射
export interface BotEventMap {
  message: (event: MessageEvent) => void | Promise<void>
  rawMessage: (message: WebSocketMessage) => void | Promise<void> // 原始消息事件
  error: (error: Error) => void | Promise<void>
  connected: () => void | Promise<void>
  disconnected: () => void | Promise<void>
  reconnecting: () => void | Promise<void>
}
