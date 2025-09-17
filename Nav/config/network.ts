// 网络配置 - 支持不同平台环境

const getLocalIPAddress = () => {
  // 在实际部署时，这里应该返回你的电脑的局域网IP地址
  // 你可以通过以下命令获取：
  // macOS/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
  // Windows: ipconfig | findstr "IPv4"
  
  // TODO: 替换为你的实际IP地址
  return '10.192.54.200'; // 请替换为你的电脑IP
};

export const getBackendUrl = () => {
  // Web环境
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(window.location.href);
      u.port = '8005';
      return u.origin;
    } catch {
      return 'http://10.192.54.200:8005';
    }
  }
  
  // React Native环境
  const ip = getLocalIPAddress();
  return `http://${ip}:8005`;
};

export const getWebSocketUrl = () => {
  const baseUrl = getBackendUrl();
  return baseUrl.replace('http:', 'ws:').replace('https:', 'wss:') + '/ws/mock';
};

// Study2 API（SSE 与刺激控制 /stimulus 等）
export const getStudyApiUrl = () => {
  // Web环境
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(window.location.href);
      u.port = '8076';
      return u.origin;
    } catch {
      return 'http://10.192.54.200:8076';
    }
  }

  // React Native环境
  const ip = getLocalIPAddress();
  return `http://${ip}:8076`;
};

export const getStudySseUrl = () => `${getStudyApiUrl()}/gesture_events`;