import { EventEmitter } from 'events';
import * as Voice from '@twilio/voice-sdk';

export interface TwilioIncomingCall {
  from: string;
  to: string;
}

export type TwilioVoiceEvents =
  | 'ready'
  | 'incoming'
  | 'connected'
  | 'disconnected'
  | 'error';

export class TwilioVoiceService extends EventEmitter {
  private device: Voice.Device | null = null;
  private activeCall: Voice.Call | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
  }

  async initialize(identity?: string) {
    const tokenResp = await fetch(`${this.baseUrl}/twilio/token${identity ? `?identity=${encodeURIComponent(identity)}` : ''}`);
    const { token } = await tokenResp.json();

    // 使用正确的 Twilio Voice SDK API
    this.device = new Voice.Device(token, { allowIncomingWhileBusy: true });

    this.device.on('incoming', (call: Voice.Call) => {
      this.activeCall = call;
      const from = (call.parameters as any)?.From || '';
      const to = (call.parameters as any)?.To || '';
      this.emit('incoming', { from, to } as TwilioIncomingCall);
    });

    this.device.on('ready', () => this.emit('ready'));
    this.device.on('error', (e: any) => this.emit('error', e));
  }

  accept() {
    if (this.activeCall) {
      this.activeCall.accept();
    }
  }

  reject() {
    if (this.activeCall) {
      this.activeCall.reject();
      this.activeCall = null;
    }
  }

  hangup() {
    if (this.activeCall) {
      this.activeCall.disconnect();
      this.activeCall = null;
    }
  }

  // 添加设备状态检查方法
  isReady(): boolean {
    return this.device !== null;
  }

  // 拨打电话
  async makeCall(to: string, params?: Record<string, string>) {
    if (!this.device) {
      throw new Error('Device not initialized. Call initialize() first.');
    }
    
    const connectOptions = {
      params: {
        To: to,
        ...params
      }
    };
    
    try {
      this.activeCall = await this.device.connect(connectOptions);
      
      if (this.activeCall) {
        this.activeCall.on('accept', () => this.emit('connected'));
        this.activeCall.on('disconnect', () => {
          this.emit('disconnected');
          this.activeCall = null;
        });
      }
      
      return this.activeCall;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 销毁设备连接
  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.activeCall = null;
  }

  // 测试方法：模拟来电
  simulateIncomingCall(fromNumber: string = '+4552223460') {
    console.log(`🎯 Simulating incoming call from ${fromNumber}`);
    // 直接触发incoming事件，模拟真实来电
    // to字段使用环境变量中的验证号码
    this.emit('incoming', { 
      from: fromNumber, 
      to: '+4552223460' // TWILIO_VERIFIED_PHONE_NUMBER
    } as TwilioIncomingCall);
  }
}

export default TwilioVoiceService;


