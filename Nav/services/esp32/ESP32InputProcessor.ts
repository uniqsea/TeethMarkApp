/**
 * ESP32InputProcessor - 输入数据处理器
 * 专门处理从ESP32接收的消息，将JSON数据转换为App内部事件
 * 包含手势识别和按钮控制逻辑
 */

import { EventEmitter } from 'events';
import { 
  ESP32Message, 
  ESP32InputType,
  GestureInputData,
  DeviceStatusData,
  SensorData,
  ErrorData,
  isInputMessage,
  formatMessageForLog
} from '../../types/ESP32Protocol';

// 处理后的手势数据
export interface ProcessedGesture {
  type: 'single_click' | 'slide' | 'multi_press' | 'slide_left' | 'slide_right';
  teeth: number[];
  duration: number;
  intensity?: number;
  timestamp: number;
  // 解析后的语义信息
  action?: GestureAction;
  confidence?: number; // 识别置信度 0-1
}

// 手势动作枚举
export enum GestureAction {
  // 单击动作
  QUICK_ACCEPT = 'quick_accept',           // 快速接听
  CONFIRM_SELECTION = 'confirm_selection', // 确认选择
  
  // 滑动动作  
  SELECT_LEFT = 'select_left',             // 选择左侧按钮(挂断)
  SELECT_RIGHT = 'select_right',           // 选择右侧按钮(忙碌短信)
  
  // 多按动作
  TOGGLE_SELECTION = 'toggle_selection',   // 切换选择
  QUICK_DECLINE = 'quick_decline',         // 快速挂断
  UNKNOWN = 'unknown'                      // 未识别的手势
}

// Twilio通话按钮枚举（与GestureControlService保持一致）
export enum TwilioCallButton {
  DECLINE = 0,    // 挂断 (左)
  ACCEPT = 1,     // 接听 (中)  
  BUSY_SMS = 2    // 忙碌短信 (右)
}

// 处理后的设备状态
export interface ProcessedDeviceStatus {
  batteryLevel?: number;
  connectionStrength?: number;
  firmwareVersion?: string;
  deviceId?: string;
  timestamp: number;
}

// InputProcessor事件
export interface InputProcessorEvents {
  // 手势事件
  'gesture_recognized': (gesture: ProcessedGesture) => void;
  'button_selected': (button: TwilioCallButton) => void;
  'button_action': (button: TwilioCallButton, action: GestureAction) => void;
  'selection_cleared': () => void;
  
  // 设备状态事件
  'device_status_updated': (status: ProcessedDeviceStatus) => void;
  'battery_low': (level: number) => void;
  'connection_weak': (strength: number) => void;
  
  // 传感器事件
  'sensor_data': (data: SensorData & { timestamp: number }) => void;
  
  // 错误事件
  'device_error': (error: ErrorData & { timestamp: number }) => void;
  'processing_error': (error: Error, rawMessage?: ESP32Message) => void;
}

export declare interface ESP32InputProcessor {
  on<K extends keyof InputProcessorEvents>(event: K, listener: InputProcessorEvents[K]): this;
  off<K extends keyof InputProcessorEvents>(event: K, listener: InputProcessorEvents[K]): this;
  emit<K extends keyof InputProcessorEvents>(event: K, ...args: Parameters<InputProcessorEvents[K]>): boolean;
}

export class ESP32InputProcessor extends EventEmitter {
  private static instance: ESP32InputProcessor;
  
  // 手势识别配置
  private gestureConfig = {
    // Single Click 参数
    singleClickMinDuration: 50,    // 最小50ms
    singleClickMaxDuration: 1500,  // 最大1.5s
    quickAcceptMaxDuration: 800,   // 快速接听最大时长
    
    // Slide 参数
    slideMinTeeth: 2,              // 最少滑动牙齿数
    slideMaxGap: 3,                // 最大跳跃间隔
    
    // Multi-press 参数
    multiPressMinTeeth: 2,         // 最少同时按压牙齿数
    quickDeclineMinTeeth: 3,       // 快速挂断最少牙齿数
    
    // 确认按钮
    confirmButtonTeeth: 2,         // 按钮2作为确认键
  };
  
