import { createCipheriv, createHash, createHmac } from 'node:crypto';

export class RedoteCrypto {
  static aesEcbEncrypt(key: string, plaintext: string): string {
    // 使用与 pysxt 兼容的 AES ECB 加密
    // Python 的 AES.new() 默认使用 AES-128，key 长度决定算法
    const keyBuffer = Buffer.from(key, 'utf8');
    
    // 如果 key 长度不是 16/24/32，需要填充或截断到合适长度
    let adjustedKey: Buffer;
    if (keyBuffer.length <= 16) {
      adjustedKey = Buffer.alloc(16);
      keyBuffer.copy(adjustedKey);
    } else if (keyBuffer.length <= 24) {
      adjustedKey = Buffer.alloc(24);
      keyBuffer.copy(adjustedKey);
    } else {
      adjustedKey = Buffer.alloc(32);
      keyBuffer.copy(adjustedKey);
    }
    
    const cipher = createCipheriv('aes-128-ecb', adjustedKey.subarray(0, 16), null);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // 转换为 URL 安全的 base64
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  static hmacSha1(key: string, content: string): string {
    return createHmac('sha1', key).update(content).digest('hex');
  }

  static sha1Hash(data: string): string {
    return createHash('sha1').update(data, 'utf8').digest('hex');
  }

  static generateUuid(): string {
    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
    return `${timestamp}-${randomNumber}`;
  }
}