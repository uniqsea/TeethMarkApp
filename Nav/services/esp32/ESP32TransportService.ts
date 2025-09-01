/**
 * ESP32TransportService - 纯BLE传输层
 * 专注于iOS Core Bluetooth优化，只负责JSON消息的收发
 * 不包含任何业务逻辑或数据解析
 */

import { EventEmitter } from 'events';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';
import { encode as b64encode, decode as b64decode } from 'base-64';
import { ESP32Message, validateMessage, formatMessageForLog } from '../../types/ESP32Protocol';

// 连接状态接口
export interface ConnectionState {
  isEnabled: boolean;           // 蓝牙是否启用
  isConnected: boolean;         // 是否已连接设备
  connectedDevice: Device | null; // 已连接的设备
  connectionStrength?: number;  // 连接信号强度
  lastActivity?: number;        // 最后活动时间戳
}

// 扫描到的设备信息
export interface ScannedDevice {
  id: string;                   // 设备ID
  name: string;                 // 设备名称
  rssi?: number;               // 信号强度
  advertisementData?: any;      // 广播数据
}

// Transport事件类型
export interface TransportEvents {
  // 连接事件
  'connected': (deviceId: string) => void;
  'disconnected': () => void;
  'connection_lost': () => void;
  'connection_error': (error: Error) => void;
  
  // 扫描事件
  'scan_started': () => void;
  'scan_stopped': () => void;
  'device_found': (device: ScannedDevice) => void;
  'scan_error': (error: Error) => void;
  
  // 消息事件
  'message_received': (message: ESP32Message) => void;
  'message_sent': (message: ESP32Message) => void;
  'message_error': (error: Error, rawData?: string) => void;
  
  // 状态事件
  'bluetooth_state_changed': (isEnabled: boolean) => void;
  'connection_state_changed': (state: ConnectionState) => void;
}

export declare interface ESP32TransportService {
  on<K extends keyof TransportEvents>(event: K, listener: TransportEvents[K]): this;
  off<K extends keyof TransportEvents>(event: K, listener: TransportEvents[K]): this;
  emit<K extends keyof TransportEvents>(event: K, ...args: Parameters<TransportEvents[K]>): boolean;
}

export class ESP32TransportService extends EventEmitter {
  private static instance: ESP32TransportService;
  
  // iOS BLE管理器
  private manager = new BleManager();
  private device: Device | null = null;
  private notificationSubscription: { remove(): void } | null = null;
  
  // 连接状态
  private isConnected = false;
  private lastBleState: string | null = null;
  
  // 数据缓冲区
  private rxBuffer = '';
  private readonly maxBufferSize = 8192; // 8KB缓冲区
  
  // ESP32设备配置（来自固件 TeethMarkEsp32Test.ino）
  private readonly ESP32_CONFIG = {
    SERVICE_UUID: '12345678-1234-5678-1234-56789abcdef0',
    RX_CHAR_UUID: '12345678-1234-5678-1234-56789abcdef2', // 接收通知
    TX_CHAR_UUID: '12345678-1234-5678-1234-56789abcdef1', // 发送数据
    DEVICE_NAME_PREFIX: 'TeethMark',
    CONNECTION_TIMEOUT: 10000, // 15秒连接超时
    SCAN_TIMEOUT: 10000,      // 12秒扫描超时，给ESP32更多广播时间
  };
  
  // iOS特有配置
  private readonly IOS_CONFIG = {
    MAX_MTU: 185,             // iOS BLE ATT MTU限制
    CHUNK_SIZE: 150,          // 数据分片大小
    RECONNECT_DELAY: 2000,    // 重连延迟
    MAX_RECONNECT_ATTEMPTS: 5 // 最大重连次数
  };

  private constructor() {
    super();
    this.setupBluetoothStateMonitoring();
  }

  public static getInstance(): ESP32TransportService {
    if (!ESP32TransportService.instance) {
      ESP32TransportService.instance = new ESP32TransportService();
    }
    return ESP32TransportService.instance;
  }

  // === 初始化和状态管理 ===

  private setupBluetoothStateMonitoring(): void {
    // 监听iOS蓝牙状态变化
    (this.manager as any).onStateChange?.((state: string) => {
      this.lastBleState = state;
      const isEnabled = state === 'PoweredOn';
      this.emit('bluetooth_state_changed', isEnabled);
      this.emitConnectionState();
    }, true);
  }

