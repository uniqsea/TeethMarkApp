declare module 'react-native-ble-plx' {
  export class Device {
    id: string;
    name?: string | null;
    discoverAllServicesAndCharacteristics(): Promise<Device>;
    monitorCharacteristicForService(serviceUUID: string, charUUID: string, listener: (error: any, characteristic: any) => void): Promise<void> | any;
    writeCharacteristicWithResponseForService(serviceUUID: string, charUUID: string, valueBase64: string): Promise<any>;
  }
  export class BleManager {
    startDeviceScan(uuids: string[] | null, options: { allowDuplicates?: boolean } | null, listener: (error: any, device: Device | null) => void): { remove(): void };
    stopDeviceScan(): void;
    connectToDevice(id: string, options?: { timeout?: number }): Promise<Device>;
    cancelDeviceConnection(id: string): Promise<void>;
  }
  export interface Characteristic {}
}
