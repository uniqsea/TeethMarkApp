/**
 * ESP32 通信协议定义
 * 支持版本控制和任意数据结构的可扩展设计
 */

// 协议版本
export const ESP32_PROTOCOL_VERSION = '1.0.0';

// 基础消息结构
export interface ESP32Message {
  type: string;                 // 消息类型，用于路由
  data: unknown;                // 开放的数据结构，具体由各type定义
  timestamp: number;            // 消息时间戳
  version?: string;             // 协议版本，默认使用当前版本
}

// === INPUT 消息类型（从ESP32接收）===

// 手势输入消息
export interface GestureInputData {
  gesture: 'single_click' | 'slide' | 'multi_press' | 'slide_left' | 'slide_right';
  teeth: number[];              // 触发的牙齿编号数组
  duration: number;             // 手势持续时间(ms)
  intensity?: number;           // 手势强度(可选)
}

// 设备状态消息
export interface DeviceStatusData {
  battery_level?: number;       // 电池电量百分比
  connection_strength?: number; // 连接信号强度
  firmware_version?: string;    // 固件版本
  device_id?: string;          // 设备唯一标识
}

// 传感器数据消息
export interface SensorData {
  sensor_type: 'accelerometer' | 'gyroscope' | 'pressure';
  values: number[];             // 传感器数值数组
  unit?: string;               // 数值单位
}

// 错误消息
export interface ErrorData {
  error_code: string;           // 错误代码
  error_message: string;        // 错误描述
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// INPUT消息类型枚举
export enum ESP32InputType {
  GESTURE = 'gesture',
  DEVICE_STATUS = 'device_status', 
  SENSOR = 'sensor',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

// === OUTPUT 消息类型（发送到ESP32）===

// 反馈消息数据
export interface FeedbackOutputData {
  feedback_type: 'haptic' | 'audio' | 'visual';
  action: string;               // 反馈动作标识
  intensity: number;            // 强度 0-100
  duration: number;             // 持续时间(ms)
  pattern?: number[];           // 震动模式数组
  position?: 'left' | 'right' | 'center' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>; // 附加元数据
}

// 配置消息数据
export interface ConfigOutputData {
  config_type: 'sensitivity' | 'mode' | 'calibration';
  parameters: Record<string, any>; // 配置参数键值对
}

// 命令消息数据
export interface CommandOutputData {
  command: string;              // 命令名称
  parameters?: Record<string, any>; // 命令参数
}

// OUTPUT消息类型枚举
export enum ESP32OutputType {
  FEEDBACK = 'feedback',
  CONFIG = 'config',
  COMMAND = 'command',
  HANDSHAKE = 'handshake',
  ACK = 'ack'
}

// === 类型安全的消息创建工具 ===

// 创建INPUT消息的工具函数
export function createInputMessage<T = unknown>(
  type: ESP32InputType | string,
  data: T,
  version: string = ESP32_PROTOCOL_VERSION
): ESP32Message {
  return {
    type,
    data,
    timestamp: Date.now(),
    version
  };
}

// 创建OUTPUT消息的工具函数  
export function createOutputMessage<T = unknown>(
  type: ESP32OutputType | string,
  data: T,
  version: string = ESP32_PROTOCOL_VERSION
): ESP32Message {
  return {
    type,
    data,
    timestamp: Date.now(),
    version
  };
}

// === 消息验证工具 ===

// 验证消息格式是否正确
export function validateMessage(message: any): message is ESP32Message {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof message.type === 'string' &&
    message.data !== undefined &&
    typeof message.timestamp === 'number'
  );
}

// 类型守卫：检查是否为特定类型的INPUT消息
export function isInputMessage(message: ESP32Message, type: ESP32InputType): boolean {
  return message.type === type;
}

// 类型守卫：检查是否为特定类型的OUTPUT消息
export function isOutputMessage(message: ESP32Message, type: ESP32OutputType): boolean {
  return message.type === type;
}

// === 向后兼容支持 ===

// 将旧的GestureData转换为新协议
export function legacyGestureToMessage(gesture: {
  gesture: string;
  teeth: number[];
  duration: number;
  timestamp?: number;
}): ESP32Message {
  return createInputMessage(ESP32InputType.GESTURE, {
    gesture: gesture.gesture as any,
    teeth: gesture.teeth,
    duration: gesture.duration
  } as GestureInputData);
}

// 将旧的FeedbackData转换为新协议
export function legacyFeedbackToMessage(feedback: {
  type: string;
  action: string;
  intensity: number;
  duration: number;
  pattern?: number[];
  position?: string;
  priority: string;
  metadata?: Record<string, any>;
}): ESP32Message {
  return createOutputMessage(ESP32OutputType.FEEDBACK, {
    feedback_type: 'haptic', // 默认为触觉反馈
    action: feedback.action,
    intensity: feedback.intensity,
    duration: feedback.duration,
    pattern: feedback.pattern,
    position: feedback.position as any,
    priority: feedback.priority as any,
    metadata: feedback.metadata
  } as FeedbackOutputData);
}

// === 调试和日志工具 ===

// 格式化消息用于日志输出
export function formatMessageForLog(message: ESP32Message): string {
  return `[${message.type}] ${new Date(message.timestamp).toLocaleTimeString()} - ${JSON.stringify(message.data)}`;
}

// 检查协议版本兼容性
export function isVersionCompatible(messageVersion: string = ESP32_PROTOCOL_VERSION): boolean {
  // 简单的版本兼容性检查，后续可以扩展为更复杂的语义化版本比较
  const [major] = messageVersion.split('.');
  const [currentMajor] = ESP32_PROTOCOL_VERSION.split('.');
  return major === currentMajor;
}