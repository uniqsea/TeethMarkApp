/**
 * ESP32OutputProcessor - 输出数据处理器
 * 专门处理发送到ESP32的消息，将App的反馈需求转换为标准JSON格式
 * 包含反馈队列管理和iOS触觉优化
 */

import { EventEmitter } from 'events';
import { 
  ESP32Message,
  ESP32OutputType,
  FeedbackOutputData,
  ConfigOutputData,
  CommandOutputData,
  createOutputMessage,
  formatMessageForLog
} from '../../types/ESP32Protocol';

// 反馈请求接口（App内部使用）
export interface FeedbackRequest {
  type: 'navigation' | 'call' | 'notification' | 'system';
  action: string;
  intensity?: number;        // 强度 0-100，默认70
  duration?: number;         // 持续时间ms，默认500
  pattern?: number[];        // 自定义震动模式
  position?: 'left' | 'right' | 'center' | 'all'; // 默认center
  priority?: 'low' | 'normal' | 'high' | 'urgent'; // 默认normal
  metadata?: Record<string, any>;
}

// 配置请求接口
export interface ConfigRequest {
  type: 'sensitivity' | 'mode' | 'calibration' | 'general';
  parameters: Record<string, any>;
}

// 命令请求接口
export interface CommandRequest {
  command: string;
  parameters?: Record<string, any>;
}

// 队列中的消息项
interface QueuedMessage {
  message: ESP32Message;
  priority: number;          // 优先级数值，越大越优先
  retryCount: number;        // 重试次数
  maxRetries: number;        // 最大重试次数
  timestamp: number;         // 入队时间戳
}

// 预定义的反馈模式
const FEEDBACK_PATTERNS = {
  // 导航反馈
  TURN_LEFT: [300, 100, 300],           // 左转：长-短-长
  TURN_RIGHT: [200, 100, 200, 100, 200], // 右转：短-短-短
  ARRIVAL: [500, 200, 500, 200, 500],    // 到达：长-长-长
  OFF_ROUTE: [100, 50, 100, 50, 100, 50, 100], // 偏航：快速短震
  
  // 通话反馈
  INCOMING_CALL: [800, 400, 800, 400],   // 来电：慢长震
  CALL_ACCEPTED: [300, 100, 300],        // 接听：确认震动
  CALL_DECLINED: [200, 100, 200, 100, 200], // 挂断：拒绝震动
  CALL_ENDED: [500],                     // 通话结束：单次长震
  
  // 通知反馈
  SUCCESS: [200, 100, 200],              // 成功：双短震
  ERROR: [100, 50, 100, 50, 100],        // 错误：三短震  
  WARNING: [300, 200, 300],              // 警告：中等震动
  INFO: [200],                           // 信息：单短震
  
  // 按钮反馈
  BUTTON_SELECT: [100],                  // 按钮选择：轻触
  BUTTON_CONFIRM: [200, 100, 200],       // 按钮确认：双震
  BUTTON_INVALID: [50, 25, 50, 25, 50],  // 无效操作：快速多震
} as const;

// OutputProcessor事件
export interface OutputProcessorEvents {
  'message_queued': (message: ESP32Message) => void;
  'message_sent': (message: ESP32Message) => void;
  'message_failed': (message: ESP32Message, error: Error) => void;
  'queue_full': (droppedMessage: ESP32Message) => void;
  'processing_error': (error: Error) => void;
}

export declare interface ESP32OutputProcessor {
  on<K extends keyof OutputProcessorEvents>(event: K, listener: OutputProcessorEvents[K]): this;
  off<K extends keyof OutputProcessorEvents>(event: K, listener: OutputProcessorEvents[K]): this;
  emit<K extends keyof OutputProcessorEvents>(event: K, ...args: Parameters<OutputProcessorEvents[K]>): boolean;
}

export class ESP32OutputProcessor extends EventEmitter {
  private static instance: ESP32OutputProcessor;
  
  // 消息队列配置
  private queueConfig = {
    maxQueueSize: 50,          // 最大队列长度
    processingInterval: 100,   // 处理间隔ms
    defaultRetries: 3,         // 默认重试次数
    retryDelay: 500,          // 重试延迟ms
    priorityTimeout: 5000,    // 高优先级消息超时ms
  };
  