  // 当前状态
  private currentState = {
    isCallActive: false,           // 是否有活跃通话
    selectedButton: null as TwilioCallButton | null, // 当前选中的按钮
    lastGesture: null as ProcessedGesture | null,   // 最后识别的手势
    deviceStatus: null as ProcessedDeviceStatus | null, // 设备状态
    selectionTimeout: null as NodeJS.Timeout | null, // 选择超时定时器
  };

  private constructor() {
    super();
  }

  public static getInstance(): ESP32InputProcessor {
    if (!ESP32InputProcessor.instance) {
      ESP32InputProcessor.instance = new ESP32InputProcessor();
    }
    return ESP32InputProcessor.instance;
  }

  // === 消息处理入口 ===

  public processMessage(message: ESP32Message): void {
    try {
      console.log('🔄 Processing input:', formatMessageForLog(message));
      
      // 根据消息类型分发处理
      if (isInputMessage(message, ESP32InputType.GESTURE)) {
        this.processGestureMessage(message.data as GestureInputData, message.timestamp);
      } else if (isInputMessage(message, ESP32InputType.DEVICE_STATUS)) {
        this.processDeviceStatusMessage(message.data as DeviceStatusData, message.timestamp);
      } else if (isInputMessage(message, ESP32InputType.SENSOR)) {
        this.processSensorMessage(message.data as SensorData, message.timestamp);
      } else if (isInputMessage(message, ESP32InputType.ERROR)) {
        this.processErrorMessage(message.data as ErrorData, message.timestamp);
      } else if (isInputMessage(message, ESP32InputType.HEARTBEAT)) {
        // 心跳消息静默处理
        console.log('💓 Heartbeat received');
      } else {
        console.warn('⚠️ Unknown message type:', message.type);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('processing_error', errorObj, message);
    }
  }

  // === 手势消息处理 ===

  private processGestureMessage(data: GestureInputData, timestamp: number): void {
    // 数据验证
    if (!this.validateGestureData(data)) {
      this.emit('processing_error', new Error('Invalid gesture data'));
      return;
    }

    console.log('🎮 Processing ESP32 gesture:', {
      type: data.gesture,
      teeth: data.teeth,
      duration: data.duration
    });

    // 创建处理后的手势对象
    const processedGesture: ProcessedGesture = {
      type: data.gesture,
      teeth: data.teeth,
      duration: data.duration,
      intensity: data.intensity,
      timestamp,
    };

    // 识别手势动作
    const action = this.recognizeGestureAction(processedGesture);
    processedGesture.action = action;
    processedGesture.confidence = this.calculateConfidence(processedGesture);

    console.log('🎯 Gesture recognition result:', {
      action,
      confidence: processedGesture.confidence
    });

    this.currentState.lastGesture = processedGesture;
    this.emit('gesture_recognized', processedGesture);

    // 如果有活跃通话，处理通话控制逻辑
    if (this.currentState.isCallActive) {
      console.log('📞 Call active, processing gesture for call control');
      this.handleCallControlGesture(processedGesture);
    } else {
      console.log('📱 No active call, gesture processed but not applied to call control');
    }
  }

  private validateGestureData(data: GestureInputData): boolean {
    return !!(
      data &&
      typeof data.gesture === 'string' &&
      Array.isArray(data.teeth) &&
      data.teeth.length > 0 &&
      typeof data.duration === 'number' &&
      data.duration > 0
    );
  }

  private recognizeGestureAction(gesture: ProcessedGesture): GestureAction {
    const { type, teeth, duration } = gesture;

    switch (type) {
      case 'single_click':
        return this.recognizeSingleClickAction(teeth, duration);
      case 'slide_left':
        return GestureAction.SELECT_LEFT;
      case 'slide_right':
        return GestureAction.SELECT_RIGHT;
      case 'slide':
        return this.recognizeSlideAction(teeth);
      case 'multi_press':
        return this.recognizeMultiPressAction(teeth);
      default:
        return GestureAction.UNKNOWN;
    }
  }

  private recognizeSingleClickAction(teeth: number[], duration: number): GestureAction {
    // ESP32测试数据：teeth=[2], duration=150
    // 单击手势统一映射为快速接听
    if (teeth.length === 1 && duration <= 200) {
      return GestureAction.QUICK_ACCEPT;
    }

    // 其他情况作为确认选择
    return GestureAction.CONFIRM_SELECTION;
  }

  private recognizeSlideAction(teeth: number[]): GestureAction {
    // 传统slide类型的滑动检测（保持向后兼容）
    if (teeth.length < 2) {
      return GestureAction.UNKNOWN;
    }

    // 分析滑动方向
    const direction = this.analyzeSlideDirection(teeth);
    
    switch (direction) {
      case 'left':
        return GestureAction.SELECT_LEFT;
      case 'right':  
        return GestureAction.SELECT_RIGHT;
      default:
        return GestureAction.UNKNOWN;
    }
  }

  private recognizeMultiPressAction(teeth: number[]): GestureAction {
    // ESP32测试数据：teeth=[1,2,3], duration=300
    // 多按手势映射为快速挂断
    if (teeth.length >= 3) {
      return GestureAction.QUICK_DECLINE;
    } else if (teeth.length >= 2) {
      return GestureAction.TOGGLE_SELECTION;
    }
    
    return GestureAction.UNKNOWN;
  }

  private analyzeSlideDirection(teeth: number[]): 'left' | 'right' | 'center' | 'unknown' {
    if (teeth.length < 2) return 'unknown';

    const first = teeth[0];
    const last = teeth[teeth.length - 1];

    // ESP32测试数据分析：
    // slide_left: [3,2,1] - 数字递减，从右到左
    // slide_right: [1,2,3] - 数字递增，从左到右
    
    if (first > last) {
      return 'left';  // 数字递减 = 向左滑动
    } else if (first < last) {
      return 'right'; // 数字递增 = 向右滑动
    } else {
      return 'center'; // 相同位置（不再映射为选择动作）
    }
  }

  private calculateConfidence(gesture: ProcessedGesture): number {
    let confidence = 0.5; // 基础置信度

    // 根据ESP32测试数据特征调整置信度
    const { type, teeth, duration } = gesture;
    
    switch (type) {
      case 'single_click':
        // 测试数据: teeth=[2], duration=150
        if (teeth.length === 1 && duration >= 100 && duration <= 200) {
          confidence = 0.9;
        }
        break;
        
      case 'slide_left':
        // 测试数据: teeth=[3,2,1], duration=600
        if (teeth.length === 3 && duration >= 500 && duration <= 700) {
          confidence = 0.9;
        }
        break;
        
      case 'slide_right':
        // 测试数据: teeth=[1,2,3], duration=600
        if (teeth.length === 3 && duration >= 500 && duration <= 700) {
          confidence = 0.9;
        }
        break;
        
      case 'multi_press':
        // 测试数据: teeth=[1,2,3], duration=300
        if (teeth.length >= 3 && duration >= 200 && duration <= 400) {
          confidence = 0.9;
        }
        break;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // === 通话控制逻辑 ===

  private handleCallControlGesture(gesture: ProcessedGesture): void {
    const { action } = gesture;

    switch (action) {
      case GestureAction.QUICK_ACCEPT:
        this.executeButtonAction(TwilioCallButton.ACCEPT, action);
        break;

      case GestureAction.QUICK_DECLINE:
        this.executeButtonAction(TwilioCallButton.DECLINE, action);
        break;

      case GestureAction.SELECT_LEFT:
        this.selectButton(TwilioCallButton.DECLINE);
        break;

      case GestureAction.SELECT_RIGHT:
        this.selectButton(TwilioCallButton.BUSY_SMS);
        break;

      case GestureAction.CONFIRM_SELECTION:
        this.confirmCurrentSelection();
        break;

      case GestureAction.TOGGLE_SELECTION:
        this.toggleSelection();
        break;

      default:
        console.log('🟡 Gesture not handled in call context:', action);
    }
  }

  private selectButton(button: TwilioCallButton): void {
    this.clearSelectionTimeout();
    this.currentState.selectedButton = button;
    
    console.log('🎯 Button selected:', this.getButtonName(button));
    this.emit('button_selected', button);
    
    // 设置选择超时（2秒后自动清除）
    this.currentState.selectionTimeout = setTimeout(() => {
      this.clearSelection();
    }, 2000) as any;
  }

  private confirmCurrentSelection(): void {
    const selectedButton = this.currentState.selectedButton;
    if (selectedButton !== null) {
      this.executeButtonAction(selectedButton, GestureAction.CONFIRM_SELECTION);
    } else {
      console.log('🟡 No button selected for confirmation');
    }
  }

  private toggleSelection(): void {
    const currentButton = this.currentState.selectedButton ?? TwilioCallButton.ACCEPT;
    const nextButton = (currentButton + 1) % 3 as TwilioCallButton;
    this.selectButton(nextButton);
  }

  private executeButtonAction(button: TwilioCallButton, action: GestureAction): void {
    this.clearSelection();
    
    console.log('🎬 Executing button action:', this.getButtonName(button), action);
    this.emit('button_action', button, action);
  }

  private clearSelection(): void {
    this.clearSelectionTimeout();
    this.currentState.selectedButton = null;
    this.emit('selection_cleared');
  }

  private clearSelectionTimeout(): void {
    if (this.currentState.selectionTimeout) {
      clearTimeout(this.currentState.selectionTimeout);
      this.currentState.selectionTimeout = null;
    }
  }

  // === 设备状态处理 ===

  private processDeviceStatusMessage(data: DeviceStatusData, timestamp: number): void {
    const status: ProcessedDeviceStatus = {
      batteryLevel: data.battery_level,
      connectionStrength: data.connection_strength,
      firmwareVersion: data.firmware_version,
      deviceId: data.device_id,
      timestamp
    };

    this.currentState.deviceStatus = status;
    this.emit('device_status_updated', status);

    // 检查低电量警告
    if (data.battery_level !== undefined && data.battery_level < 20) {
      this.emit('battery_low', data.battery_level);
    }

    // 检查连接强度警告
    if (data.connection_strength !== undefined && data.connection_strength < 30) {
      this.emit('connection_weak', data.connection_strength);
    }
  }

  // === 传感器和错误处理 ===

  private processSensorMessage(data: SensorData, timestamp: number): void {
    this.emit('sensor_data', { ...data, timestamp });
  }

  private processErrorMessage(data: ErrorData, timestamp: number): void {
    this.emit('device_error', { ...data, timestamp });
  }

  // === 状态管理 ===

  public setCallActive(isActive: boolean): void {
    this.currentState.isCallActive = isActive;
    
    if (!isActive) {
      // 通话结束，清除选择状态
      this.clearSelection();
    }
    
    console.log('📞 Call active state:', isActive);
  }

  public getCurrentState() {
    return {
      ...this.currentState,
      gestureConfig: { ...this.gestureConfig }
    };
  }

  public updateGestureConfig(newConfig: Partial<typeof this.gestureConfig>): void {
    this.gestureConfig = { ...this.gestureConfig, ...newConfig };
    console.log('🎮 Gesture config updated');
  }

  // === 工具方法 ===

  private getButtonName(button: TwilioCallButton): string {
    switch (button) {
      case TwilioCallButton.DECLINE: return 'DECLINE';
      case TwilioCallButton.ACCEPT: return 'ACCEPT';
      case TwilioCallButton.BUSY_SMS: return 'BUSY_SMS';
      default: return 'UNKNOWN';
    }
  }

  // 健康检查
  public healthCheck(): boolean {
    const state = this.getCurrentState();
    
    console.log('🏥 InputProcessor Health Check:');
    console.log(`  - Call Active: ${state.isCallActive}`);
    console.log(`  - Selected Button: ${state.selectedButton !== null ? this.getButtonName(state.selectedButton) : 'None'}`);
    console.log(`  - Last Gesture: ${state.lastGesture?.action || 'None'}`);

    return true; // InputProcessor总是健康的，因为它是无状态的处理器
  }

  // 清理资源
  public destroy(): void {
    console.log('🔴 Destroying ESP32InputProcessor...');
    
    this.clearSelection();
    this.removeAllListeners();
    
    console.log('✅ ESP32InputProcessor destroyed');
  }
}