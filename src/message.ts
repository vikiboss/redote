import type {
  MessageSegment,
  MessageChain,
  TextSegment,
  ImageSegment,
  VideoSegment,
  VoiceSegment,
  CardSegment,
  NoteSegment,
  EmoticonSegment,
  AtSegment,
  MessageSegmentType,
  MessageType,
} from './types.js';

/**
 * 消息段构造器
 */
export class MessageBuilder {
  /**
   * 创建文本消息段
   */
  static text(text: string): TextSegment {
    return {
      type: 'text',
      data: { text },
    };
  }

  /**
   * 创建图片消息段
   */
  static image(options: { file?: string; url?: string; width?: number; height?: number }): ImageSegment {
    return {
      type: 'image',
      data: options,
    };
  }

  /**
   * 创建视频消息段
   */
  static video(options: { file?: string; url?: string; duration?: number }): VideoSegment {
    return {
      type: 'video',
      data: options,
    };
  }

  /**
   * 创建语音消息段
   */
  static voice(options: { file?: string; url?: string; duration?: number }): VoiceSegment {
    return {
      type: 'voice',
      data: options,
    };
  }

  /**
   * 创建卡片消息段
   */
  static card(content: string, cardType?: string): CardSegment {
    const data: CardSegment['data'] = { content };
    if (cardType !== undefined) {
      data.cardType = cardType;
    }
    return {
      type: 'card',
      data,
    };
  }

  /**
   * 创建笔记消息段
   */
  static note(noteId: string, options?: { title?: string; content?: string; url?: string }): NoteSegment {
    return {
      type: 'note',
      data: { noteId, ...options },
    };
  }

  /**
   * 创建表情消息段
   */
  static emoticon(id: string, options?: { name?: string; url?: string }): EmoticonSegment {
    return {
      type: 'emoticon',
      data: { id, ...options },
    };
  }

  /**
   * 创建 @ 消息段
   */
  static at(userId: string, name?: string): AtSegment {
    const data: AtSegment['data'] = { userId };
    if (name !== undefined) {
      data.name = name;
    }
    return {
      type: 'at',
      data,
    };
  }

  /**
   * 从字符串创建消息链（纯文本）
   */
  static fromString(text: string): MessageChain {
    return [MessageBuilder.text(text)];
  }

  /**
   * 从消息段数组创建消息链
   */
  static fromSegments(...segments: MessageSegment[]): MessageChain {
    return segments;
  }
}

/**
 * 消息解析器 - 将原始消息转换为消息链
 */
export class MessageParser {
  /**
   * 解析原始消息为消息链
   */
  static parseMessage(messageType: MessageType, content: string): MessageChain {
    const chain: MessageChain = [];

    switch (messageType) {
      case 'TEXT':
        chain.push(MessageBuilder.text(content));
        break;

      case 'IMAGE':
        try {
          const imageData = JSON.parse(content);
          chain.push(MessageBuilder.image({
            url: imageData.link?.preViewUrl,
            width: imageData.size?.width,
            height: imageData.size?.height,
          }));
        } catch {
          // 如果解析失败，作为文本处理
          chain.push(MessageBuilder.text(content));
        }
        break;

      case 'VIDEO':
        try {
          const videoData = JSON.parse(content);
          chain.push(MessageBuilder.video({
            url: videoData.url,
            duration: videoData.duration,
          }));
        } catch {
          chain.push(MessageBuilder.text(content));
        }
        break;

      case 'VOICE':
        try {
          const voiceData = JSON.parse(content);
          chain.push(MessageBuilder.voice({
            url: voiceData.url,
            duration: voiceData.duration,
          }));
        } catch {
          chain.push(MessageBuilder.text(content));
        }
        break;

      case 'CARD':
        chain.push(MessageBuilder.card(content));
        break;

      case 'NOTE':
        chain.push(MessageBuilder.note(content));
        break;

      case 'EMOTICON':
        try {
          const emoticonData = JSON.parse(content);
          chain.push(MessageBuilder.emoticon(
            emoticonData.id || content,
            {
              name: emoticonData.name,
              url: emoticonData.url,
            }
          ));
        } catch {
          chain.push(MessageBuilder.emoticon(content));
        }
        break;

      default:
        // 未知类型作为文本处理
        chain.push(MessageBuilder.text(content));
    }

    return chain;
  }

  /**
   * 将消息链转换为纯文本
   */
  static chainToText(chain: MessageChain): string {
    return chain
      .map(segment => {
        switch (segment.type) {
          case 'text':
            return (segment as TextSegment).data.text;
          case 'image':
            return '[图片]';
          case 'video':
            return '[视频]';
          case 'voice':
            return '[语音]';
          case 'card':
            return '[卡片]';
          case 'note':
            return '[笔记]';
          case 'emoticon':
            return (segment as EmoticonSegment).data.name || '[表情]';
          case 'at':
            return `@${(segment as AtSegment).data.name || (segment as AtSegment).data.userId}`;
          default:
            return '[未知消息]';
        }
      })
      .join('');
  }

  /**
   * 检查消息链是否包含指定类型的消息段
   */
  static hasSegmentType(chain: MessageChain, type: MessageSegmentType): boolean {
    return chain.some(segment => segment.type === type);
  }

  /**
   * 获取消息链中指定类型的消息段
   */
  static getSegmentsByType<T extends MessageSegment>(
    chain: MessageChain,
    type: T['type']
  ): T[] {
    return chain.filter(segment => segment.type === type) as T[];
  }

  /**
   * 获取消息链中的纯文本内容
   */
  static getTextContent(chain: MessageChain): string {
    return MessageParser.getSegmentsByType(chain, 'text')
      .map(segment => (segment as TextSegment).data.text)
      .join('');
  }
}

/**
 * 消息链工具函数
 */
export class MessageChainUtils {
  /**
   * 检查消息链是否为空
   */
  static isEmpty(chain: MessageChain): boolean {
    return chain.length === 0;
  }

  /**
   * 检查消息链是否只包含文本
   */
  static isTextOnly(chain: MessageChain): boolean {
    return chain.every(segment => segment.type === 'text');
  }

  /**
   * 合并多个消息链
   */
  static merge(...chains: MessageChain[]): MessageChain {
    return chains.flat();
  }

  /**
   * 克隆消息链
   */
  static clone(chain: MessageChain): MessageChain {
    return JSON.parse(JSON.stringify(chain));
  }

  /**
   * 过滤消息链中的消息段
   */
  static filter(chain: MessageChain, predicate: (segment: MessageSegment) => boolean): MessageChain {
    return chain.filter(predicate);
  }

  /**
   * 映射消息链中的消息段
   */
  static map<T>(chain: MessageChain, mapper: (segment: MessageSegment) => T): T[] {
    return chain.map(mapper);
  }
}