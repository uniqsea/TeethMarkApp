/**
 * ESP32GestureHandler v2.0 - 系统协调器
 * 连接Transport、InputProcessor、OutputProcessor三个原子服务
 * 提供统一的对外API，保持向后兼容性
 */

import { EventEmitter } from 'events';
import { ESP32TransportService, ConnectionState, ScannedDevice } from './ESP32TransportService';
import { ESP32InputProcessor, ProcessedGesture, GestureAction, TwilioCallButton } from './ESP32InputProcessor';
import { ESP32OutputProcessor, FeedbackRequest } from './ESP32OutputProcessor';
import { ESP32Message } from '../../types/ESP32Protocol';

// 向后兼容的状态接口
export interface ESP32HandlerState {
  bluetooth: ConnectionState;
  gestureControl: {
    isCallActive: boolean;
    selectedButton: TwilioCallButton | null;
    lastGesture: ProcessedGesture | null;
  };
  feedbackQueue: {
    length: number;
    isProcessing: boolean;
  };
  isActive: boolean;
}

// 协调器事件（保持向后兼容）
export interface ESP32GestureHandlerEvents {
  // 初始化事件
  'initialized': () => void;
  'initializationError': (error: Error) => void;
  
  // 连接事件
  'esp32Connected': (deviceId: string) => void;
  'esp32Disconnected': () => void;
  'esp32ConnectionLost': () => void;
  'devicesScanned': (devices: ScannedDevice[]) => void;
  
  // 手势事件
  'gestureProcessed': (gesture: ProcessedGesture) => void;
  'callButtonSelected': (button: TwilioCallButton) => void;
  'callButtonAction': (button: TwilioCallButton, action: GestureAction) => void;
  'selectionCleared': () => void;
  
  // 状态事件
  'stateChanged': (state: ESP32HandlerState) => void;
  'rawDataReceived': (data: string) => void;
}

export declare interface ESP32GestureHandler {
  on<K extends keyof ESP32GestureHandlerEvents>(event: K, listener: ESP32GestureHandlerEvents[K]): this;
  off<K extends keyof ESP32GestureHandlerEvents>(event: K, listener: ESP32GestureHandlerEvents[K]): this;
  emit<K extends keyof ESP32GestureHandlerEvents>(event: K, ...args: Parameters<ESP32GestureHandlerEvents[K]>): boolean;
}

export class ESP32GestureHandler extends EventEmitter {
  private static instance: ESP32GestureHandler;
  
  // 三个原子服务
  private transport: ESP32TransportService;
  private inputProcessor: ESP32InputProcessor;
  private outputProcessor: ESP32OutputProcessor;
  
  // 状态管理
  private isInitialized = false;
  private currentCallState = false;
  private autoInitializeOutputs = false; // 默认不自动发送握手/配置
  
  private constructor() {
    super();
    
    // 获取原子服务实例
    this.transport = ESP32TransportService.getInstance();
    this.inputProcessor = ESP32InputProcessor.getInstance();
    this.outputProcessor = ESP32OutputProcessor.getInstance();
    
    this.setupServiceConnections();
  }

  public static getInstance(): ESP32GestureHandler {
    if (!ESP32GestureHandler.instance) {
      ESP32GestureHandler.instance = new ESP32GestureHandler();
    }
    return ESP32GestureHandler.instance;
  }

  // === 服务连接和事件路由 ===

  private setupServiceConnections(): void {
    // === Transport 事件路由 ===
    this.transport.on('connected', (deviceId) => {
      console.log('🔵 ESP32 connected:', deviceId);
      this.emit('esp32Connected', deviceId);
      
      // 如需自动发送握手与配置，可开启autoInitializeOutputs
      if (this.autoInitializeOutputs) {
        this.sendInitialHandshake();
      }
    });

    this.transport.on('disconnected', () => {
      console.log('🔵 ESP32 disconnected');
      this.emit('esp32Disconnected');
    });

    this.transport.on('connection_lost', () => {
      console.log('🔵 ESP32 connection lost');
      this.emit('esp32ConnectionLost');
    });

    this.transport.on('message_received', (message: ESP32Message) => {
      // 转发原始消息事件供调试
      this.emit('rawDataReceived', JSON.stringify(message));
      
      // 将接收到的消息转发给InputProcessor
      this.inputProcessor.processMessage(message);
    });

    // === InputProcessor 事件路由 ===
    this.inputProcessor.on('gesture_recognized', (gesture: ProcessedGesture) => {
      console.log('🎮 Gesture recognized:', gesture.action);
      this.emit('gestureProcessed', gesture);
    });

    this.inputProcessor.on('button_selected', (button: TwilioCallButton) => {
      console.log('🎯 Button selected:', button);
      this.emit('callButtonSelected', button);
      
      // 发送按钮选择反馈
      this.outputProcessor.sendButtonFeedback('select', this.getButtonName(button));
    });

    this.inputProcessor.on('button_action', (button: TwilioCallButton, action: GestureAction) => {
      console.log('🎬 Button action executed:', button, action);
      this.emit('callButtonAction', button, action);
      
      // 发送按钮确认反馈
      this.outputProcessor.sendButtonFeedback('confirm', this.getButtonName(button));
    });

    this.inputProcessor.on('selection_cleared', () => {
      console.log('🔄 Selection cleared');
      this.emit('selectionCleared');
    });

    this.inputProcessor.on('device_status_updated', (status) => {
      console.log('📊 Device status updated:', status);
    });

    this.inputProcessor.on('battery_low', (level) => {
      console.warn('🔋 Low battery warning:', level + '%');
      this.outputProcessor.sendNotificationFeedback('warning', `Battery low: ${level}%`);
    });

    // === OutputProcessor 事件路由 ===
    this.outputProcessor.on('message_queued', (message: ESP32Message) => {
      // 将排队的消息通过Transport发送
      this.transport.sendMessage(message).then((success) => {
        // 报告发送结果给OutputProcessor
        this.outputProcessor.reportSendResult(message, success);
      }).catch((error) => {
        // 报告发送失败给OutputProcessor
        this.outputProcessor.reportSendResult(message, false, error);
      });
    });

    this.outputProcessor.on('message_failed', (message, error) => {
      console.error('❌ Output message failed:', error);
    });
  }

