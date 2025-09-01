import env from './env';

// MQTT Configuration
export interface MQTTConfig {
  MQTT_SERVER_URL: string;
  MQTT_TOPICS: {
    LEFT: string;
    RIGHT: string;
  };
  DEFAULT_PARAMS: {
    FREQUENCY: number;
    DUTY: number;
    DURATION: number;
    ARRIVAL_FREQUENCY: number;
    ARRIVAL_DUTY: number;
    ARRIVAL_DURATION: number;
  };
}

export const mqttConfig: MQTTConfig = {
  MQTT_SERVER_URL: env.MQTT_SERVER_URL,
  MQTT_TOPICS: {
    LEFT: 'IvyVine/left',
    RIGHT: 'IvyVine/right',
  },
  DEFAULT_PARAMS: {
    FREQUENCY: 50,
    DUTY: 80,
    DURATION: 1200,
    ARRIVAL_FREQUENCY: 10,
    ARRIVAL_DUTY: 80,
    ARRIVAL_DURATION: 600,
  }
};

export default mqttConfig;