  // 消息队列（按优先级排序）
  private messageQueue: QueuedMessage[] = [];
  private isProcessing = false;
  private processingTimer: any = null;
  // 每条消息的重试计数（按消息对象跟踪）
  private retryMap: WeakMap<ESP32Message, number> = new WeakMap();
  
  // 反馈强度配置（iOS优化）
  private intensityConfig = {
    low: 30,      // 轻微反馈
    normal: 70,   // 正常反馈  
    high: 90,     // 强反馈
    urgent: 100,  // 紧急最强反馈
  };
  
  // 统计信息
  private stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRetries: 0,
    averageQueueTime: 0,
  };

  private constructor() {
    super();
    this.startQueueProcessor();
  }

  public static getInstance(): ESP32OutputProcessor {
    if (!ESP32OutputProcessor.instance) {
      ESP32OutputProcessor.instance = new ESP32OutputProcessor();
    }
    return ESP32OutputProcessor.instance;
  }

  // === 队列处理器 ===

  private startQueueProcessor(): void {
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.queueConfig.processingInterval);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // 按优先级和时间戳排序
      this.messageQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // 高优先级优先
        }
        return a.timestamp - b.timestamp; // 同优先级按时间顺序
      });

      const queuedMessage = this.messageQueue.shift();
      if (queuedMessage) {
        await this.sendQueuedMessage(queuedMessage);
      }
    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendQueuedMessage(queuedMessage: QueuedMessage): Promise<void> {
    // 从队列取出消息，触发事件让协调器处理实际发送
    console.log('📤 Processing queued message:', formatMessageForLog(queuedMessage.message));
    this.emit('message_queued', queuedMessage.message);
  }

  // 协调器调用此方法报告发送结果
  public reportSendResult(message: ESP32Message, success: boolean, error?: Error): void {
    if (success) {
      this.stats.totalSent++;
      // 清除重试计数
      this.retryMap.delete(message);
      this.emit('message_sent', message);
    } else {
      // 查找对应的队列消息进行重试处理
      this.handleSendFailure(message, error || new Error('Unknown send error'));
    }
  }

  private handleSendFailure(message: ESP32Message, error: Error): void {
    // 递增并读取当前重试次数
    const current = (this.retryMap.get(message) ?? 0) + 1;
    this.retryMap.set(message, current);
    this.stats.totalRetries++;

    if (current <= this.queueConfig.defaultRetries) {
      const queuedMessage: QueuedMessage = {
        message,
        priority: 50, // 重试时降低优先级
        retryCount: current,
        maxRetries: this.queueConfig.defaultRetries,
        timestamp: Date.now()
      };
      // 按配置延迟后重试
      setTimeout(() => {
        this.messageQueue.push(queuedMessage);
      }, this.queueConfig.retryDelay);
      console.log(`🔄 Message retry ${current}/${this.queueConfig.defaultRetries}`);
    } else {
      // 重试次数用尽，放弃发送并清理计数
      this.retryMap.delete(message);
      this.stats.totalFailed++;
      this.emit('message_failed', message, error);
      console.error('❌ Message failed after all retries:', formatMessageForLog(message));
    }
  }

  // === 反馈生成方法 ===

  // 导航反馈
  public sendNavigationFeedback(action: 'turn_left' | 'turn_right' | 'arrival' | 'off_route', customRequest?: Partial<FeedbackRequest>): void {
    const baseRequest: FeedbackRequest = {
      type: 'navigation',
      action,
      intensity: this.intensityConfig.normal,
      duration: 500,
      priority: action === 'off_route' ? 'urgent' : 'normal',
      position: 'center',
      ...customRequest
    };

    // 使用预定义模式
    switch (action) {
      case 'turn_left':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.TURN_LEFT];
        baseRequest.position = 'left';
        break;
      case 'turn_right':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.TURN_RIGHT];
        baseRequest.position = 'right';
        break;
      case 'arrival':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.ARRIVAL];
        baseRequest.intensity = this.intensityConfig.high;
        break;
      case 'off_route':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.OFF_ROUTE];
        baseRequest.intensity = this.intensityConfig.urgent;
        break;
    }

    this.sendFeedback(baseRequest);
  }

  // 通话反馈
  public sendCallFeedback(action: 'incoming' | 'accepted' | 'declined' | 'ended', customRequest?: Partial<FeedbackRequest>): void {
    const baseRequest: FeedbackRequest = {
      type: 'call',
      action,
      intensity: this.intensityConfig.high,
      priority: action === 'incoming' ? 'urgent' : 'high',
      position: 'all',
      ...customRequest
    };

    // 使用预定义模式
    switch (action) {
      case 'incoming':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.INCOMING_CALL];
        baseRequest.duration = 2000;
        break;
      case 'accepted':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.CALL_ACCEPTED];
        break;
      case 'declined':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.CALL_DECLINED];
        break;
      case 'ended':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.CALL_ENDED];
        break;
    }

    this.sendFeedback(baseRequest);
  }

  // 通知反馈
  public sendNotificationFeedback(action: 'success' | 'error' | 'warning' | 'info', message?: string, customRequest?: Partial<FeedbackRequest>): void {
    const baseRequest: FeedbackRequest = {
      type: 'notification',
      action,
      intensity: this.intensityConfig.normal,
      priority: action === 'error' ? 'high' : 'normal',
      position: 'center',
      metadata: message ? { message } : undefined,
      ...customRequest
    };

    // 使用预定义模式
    switch (action) {
      case 'success':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.SUCCESS];
        break;
      case 'error':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.ERROR];
        baseRequest.intensity = this.intensityConfig.high;
        break;
      case 'warning':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.WARNING];
        break;
      case 'info':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.INFO];
        break;
    }

    this.sendFeedback(baseRequest);
  }

  // 按钮反馈
  public sendButtonFeedback(action: 'select' | 'confirm' | 'invalid', buttonName?: string): void {
    const baseRequest: FeedbackRequest = {
      type: 'system',
      action: `button_${action}`,
      intensity: action === 'invalid' ? this.intensityConfig.low : this.intensityConfig.normal,
      priority: 'normal',
      position: 'center',
      metadata: buttonName ? { button: buttonName } : undefined,
    };

    // 使用预定义模式
    switch (action) {
      case 'select':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.BUTTON_SELECT];
        break;
      case 'confirm':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.BUTTON_CONFIRM];
        break;
      case 'invalid':
        baseRequest.pattern = [...FEEDBACK_PATTERNS.BUTTON_INVALID];
        break;
    }

    this.sendFeedback(baseRequest);
  }

  // 通用反馈方法
  public sendFeedback(request: FeedbackRequest): void {
    try {
      const feedbackData: FeedbackOutputData = {
        feedback_type: 'haptic', // iOS主要使用触觉反馈
        action: request.action,
        intensity: request.intensity ?? this.intensityConfig.normal,
        duration: request.duration ?? 500,
        pattern: request.pattern,
        position: request.position ?? 'center',
        priority: request.priority ?? 'normal',
        metadata: {
          ...request.metadata,
          type: request.type,
          timestamp: Date.now()
        }
      };

      const message = createOutputMessage(ESP32OutputType.FEEDBACK, feedbackData);
      this.queueMessage(message, this.getPriorityScore(request.priority ?? 'normal'));
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('processing_error', errorObj);
    }
  }

  // === 配置和命令方法 ===

  public sendConfiguration(request: ConfigRequest): void {
    try {
      const configData: ConfigOutputData = {
        config_type: request.type as any,
        parameters: request.parameters
      };

      const message = createOutputMessage(ESP32OutputType.CONFIG, configData);
      this.queueMessage(message, 80); // 配置消息高优先级
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('processing_error', errorObj);
    }
  }

  public sendCommand(request: CommandRequest): void {
    try {
      const commandData: CommandOutputData = {
        command: request.command,
        parameters: request.parameters
      };

      const message = createOutputMessage(ESP32OutputType.COMMAND, commandData);
      this.queueMessage(message, 90); // 命令消息最高优先级
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('processing_error', errorObj);
    }
  }

  // 发送握手消息
  public sendHandshake(): void {
    const handshakeData = {
      info: 'handshake',
      app_version: '1.0.0',
      platform: 'ios',
      timestamp: Date.now()
    };

    const message = createOutputMessage(ESP32OutputType.HANDSHAKE, handshakeData);
    this.queueMessage(message, 100); // 握手消息最高优先级
  }

  // === 队列管理 ===

  private queueMessage(message: ESP32Message, priority: number): void {
    // 检查队列是否已满
    if (this.messageQueue.length >= this.queueConfig.maxQueueSize) {
      // 移除最低优先级的消息
      const lowestPriorityIndex = this.findLowestPriorityMessage();
      if (lowestPriorityIndex !== -1) {
        const dropped = this.messageQueue.splice(lowestPriorityIndex, 1)[0];
        this.emit('queue_full', dropped.message);
      }
    }

    const queuedMessage: QueuedMessage = {
      message,
      priority,
      retryCount: 0,
      maxRetries: this.queueConfig.defaultRetries,
      timestamp: Date.now()
    };

  this.messageQueue.push(queuedMessage);
  // 不在入队时直接触发发送，由队列处理器统一调度
    console.log(`📋 Message queued (priority: ${priority}):`, formatMessageForLog(message));
  }

  private findLowestPriorityMessage(): number {
    if (this.messageQueue.length === 0) return -1;
    
    let lowestIndex = 0;
    let lowestPriority = this.messageQueue[0].priority;
    
    for (let i = 1; i < this.messageQueue.length; i++) {
      if (this.messageQueue[i].priority < lowestPriority) {
        lowestPriority = this.messageQueue[i].priority;
        lowestIndex = i;
      }
    }
    
    return lowestIndex;
  }

  private getPriorityScore(priority: string): number {
    switch (priority) {
      case 'urgent': return 100;
      case 'high': return 80;
      case 'normal': return 50;
      case 'low': return 20;
      default: return 50;
    }
  }

  // === 状态查询 ===

  public getQueueStatus() {
    return {
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessing,
      stats: { ...this.stats },
      config: { ...this.queueConfig }
    };
  }

  public clearQueue(): void {
    const clearedCount = this.messageQueue.length;
    this.messageQueue = [];
    console.log(`🗑️ Cleared ${clearedCount} messages from queue`);
  }

  // 停止当前处理
  public stopCurrentProcessing(): void {
    this.isProcessing = false;
    console.log('⏸️ Output processing stopped');
  }

  // === 预设的快捷方法 ===

  // 快速发送测试反馈
  public sendTestFeedback(): void {
    this.sendNotificationFeedback('info', 'Test feedback');
  }

  // 设置输出模式
  public setOutputMode(mode: 'default' | 'strong' | 'silent'): void {
    this.sendConfiguration({
      type: 'mode',
      parameters: { output_mode: mode }
    });
  }

  // 设置手势灵敏度
  public setGestureSensitivity(sensitivity: number): void {
    this.sendConfiguration({
      type: 'sensitivity',
      parameters: { gesture_sensitivity: Math.max(0, Math.min(100, sensitivity)) }
    });
  }

  // === 健康检查和清理 ===

  public healthCheck(): boolean {
    const status = this.getQueueStatus();
    
    console.log('🏥 OutputProcessor Health Check:');
    console.log(`  - Queue Length: ${status.queueLength}/${this.queueConfig.maxQueueSize}`);
    console.log(`  - Is Processing: ${status.isProcessing}`);
    console.log(`  - Total Sent: ${status.stats.totalSent}`);
    console.log(`  - Total Failed: ${status.stats.totalFailed}`);

    return status.queueLength < this.queueConfig.maxQueueSize && 
           status.stats.totalFailed < status.stats.totalSent * 0.1; // 失败率低于10%
  }

  public destroy(): void {
    console.log('🔴 Destroying ESP32OutputProcessor...');
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    
    this.clearQueue();
    this.removeAllListeners();
    
    console.log('✅ ESP32OutputProcessor destroyed');
  }
}