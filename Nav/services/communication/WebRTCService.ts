import { webRTCConfig } from '../../config';
import 'webrtc-adapter';

export interface CallMessage {
  type: 'text' | 'busy' | 'call_end';
  content: string;
  timestamp: number;
  sender: string;
}

export interface CallState {
  isConnected: boolean; // 信令服务器连接状态
  isInCall: boolean;    // WebRTC 通话状态
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  messages: CallMessage[];
  incomingCall: boolean;
  callerId?: string;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private signalingSocket: WebSocket | null = null;
  private deviceId: string;
  private currentPeerId: string | null = null;
  
  public onStateChange?: (state: Partial<CallState>) => void;
  public onIncomingCall?: (callerId: string) => void;
  public onCallEnd?: () => void;
  public onMessage?: (message: CallMessage) => void;
  public onDeviceListUpdate?: (deviceIds: string[]) => void;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.setupSignaling();
  }

  private setupSignaling() {
    try {
      this.signalingSocket = new WebSocket(webRTCConfig.signaling.url);
      
      this.signalingSocket.onopen = () => {
        console.log('Signaling connected');
        // 设置信令连接为已连接（收到 registered 时也会再次确认）
        this.onStateChange?.({ isConnected: true });
        this.signalingSocket?.send(JSON.stringify({
          type: 'register',
          device_id: this.deviceId
        }));
      };

      this.signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };

      this.signalingSocket.onerror = (error) => {
        console.error('Signaling error:', error);
      };

      this.signalingSocket.onclose = () => {
        console.log('Signaling disconnected, reconnecting...');
        // 设置连接状态为断开
        this.onStateChange?.({ isConnected: false });
        setTimeout(() => this.setupSignaling(), webRTCConfig.signaling.reconnectDelay);
      };
    } catch (error) {
      console.error('Failed to setup signaling:', error);
    }
  }

  private async handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'registered':
        console.log('Device registered successfully:', message.device_id);
        console.log('Online devices:', message.online_devices);
        // 设置信令连接状态为已连接
        this.onStateChange?.({ isConnected: true });
        // 通知设备列表更新
        if (message.online_devices && Array.isArray(message.online_devices)) {
          this.onDeviceListUpdate?.(message.online_devices);
        }
        break;
      
      case 'device_list':
        // 服务端广播的在线设备变更
        if (message.online_devices && Array.isArray(message.online_devices)) {
          this.onDeviceListUpdate?.(message.online_devices);
        }
        break;
        
      case 'incoming_call':
        this.currentPeerId = message.from;
        this.onIncomingCall?.(message.from);
        this.onStateChange?.({ incomingCall: true, callerId: message.from });
        break;
      
      case 'call_accepted':
        await this.startCall(false);
        break;
      
      case 'call_rejected':
        this.onCallEnd?.();
        break;
      
      case 'offer':
        await this.handleOffer(message.offer, message.from);
        break;
      
      case 'answer':
        await this.handleAnswer(message.answer);
        break;
      
      case 'ice_candidate':
        await this.handleIceCandidate(message.candidate);
        break;
      
      case 'chat':
        // Signaling-based chat fallback
        if (message && typeof message.content === 'string') {
          const msg: CallMessage = {
            type: 'text',
            content: message.content,
            timestamp: message.timestamp || Date.now(),
            sender: message.sender || message.from || 'unknown',
          };
          this.onMessage?.(msg);
        }
        break;
      
      case 'call_end':
        this.endCall();
        break;
        
      case 'call_failed':
        console.error('Call failed:', message.reason);
        this.onCallEnd?.();
        break;
    }
  }

  private sendSignalingMessage(message: any) {
    if (this.signalingSocket?.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(message));
    }
  }

  async initializeCall(targetDeviceId: string) {
    console.log(`Initiating call to ${targetDeviceId}`);
    this.currentPeerId = targetDeviceId;
    this.sendSignalingMessage({
      type: 'call_request',
      to: targetDeviceId,
      from: this.deviceId
    });
  }

  async acceptCall() {
    console.log('Accepting call');
    this.onStateChange?.({ incomingCall: false });
    this.sendSignalingMessage({
      type: 'call_accepted',
      from: this.deviceId,
      to: this.currentPeerId
    });
    await this.startCall(true);
  }

  rejectCall() {
    console.log('Rejecting call');
    this.onStateChange?.({ incomingCall: false });
    this.sendSignalingMessage({
      type: 'call_rejected',
      from: this.deviceId,
      to: this.currentPeerId
    });
  }

  async rejectCallWithBusyMessage() {
    this.rejectCall();
    this.sendMessage({
      type: 'busy',
      content: "I'm busy",
      timestamp: Date.now(),
      sender: this.deviceId
    });
  }

  private async startCall(isReceiver: boolean) {
    try {
      // 获取音频流 (Web / React Native Web)
      const mediaDevices: any = (navigator as any)?.mediaDevices;
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
        throw new TypeError('navigator.mediaDevices.getUserMedia is not available');
      }
      this.localStream = await mediaDevices.getUserMedia({
        audio: webRTCConfig.audio,
        video: false
      });

      // 创建 PeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: webRTCConfig.iceServers
      });

      // 添加本地流
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 创建数据通道 (只有发起方创建)
      if (!isReceiver) {
        this.dataChannel = this.peerConnection.createDataChannel('messages', webRTCConfig.dataChannel);
        this.setupDataChannel(this.dataChannel);
      }

      // 处理远程流
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        this.onStateChange?.({ 
          remoteStream: event.streams[0],
          localStream: this.localStream 
        });
      };

      // 处理数据通道 (接收方)
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        this.setupDataChannel(channel);
      };

      // 处理 ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage({
            type: 'ice_candidate',
            candidate: event.candidate,
            to: this.currentPeerId
          });
        }
      };

      // 连接状态变化
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          this.onStateChange?.({ isInCall: true });
        } else if (state === 'disconnected' || state === 'failed') {
          this.endCall();
        }
      };

      // 如果是发起方，创建 offer
      if (!isReceiver) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.sendSignalingMessage({
          type: 'offer',
          offer: offer,
          to: this.currentPeerId
        });
      }

    } catch (error) {
      console.error('Error starting call:', error);
      this.onCallEnd?.();
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onmessage = (event) => {
      try {
        const message: CallMessage = JSON.parse(event.data);
        this.onMessage?.(message);
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, from: string) {
    if (!this.peerConnection) {
      await this.startCall(true);
    }

    await this.peerConnection?.setRemoteDescription(offer);
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      answer: answer,
      to: from
    });
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection?.setRemoteDescription(answer);
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    await this.peerConnection?.addIceCandidate(candidate);
  }

  sendMessage(message: Omit<CallMessage, 'timestamp' | 'sender'>, targetId?: string) {
    const fullMessage: CallMessage = {
      ...message,
      timestamp: Date.now(),
      sender: this.deviceId
    };
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(fullMessage));
      this.onMessage?.(fullMessage);
      return;
    }
    if (targetId) {
      this.sendSignalingMessage({
        type: 'chat',
        to: targetId,
        content: fullMessage.content,
        timestamp: fullMessage.timestamp,
        sender: fullMessage.sender,
      });
      this.onMessage?.(fullMessage);
    }
  }

  endCall() {
    console.log('Ending call');
    
    // 停止本地流
    this.localStream?.getTracks().forEach(track => track.stop());
    
    // 关闭连接
    this.dataChannel?.close();
    this.peerConnection?.close();
    
    // 重置状态
    this.localStream = null;
    this.dataChannel = null;
    this.peerConnection = null;
    
    // 发送结束信号
    this.sendSignalingMessage({
      type: 'call_end',
      from: this.deviceId
    });
    
    // 更新状态 (保持信令连接状态)
    this.onStateChange?.({
      isInCall: false,
      remoteStream: null,
      localStream: null,
      incomingCall: false
    });
    
    this.onCallEnd?.();
  }

  destroy() {
    this.endCall();
    this.signalingSocket?.close();
  }
}

export default WebRTCService;