  private async ensureBluetoothReady(): Promise<void> {
    try {
      const state = await (this.manager as any).state?.();
      this.lastBleState = state || null;
      if (state === 'PoweredOn') return;
    } catch (error) {
      console.warn('⚠️ Failed to get Bluetooth state:', error);
    }

    // 等待蓝牙就绪，iOS优化的超时处理
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription?.remove?.();
        reject(new Error('Bluetooth initialization timeout'));
      }, 10000);

      const subscription = (this.manager as any).onStateChange?.((state: string) => {
        this.lastBleState = state;
        if (state === 'PoweredOn') {
          subscription?.remove?.();
          clearTimeout(timeout);
          resolve();
        } else if (state === 'Unsupported' || state === 'Unauthorized') {
          subscription?.remove?.();
          clearTimeout(timeout);
          reject(new Error(`Bluetooth ${state}`));
        }
      }, true);
    });
  }

  // === 设备扫描 ===

  public async startScan(): Promise<void> {
    await this.ensureBluetoothReady();
    
    this.emit('scan_started');
    
    const scanPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        this.emit('scan_stopped');
        resolve();
      }, this.ESP32_CONFIG.SCAN_TIMEOUT);

      // 放宽过滤条件：不使用Service UUID硬过滤，避免ESP32未在广播包中携带该UUID时被过滤掉
      // 后续在回调中再做软过滤
      this.manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            this.emit('scan_error', error);
            resolve();
            return;
          }

          if (!device) return;

          // 软过滤：名称或广播的serviceUUIDs命中即可
          const name = device.name || (device as any).localName || '';
          const serviceUUIDs: string[] | undefined = (device as any).serviceUUIDs;
          const matchesName = typeof name === 'string' && name.includes('TeethMark');
          const matchesService = Array.isArray(serviceUUIDs) && serviceUUIDs.includes(this.ESP32_CONFIG.SERVICE_UUID);

          if (matchesName || matchesService) {
            const scannedDevice: ScannedDevice = {
              id: device.id,
              name: name || device.id,
              rssi: device.rssi || undefined,
              advertisementData: (device as any).manufacturerData || (device as any).serviceData
            };
            // 调试日志，帮助定位为何之前扫描不到
            try {
              console.log('🔎 Found candidate device:', {
                id: device.id,
                name,
                rssi: device.rssi,
                serviceUUIDs
              });
            } catch {}
            this.emit('device_found', scannedDevice);
          }
        }
      );
    });

    return scanPromise;
  }

  public stopScan(): void {
    this.manager.stopDeviceScan();
    this.emit('scan_stopped');
  }

  // === 连接管理 ===

  public async connect(deviceId: string): Promise<boolean> {
    try {
      // 断开现有连接
      if (this.device) {
        await this.disconnect();
      }

      await this.ensureBluetoothReady();
      
      // iOS优化的连接参数
      const device = await this.manager.connectToDevice(deviceId, {
        timeout: this.ESP32_CONFIG.CONNECTION_TIMEOUT,
        requestMTU: this.IOS_CONFIG.MAX_MTU
      });

      this.device = device;
      
      // 发现服务和特征
      await device.discoverAllServicesAndCharacteristics();
      
      // 设置数据通知监听
      await this.setupDataNotifications();
      
      this.isConnected = true;
      this.emit('connected', deviceId);
      this.emitConnectionState();
      
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('connection_error', errorObj);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.device) return;

    try {
      // 清理通知订阅
      this.notificationSubscription?.remove?.();
      this.notificationSubscription = null;
      
      // 断开设备连接
      await this.manager.cancelDeviceConnection(this.device.id);
    } catch (error) {
      console.warn('⚠️ Error during disconnect:', error);
    } finally {
      this.device = null;
      this.isConnected = false;
      this.rxBuffer = '';
      this.emit('disconnected');
      this.emitConnectionState();
    }
  }

  // === 数据通信 ===

  private async setupDataNotifications(): Promise<void> {
    if (!this.device) {
      throw new Error('No device connected');
    }

    // 监听ESP32发送的数据
    this.notificationSubscription = await (this.device as any).monitorCharacteristicForService(
      this.ESP32_CONFIG.SERVICE_UUID,
      this.ESP32_CONFIG.RX_CHAR_UUID,
      (error: any, characteristic: any) => {
        if (error) {
          this.emit('message_error', error);
          return;
        }

        if (!characteristic?.value) return;

        try {
          const chunk = b64decode(characteristic.value);
          // 低层日志：帮助确认是否收到分片
          try {
            console.log('🔔 RX chunk len:', chunk.length, 'preview:', chunk.slice(0, 120));
          } catch {}
          this.processIncomingChunk(chunk);
        } catch (decodeError) {
          this.emit('message_error', new Error('Base64 decode failed'), characteristic.value);
        }
      }
    );
  }

  private processIncomingChunk(chunk: string): void {
    // 防止缓冲区溢出
    if (this.rxBuffer.length + chunk.length > this.maxBufferSize) {
      console.warn('⚠️ RX buffer overflow, clearing buffer');
      this.rxBuffer = '';
    }

    this.rxBuffer += chunk;

    // 处理完整的JSON消息（以换行符分隔）
    let newlineIndex;
    while ((newlineIndex = this.rxBuffer.indexOf('\n')) !== -1) {
      const jsonLine = this.rxBuffer.slice(0, newlineIndex).trim();
      this.rxBuffer = this.rxBuffer.slice(newlineIndex + 1);

      if (!jsonLine) continue;

      try {
        const rawMessage = JSON.parse(jsonLine);
        console.log('📥 Raw data from ESP32:', jsonLine);
        
        // 将ESP32原始数据转换为标准协议格式
        const standardMessage = this.convertESP32MessageToProtocol(rawMessage);
        
        // 验证转换后的消息格式
        if (validateMessage(standardMessage)) {
          console.log('📥 Converted message:', formatMessageForLog(standardMessage));
          this.emit('message_received', standardMessage);
        } else {
          console.warn('⚠️ Invalid message format after conversion:', standardMessage);
          this.emit('message_error', new Error('Invalid message format'), jsonLine);
        }
      } catch (parseError) {
        console.error('❌ JSON parse failed:', parseError, 'Raw data:', jsonLine);
        this.emit('message_error', new Error('JSON parse failed'), jsonLine);
      }
    }

    // 容错：若没有换行但缓冲区看起来是完整的JSON对象，则尝试解析一次
    const trimmed = this.rxBuffer.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const rawMessage = JSON.parse(trimmed);
        console.log('📥 Raw data from ESP32 (no-CR fallback):', trimmed);
        const standardMessage = this.convertESP32MessageToProtocol(rawMessage);
        if (validateMessage(standardMessage)) {
          console.log('📥 Converted message:', formatMessageForLog(standardMessage));
          this.emit('message_received', standardMessage);
          this.rxBuffer = '';
        }
      } catch {
        // 保留缓冲，等待更多数据或换行
      }
    }
  }

  // 将ESP32原始数据转换为标准协议格式
  private convertESP32MessageToProtocol(rawData: any): ESP32Message {
    // 检查是否为手势数据
    if (rawData.gesture && (rawData.Teeth || rawData.teeth) && (rawData.Duration !== undefined || rawData.duration !== undefined)) {
      return {
        type: 'gesture',
        data: {
          gesture: rawData.gesture,
          teeth: rawData.Teeth || rawData.teeth, // 支持大小写
          duration: rawData.Duration || rawData.duration // 支持大小写
        },
        timestamp: Date.now(),
        version: '1.0.0'
      };
    }
    
    // 检查是否为状态数据
    if (rawData.battery_level !== undefined || rawData.connection_strength !== undefined) {
      return {
        type: 'device_status',
        data: {
          battery_level: rawData.battery_level,
          connection_strength: rawData.connection_strength,
          firmware_version: rawData.firmware_version,
          device_id: rawData.device_id
        },
        timestamp: Date.now(),
        version: '1.0.0'
      };
    }
    
    // 通用消息处理
    return {
      type: rawData.type || 'unknown',
      data: rawData,
      timestamp: Date.now(),
      version: '1.0.0'
    };
  }

  public async sendMessage(message: ESP32Message): Promise<boolean> {
    if (!this.isConnected || !this.device) {
      this.emit('message_error', new Error('Device not connected'));
      return false;
    }

    try {
      const jsonString = JSON.stringify(message) + '\n';
      
      // iOS BLE数据分片发送
      const chunks = this.chunkData(jsonString);
      
      for (const chunk of chunks) {
        const encodedChunk = b64encode(chunk);
        await this.device.writeCharacteristicWithResponseForService(
          this.ESP32_CONFIG.SERVICE_UUID,
          this.ESP32_CONFIG.TX_CHAR_UUID,
          encodedChunk
        );
      }

      console.log('📤 Sent:', formatMessageForLog(message));
      this.emit('message_sent', message);
      return true;
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.emit('message_error', errorObj);
      return false;
    }
  }

  // iOS BLE数据分片
  private chunkData(data: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += this.IOS_CONFIG.CHUNK_SIZE) {
      chunks.push(data.slice(i, i + this.IOS_CONFIG.CHUNK_SIZE));
    }
    return chunks;
  }

  // === 状态查询 ===

  public getConnectionState(): ConnectionState {
    return {
      isEnabled: this.lastBleState === 'PoweredOn',
      isConnected: this.isConnected,
      connectedDevice: this.device,
      lastActivity: this.device ? Date.now() : undefined
    };
  }

  public isDeviceConnected(): boolean {
    return this.isConnected && !!this.device;
  }

  // === 工具方法 ===

  private emitConnectionState(): void {
    this.emit('connection_state_changed', this.getConnectionState());
  }

  // 健康检查
  public async healthCheck(): Promise<boolean> {
    const state = this.getConnectionState();
    
    console.log('🏥 Transport Health Check:');
    console.log(`  - Bluetooth Enabled: ${state.isEnabled}`);
    console.log(`  - Device Connected: ${state.isConnected}`);
    console.log(`  - Buffer Size: ${this.rxBuffer.length}/${this.maxBufferSize}`);

    return state.isEnabled && state.isConnected;
  }

  // 清理资源
  public async destroy(): Promise<void> {
    console.log('🔴 Destroying ESP32TransportService...');
    
    await this.disconnect();
    this.manager.stopDeviceScan();
    this.removeAllListeners();
    
    console.log('✅ ESP32TransportService destroyed');
  }
}