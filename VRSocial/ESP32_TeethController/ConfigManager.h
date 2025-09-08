/*
 * 配置管理器 - 统一管理ESP32所有配置参数
 * 支持EEPROM持久化存储
 */

#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <vector>
#include <EEPROM.h>

class ConfigManager {
private:
  // WiFi配置
  String wifiSSID;
  String wifiPassword;
  
  // 目标设备配置
  String questIP;
  int questPort;
  String pcIP;
  int pcPort;
  
  // 硬件配置
  std::vector<int> buttonPins;
  String deviceID;
  
  // EEPROM地址映射
  const int EEPROM_SIZE = 512;
  const int CONFIG_VERSION_ADDR = 0;
  const int CONFIG_START_ADDR = 4;
  const int CURRENT_CONFIG_VERSION = 1;
  
  // 默认配置
  void setDefaults();
  
public:
  void init();
  void loadFromEEPROM();
  void saveToEEPROM();
  
  // WiFi配置
  const char* getSSID() const { return wifiSSID.c_str(); }
  const char* getPassword() const { return wifiPassword.c_str(); }
  void setWiFiCredentials(const String& ssid, const String& password);
  
  // 目标设备配置  
  const String& getQuestIP() const { return questIP; }
  int getQuestPort() const { return questPort; }
  const String& getPCIP() const { return pcIP; }
  int getPCPort() const { return pcPort; }
  void setTargets(const String& qIP, int qPort, const String& pIP, int pPort);
  
  // 硬件配置
  const std::vector<int>& getButtonPins() const { return buttonPins; }
  const String& getDeviceID() const { return deviceID; }
  void setButtonPins(const std::vector<int>& pins);
  
  // 调试和状态
  void printConfig() const;
  bool isValid() const;
  
private:
  String readStringFromEEPROM(int& addr);
  void writeStringToEEPROM(int& addr, const String& str);
  void generateDeviceID();
};

#endif