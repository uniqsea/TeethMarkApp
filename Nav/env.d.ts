// Environment variable types for the app
// These are now managed through the config system
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            GOOGLE_PLACES_API_KEY?: string;
            GOOGLE_DIRECTIONS_API_KEY?: string;
            MQTT_SERVER_URL?: string;
        }
    }
}

export {};
