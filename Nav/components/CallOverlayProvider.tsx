import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect, useRef } from 'react';
import IncomingCallUI from './IncomingCallUI';
import IncomingTwilioCallCard from './IncomingTwilioCallCard';
import TwilioVoiceService from '../services/communication/TwilioVoiceService';
import DeviceIdManager from '../services/core/DeviceIdManager';
import { getBackendUrl, getWebSocketUrl } from '../config/network';
import ESP32GestureHandler, { ESP32HandlerState } from '../services/esp32/ESP32GestureHandler';
import { TwilioCallButton } from '../services/esp32/ESP32InputProcessor';

type OverlayState = {
  visible: boolean;
  callerId: string;
  onAccept?: () => void;
  onReject?: () => void;
  onRejectWithMessage?: () => void;
};

type TwilioOverlayState = {
  visible: boolean;
  from: string;
};

type CallOverlayContextValue = {
  showIncoming: (params: {
    callerId: string;
    onAccept?: () => void;
    onReject?: () => void;
    onRejectWithMessage?: () => void;
  }) => void;
  hide: () => void;
  // Twilio相关方法
  twilioService: TwilioVoiceService | null;
  // ESP32相关方法
  esp32Handler: ESP32GestureHandler | null;
  esp32State: ESP32HandlerState | null;
};

const CallOverlayContext = createContext<CallOverlayContextValue | undefined>(undefined);

export function useCallOverlay() {
  const ctx = useContext(CallOverlayContext);
  if (!ctx) throw new Error('useCallOverlay must be used within CallOverlayProvider');
  return ctx;
}

