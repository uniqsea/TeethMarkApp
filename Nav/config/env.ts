// Environment Configuration
// 注意：实际使用时应该通过环境变量设置这些值

interface EnvironmentConfig {
  GOOGLE_PLACES_API_KEY: string;
  GOOGLE_DIRECTIONS_API_KEY: string;
  MQTT_SERVER_URL: string;
}

// 从环境变量获取配置，如果没有则使用默认值
const getEnvVar = (key: string, defaultValue: string): string => {
  // 在React Native中，可以通过expo-constants获取环境变量
  // 这里先使用默认值，实际部署时应该设置环境变量
  return process.env[key] || defaultValue;
};

export const env: EnvironmentConfig = {
  GOOGLE_PLACES_API_KEY: getEnvVar('GOOGLE_PLACES_API_KEY', 'AIzaSyAnlkqXkDmv7z_062kXoZi6xGbmFf999T0'),
  GOOGLE_DIRECTIONS_API_KEY: getEnvVar('GOOGLE_DIRECTIONS_API_KEY', 'AIzaSyAnlkqXkDmv7z_062kXoZi6xGbmFf999T0'),
  MQTT_SERVER_URL: getEnvVar('MQTT_SERVER_URL', 'http://10.192.94.60:8003/publish/'),
};

export default env;
