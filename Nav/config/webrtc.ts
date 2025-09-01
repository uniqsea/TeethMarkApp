// WebRTC Configuration
export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  signaling: {
    url: string;
    reconnectDelay: number;
  };
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
  dataChannel: {
    ordered: boolean;
    maxRetransmits: number;
  };
}

export const webRTCConfig: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  signaling: {
    url: 'ws://10.192.54.149:8004', // WebSocket signaling server
    reconnectDelay: 3000,
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  dataChannel: {
    ordered: true,
    maxRetransmits: 3,
  }
};

export default webRTCConfig;
