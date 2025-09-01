// 设备 ID 生成和管理的统一工具
import AsyncStorage from '@react-native-async-storage/async-storage';

export class DeviceIdManager {
  private static instance: DeviceIdManager;
  private deviceId: string | null = null;

  private constructor() {}

  public static getInstance(): DeviceIdManager {
    if (!DeviceIdManager.instance) {
      DeviceIdManager.instance = new DeviceIdManager();
    }
    return DeviceIdManager.instance;
  }

  public async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      let id = await AsyncStorage.getItem('device_id');
      if (!id) {
        // 统一使用 device_ 前缀
        const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? `device_${(crypto as any).randomUUID()}`
          : `device_${Math.random().toString(36).slice(2, 11)}`;
        await AsyncStorage.setItem('device_id', newId);
        id = newId;
      }
      this.deviceId = id;
      return id;
    } catch (e) {
      // Fallback if storage fails
      const fallback = `device_${Math.random().toString(36).slice(2, 11)}`;
      this.deviceId = fallback;
      return fallback;
    }
  }

  public getCurrentDeviceId(): string | null {
    return this.deviceId;
  }

  public async clearDeviceId(): Promise<void> {
    this.deviceId = null;
    try {
      await AsyncStorage.removeItem('device_id');
    } catch (e) {
      console.warn('Failed to clear device ID from storage:', e);
    }
  }
}

export default DeviceIdManager;