  // === 初始化方法 ===

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('🔵 ESP32 Gesture Handler already initialized');
      return true;
    }

    try {
      console.log('🔵 Initializing ESP32 Gesture Handler v2.0...');
      
      // 等待蓝牙就绪（Transport内部处理）
      // 三个服务都是单例，无需特殊初始化
      
      this.isInitialized = true;
      console.log('✅ ESP32 Gesture Handler v2.0 initialized successfully');
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('🔴 Failed to initialize ESP32 Gesture Handler:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('initializationError', errorObj);
      return false;
    }
  }

  // === 设备管理方法（保持API兼容） ===

  public async scanForDevices(): Promise<ScannedDevice[]> {
    console.log('🔍 Scanning for ESP32 devices...');

    // 预先注册监听，避免错过在扫描期间发射的事件
    return new Promise(async (resolve) => {
      const devices: ScannedDevice[] = [];
      const seen = new Set<string>();

      const onDeviceFound = (device: ScannedDevice) => {
        if (!seen.has(device.id)) {
          seen.add(device.id);
          devices.push(device);
        }
      };

      const finalize = () => {
        this.transport.off('device_found', onDeviceFound);
        this.transport.off('scan_stopped', finalize);
        this.transport.off('scan_error', onScanError);
        this.emit('devicesScanned', devices);
        resolve(devices);
      };

      this.transport.on('device_found', onDeviceFound);
      this.transport.on('scan_stopped', finalize);
      const onScanError = () => finalize();
      this.transport.on('scan_error', onScanError);

      try {
        // 开始扫描（该Promise会在扫描停止后resolve）
        await this.transport.startScan();
      } catch (e) {
        // 出错情况下也要清理并返回当前已收集的设备
        finalize();
      }
    });
  }

  public async connectToDevice(deviceId: string): Promise<boolean> {
    console.log('🔵 Connecting to ESP32 device:', deviceId);
    return await this.transport.connect(deviceId);
  }

  public async disconnect(): Promise<void> {
    console.log('🔵 Disconnecting from ESP32...');
    await this.transport.disconnect();
  }

  // === 通话控制方法（保持API兼容） ===

  public setIncomingCallState(isActive: boolean, callerInfo?: { from: string }): void {
    console.log('📞 Setting incoming call state:', isActive, callerInfo);
    
    this.currentCallState = isActive;
    this.inputProcessor.setCallActive(isActive);
    
    // ESP32 非必需：仅在已连接时才发送输出反馈，未连接时静默跳过
    const canSend = this.transport.isDeviceConnected();
    if (canSend) {
      if (isActive && callerInfo) {
        this.outputProcessor.sendCallFeedback('incoming');
      } else {
        this.outputProcessor.sendCallFeedback('ended');
      }
    }
  }

  // === 导航反馈方法（保持API兼容） ===

  public async sendNavigationTurnFeedback(direction: 'left' | 'right'): Promise<boolean> {
    console.log('🧭 Sending navigation turn feedback:', direction);
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNavigationFeedback(`turn_${direction}` as any);
    }
    return true; // 未连接时静默忽略
  }

  public async sendNavigationArrivalFeedback(): Promise<boolean> {
    console.log('🏁 Sending navigation arrival feedback');
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNavigationFeedback('arrival');
    }
    return true;
  }

  public async sendNavigationOffRouteFeedback(): Promise<boolean> {
    console.log('⚠️ Sending off-route feedback');
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNavigationFeedback('off_route');
    }
    return true;
  }

  // === 通用反馈方法（保持API兼容） ===

  public async sendSuccessFeedback(message?: string): Promise<boolean> {
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNotificationFeedback('success', message);
    }
    return true;
  }

  public async sendErrorFeedback(message?: string): Promise<boolean> {
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNotificationFeedback('error', message);
    }
    return true;
  }

  public async sendWarningFeedback(message?: string): Promise<boolean> {
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendNotificationFeedback('warning', message);
    }
    return true;
  }

  // === 测试方法（保持API兼容） ===

  public async sendTestFeedback(): Promise<boolean> {
    console.log('🧪 Sending test feedback to ESP32');
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.sendTestFeedback();
    }
    return true;
  }

  // === 配置方法（保持API兼容） ===

  public async sendOutputMode(mode: string, info: string = 'set_output_mode'): Promise<boolean> {
    console.log(`🔧 Setting output mode: ${mode}`);
    if (this.transport.isDeviceConnected()) {
      this.outputProcessor.setOutputMode(mode as any);
    }
    return true;
  }

  // 允许外部切换是否在连接后自动发送握手和初始配置
  public enableAutoInitializeOutputs(enable: boolean): void {
    this.autoInitializeOutputs = enable;
  }

  // 手动触发握手和初始配置（不自动重试）
  public runInitialHandshake(): void {
    this.sendInitialHandshake();
  }

  // === 状态查询方法（保持API兼容） ===

  public getCurrentState(): ESP32HandlerState {
    const transportState = this.transport.getConnectionState();
    const inputState = this.inputProcessor.getCurrentState();
    const outputState = this.outputProcessor.getQueueStatus();

    return {
      bluetooth: transportState,
      gestureControl: {
        isCallActive: inputState.isCallActive,
        selectedButton: inputState.selectedButton,
        lastGesture: inputState.lastGesture,
      },
      feedbackQueue: {
        length: outputState.queueLength,
        isProcessing: outputState.isProcessing,
      },
      isActive: this.isInitialized
    };
  }

  // === 内部辅助方法 ===

  private async sendInitialHandshake(): Promise<void> {
    // 发送握手消息
    this.outputProcessor.sendHandshake();
    
    // 发送初始配置
    this.outputProcessor.setGestureSensitivity(80);
    this.outputProcessor.setOutputMode('default');
    
    console.log('🤝 Initial handshake and configuration sent');
  }

  private getButtonName(button: TwilioCallButton): string {
    switch (button) {
      case TwilioCallButton.DECLINE: return 'DECLINE';
      case TwilioCallButton.ACCEPT: return 'ACCEPT';
      case TwilioCallButton.BUSY_SMS: return 'BUSY_SMS';
      default: return 'UNKNOWN';
    }
  }

  // === 测试和调试方法 ===

  public simulateGesture(gesture: 'single_click' | 'slide' | 'multi_press', teeth: number[] = [1], duration: number = 500): void {
    console.log('🧪 Simulating gesture:', gesture);
    
    // 创建模拟消息
    const mockMessage: ESP32Message = {
      type: 'gesture',
      data: { gesture, teeth, duration },
      timestamp: Date.now(),
      version: '1.0.0'
    };

    // 直接发送给InputProcessor
    this.inputProcessor.processMessage(mockMessage);
  }

  public async healthCheck(): Promise<boolean> {
    console.log('🏥 ESP32 Handler Health Check:');
    
    const transportHealth = await this.transport.healthCheck();
    const inputHealth = this.inputProcessor.healthCheck();
    const outputHealth = this.outputProcessor.healthCheck();
    
    console.log(`  - Transport: ${transportHealth ? '✅' : '❌'}`);
    console.log(`  - InputProcessor: ${inputHealth ? '✅' : '❌'}`);
    console.log(`  - OutputProcessor: ${outputHealth ? '✅' : '❌'}`);
    console.log(`  - Coordinator: ${this.isInitialized ? '✅' : '❌'}`);

    return transportHealth && inputHealth && outputHealth && this.isInitialized;
  }

  // === 生命周期管理 ===

  public async destroy(): Promise<void> {
    console.log('🔴 Destroying ESP32 Gesture Handler...');
    
    // 停止输出处理
    this.outputProcessor.stopCurrentProcessing();
    
    // 断开连接
    await this.transport.disconnect();
    
    // 清理事件监听器
    this.removeAllListeners();
    
    this.isInitialized = false;
    console.log('✅ ESP32 Gesture Handler destroyed');
  }

  // === 向后兼容的事件发射器 ===
  public emit(event: string | symbol, ...args: any[]): boolean {
    // 发射状态变化事件
    if (['esp32Connected', 'esp32Disconnected', 'callButtonSelected', 'selectionCleared'].includes(String(event))) {
      setImmediate(() => {
        super.emit('stateChanged', this.getCurrentState());
      });
    }
    
    return super.emit(event, ...args);
  }
}

// 导出单例实例以保持向后兼容
export default ESP32GestureHandler;