export function CallOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OverlayState>({ visible: false, callerId: '' });
  const [twilioState, setTwilioState] = useState<TwilioOverlayState>({ visible: false, from: '' });
  const [deviceId, setDeviceId] = useState<string>('');
  const [esp32State, setESP32State] = useState<ESP32HandlerState | null>(null);
  const twilioService = useRef<TwilioVoiceService | null>(null);
  const esp32Handler = useRef<ESP32GestureHandler | null>(null);

  // 初始化设备ID
  useEffect(() => {
    DeviceIdManager.getInstance().getDeviceId().then(setDeviceId);
  }, []);

  // 初始化WebSocket连接用于接收模拟来电 (仅Web)
  useEffect(() => {
    if (typeof window === 'undefined') {
      console.log('📱 Skipping WebSocket on React Native - use HTTP polling instead');
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔌 Mock call WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'mock_incoming_call') {
          console.log('📡 Received mock call via WebSocket:', data.from_number);
          setTwilioState({ visible: true, from: data.from_number });
          // 通知ESP32来电状态（使手势作用于来电卡片）
          if (esp32Handler.current) {
            esp32Handler.current.setIncomingCallState(true, { from: data.from_number });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 Mock call WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('🔌 Mock call WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  // React Native环境的HTTP轮询 (WebSocket替代方案)
  useEffect(() => {
    if (typeof window !== 'undefined') return; // 跳过Web环境

    console.log('📱 Setting up HTTP polling for React Native');
    
    // React Native环境下可以添加HTTP轮询来检查模拟来电
    // 这里暂时只是占位符，实际使用中可以实现轮询逻辑
    
    // 添加全局测试函数到global对象
    if (typeof global !== 'undefined') {
      (global as any).mockIncomingCall = (fromNumber: string = '+4552223460') => {
        console.log(`🎯 React Native mock incoming call from ${fromNumber}`);
        setTwilioState({ visible: true, from: fromNumber });
        // 通知ESP32来电状态（使手势作用于来电卡片）
        if (esp32Handler.current) {
          esp32Handler.current.setIncomingCallState(true, { from: fromNumber });
        }
      };

      (global as any).clearIncomingCall = () => {
        console.log('🔄 Clearing React Native incoming call');
        setTwilioState({ visible: false, from: '' });
      };

      console.log('🔧 React Native test functions available:');
      console.log('  global.mockIncomingCall("+4552223460") - Trigger mock incoming call');
      console.log('  global.clearIncomingCall() - Clear incoming call');
    }

  }, []);

  // 初始化ESP32手势处理器
  useEffect(() => {
    const initESP32 = async () => {
      esp32Handler.current = ESP32GestureHandler.getInstance();
      
      try {
        console.log('🔵 Initializing ESP32 Gesture Handler...');
        const success = await esp32Handler.current.initialize();
        
        if (success) {
          // 监听手势控制事件
          esp32Handler.current.on('callButtonAction', (button: TwilioCallButton) => {
            console.log('🎮 ESP32 gesture triggered button action:', button);
            handleESP32ButtonAction(button);
          });

          esp32Handler.current.on('callButtonSelected', (button: TwilioCallButton) => {
            console.log('🎯 ESP32 button selected:', button);
            // 可以在这里添加UI反馈，比如高亮选中的按钮
          });

          esp32Handler.current.on('esp32Connected', (deviceId) => {
            console.log('✅ ESP32 connected:', deviceId);
            updateESP32State();
          });

          esp32Handler.current.on('esp32Disconnected', () => {
            console.log('❌ ESP32 disconnected');
            updateESP32State();
          });

          esp32Handler.current.on('gestureProcessed', (gestureData) => {
            console.log('🎮 Gesture processed:', gestureData);
          });

          console.log('🔵 ESP32 Gesture Handler initialized successfully');
          updateESP32State();

        } else {
          console.error('🔴 Failed to initialize ESP32 Gesture Handler');
        }
      } catch (error) {
        console.error('🔴 ESP32 initialization error:', error);
      }
    };

    initESP32();

    return () => {
      if (esp32Handler.current) {
        esp32Handler.current.destroy();
      }
    };
  }, []);

  // 更新ESP32状态
  const updateESP32State = () => {
    if (esp32Handler.current) {
      setESP32State(esp32Handler.current.getCurrentState());
    }
  };

  // 处理ESP32按钮操作
  const handleESP32ButtonAction = (button: TwilioCallButton) => {
    switch (button) {
      case TwilioCallButton.ACCEPT:
        handleTwilioAccept();
        break;
      case TwilioCallButton.DECLINE:
        handleTwilioReject();
        break;
      case TwilioCallButton.BUSY_SMS:
        handleTwilioRejectWithBusy();
        break;
      default:
        console.warn('🟡 Unknown button action:', button);
    }
  };

  // 初始化Twilio服务 (仅在web环境)
  useEffect(() => {
    if (typeof window === 'undefined' || !deviceId) {
      console.log('📱 Skipping Twilio Voice SDK on React Native - not supported');
      return;
    }
    
    const baseUrl = getBackendUrl();

    twilioService.current = new TwilioVoiceService(baseUrl);
    twilioService.current.initialize(deviceId).then(() => {
      console.log('🔧 Global Twilio service initialized');
    });

    // 监听来电事件
    twilioService.current.on('incoming', ({ from }) => {
      console.log('📞 Global incoming Twilio call from:', from);
      setTwilioState({ visible: true, from });
      
      // 通知ESP32来电状态
      if (esp32Handler.current) {
        esp32Handler.current.setIncomingCallState(true, { from });
      }
    });

    twilioService.current.on('disconnected', () => {
      setTwilioState({ visible: false, from: '' });
    });

    // 添加全局测试函数
    if (typeof window !== 'undefined') {
      (window as any).mockIncomingCall = (fromNumber: string = '+4552223460') => {
        console.log(`🎯 Global mock incoming call from ${fromNumber}`);
        if (twilioService.current) {
          twilioService.current.simulateIncomingCall(fromNumber);
        }
      };

      (window as any).clearIncomingCall = () => {
        console.log('🔄 Clearing global incoming call');
        setTwilioState({ visible: false, from: '' });
      };

      console.log('🔧 Global Twilio test functions available:');
      console.log('  window.mockIncomingCall("+4552223460") - Trigger mock incoming call');
      console.log('  window.clearIncomingCall() - Clear incoming call');
    }

    return () => {
      twilioService.current?.removeAllListeners();
    };
  }, [deviceId]);

  // Twilio来电处理函数
  const handleTwilioAccept = () => {
    twilioService.current?.accept();
    setTwilioState({ visible: false, from: '' });
    
    // 通知ESP32来电已接听
    if (esp32Handler.current) {
      esp32Handler.current.setIncomingCallState(false);
      esp32Handler.current.sendSuccessFeedback('Call accepted');
    }
  };

  const handleTwilioReject = () => {
    twilioService.current?.reject();
    setTwilioState({ visible: false, from: '' });
    
    // 通知ESP32来电已挂断
    if (esp32Handler.current) {
      esp32Handler.current.setIncomingCallState(false);
      esp32Handler.current.sendSuccessFeedback('Call rejected');
    }
  };

  const handleTwilioRejectWithBusy = async () => {
    try {
      const baseUrl = getBackendUrl();
      
      await fetch(`${baseUrl}/twilio/sms/busy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: twilioState.from, 
          message: "I'm busy" 
        })
      });
      
      console.log('📱 Busy SMS sent to:', twilioState.from);
    } catch (error) {
      console.error('Failed to send busy SMS:', error);
    }
    
    twilioService.current?.reject();
    setTwilioState({ visible: false, from: '' });
    
    // 通知ESP32来电已挂断并发送忙碌短信
    if (esp32Handler.current) {
      esp32Handler.current.setIncomingCallState(false);
      esp32Handler.current.sendSuccessFeedback('Busy SMS sent');
    }
  };

  const value = useMemo<CallOverlayContextValue>(() => ({
    showIncoming: ({ callerId, onAccept, onReject, onRejectWithMessage }) =>
      setState({ visible: true, callerId, onAccept, onReject, onRejectWithMessage }),
    hide: () => setState(prev => ({ ...prev, visible: false })),
    twilioService: twilioService.current,
    esp32Handler: esp32Handler.current,
    esp32State
  }), [esp32State]);

  return (
    <CallOverlayContext.Provider value={value}>
      {children}
      
      {/* WebRTC 来电UI */}
      <IncomingCallUI
        visible={state.visible}
        callerId={state.callerId}
        onAccept={() => { state.onAccept?.(); value.hide(); }}
        onReject={() => { state.onReject?.(); value.hide(); }}
        onRejectWithMessage={() => { state.onRejectWithMessage?.(); value.hide(); }}
      />
      
      {/* Twilio 来电UI */}
      <IncomingTwilioCallCard
        visible={twilioState.visible}
        from={twilioState.from}
        onAccept={handleTwilioAccept}
        onReject={handleTwilioReject}
        onRejectWithBusy={handleTwilioRejectWithBusy}
        esp32Connected={esp32State?.bluetooth?.isConnected || false}
        selectedButton={esp32State?.gestureControl?.selectedButton || null}
      />
    </CallOverlayContext.Provider>
  );
}

export default CallOverlayProvider;
