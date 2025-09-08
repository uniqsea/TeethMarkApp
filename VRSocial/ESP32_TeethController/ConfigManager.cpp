/*
 * 配置管理器实现
 */

#include "ConfigManager.h"

void ConfigManager::init() {
  Serial.println("初始化配置管理器...");
  
  EEPROM.begin(EEPROM_SIZE);
  
  // 尝试从EEPROM加载配置
  loadFromEEPROM();
  
  // 如果配置无效，使用默认配置
  if (!isValid()) {
    Serial.println("使用默认配置");
    setDefaults();
    saveToEEPROM(); // 保存默认配置
  }
  
  generateDeviceID();
  printConfig();
  Serial.println("配置管理器初始化完成");
}

void ConfigManager::setDefaults() {
  // 默认WiFi配置（需要用户修改）
  wifiSSID = "YourWiFiName";
  wifiPassword = "YourWiFiPassword";
  
  // 默认目标IP配置
  questIP = "192.168.1.100";    // Quest设备IP
  questPort = 8888;
  pcIP = "192.168.1.101";       // PC监控IP
  pcPort = 9999;
  
  // 默认按钮引脚配置 (GPIO)
  buttonPins = {2, 4, 5, 18};   // 4个按钮引脚
}

void ConfigManager::loadFromEEPROM() {
  // 检查配置版本
  int version;
  EEPROM.get(CONFIG_VERSION_ADDR, version);
  
  if (version != CURRENT_CONFIG_VERSION) {
    Serial.printf("配置版本不匹配: %d != %d\n", version, CURRENT_CONFIG_VERSION);
    return;
  }
  
  int addr = CONFIG_START_ADDR;
  
  // 读取WiFi配置
  wifiSSID = readStringFromEEPROM(addr);
  wifiPassword = readStringFromEEPROM(addr);
  
  // 读取目标配置
  questIP = readStringFromEEPROM(addr);
  EEPROM.get(addr, questPort); addr += sizeof(questPort);
  pcIP = readStringFromEEPROM(addr);
  EEPROM.get(addr, pcPort); addr += sizeof(pcPort);
  
  // 读取按钮配置
  int buttonCount;
  EEPROM.get(addr, buttonCount); addr += sizeof(buttonCount);
  buttonPins.clear();
  for (int i = 0; i < buttonCount && i < 8; i++) { // 最多8个按钮
    int pin;
    EEPROM.get(addr, pin); addr += sizeof(pin);
    buttonPins.push_back(pin);
  }
  
  Serial.println("从EEPROM加载配置成功");
}

void ConfigManager::saveToEEPROM() {
  Serial.println("保存配置到EEPROM...");
  
  // 写入配置版本
  EEPROM.put(CONFIG_VERSION_ADDR, CURRENT_CONFIG_VERSION);
  
  int addr = CONFIG_START_ADDR;
  
  // 写入WiFi配置
  writeStringToEEPROM(addr, wifiSSID);
  writeStringToEEPROM(addr, wifiPassword);
  
  // 写入目标配置
  writeStringToEEPROM(addr, questIP);
  EEPROM.put(addr, questPort); addr += sizeof(questPort);
  writeStringToEEPROM(addr, pcIP);
  EEPROM.put(addr, pcPort); addr += sizeof(pcPort);
  
  // 写入按钮配置
  int buttonCount = buttonPins.size();
  EEPROM.put(addr, buttonCount); addr += sizeof(buttonCount);
  for (int pin : buttonPins) {
    EEPROM.put(addr, pin); addr += sizeof(pin);
  }
  
  EEPROM.commit();
  Serial.println("配置保存完成");
}

void ConfigManager::setWiFiCredentials(const String& ssid, const String& password) {
  wifiSSID = ssid;
  wifiPassword = password;
  saveToEEPROM();
}

void ConfigManager::setTargets(const String& qIP, int qPort, 
                              const String& pIP, int pPort) {
  questIP = qIP;
  questPort = qPort;
  pcIP = pIP;
  pcPort = pPort;
  saveToEEPROM();
}

void ConfigManager::setButtonPins(const std::vector<int>& pins) {
  buttonPins = pins;
  saveToEEPROM();
}

String ConfigManager::readStringFromEEPROM(int& addr) {
  int length;
  EEPROM.get(addr, length); addr += sizeof(length);
  
  String str = "";
  for (int i = 0; i < length; i++) {
    str += char(EEPROM.read(addr++));
  }
  return str;
}

void ConfigManager::writeStringToEEPROM(int& addr, const String& str) {
  int length = str.length();
  EEPROM.put(addr, length); addr += sizeof(length);
  
  for (int i = 0; i < length; i++) {
    EEPROM.write(addr++, str[i]);
  }
}

void ConfigManager::generateDeviceID() {
  // 基于MAC地址生成唯一设备ID
  uint8_t mac[6];
  WiFi.macAddress(mac);
  
  deviceID = "ESP32_";
  for (int i = 0; i < 6; i++) {
    if (mac[i] < 16) deviceID += "0";
    deviceID += String(mac[i], HEX);
  }
  deviceID.toUpperCase();
}

bool ConfigManager::isValid() const {
  return !wifiSSID.isEmpty() && 
         !wifiPassword.isEmpty() && 
         !questIP.isEmpty() &&
         !pcIP.isEmpty() &&
         questPort > 0 && questPort < 65536 &&
         pcPort > 0 && pcPort < 65536 &&
         !buttonPins.empty();
}

void ConfigManager::printConfig() const {
  Serial.println("=== 当前配置 ===");
  Serial.printf("设备ID: %s\n", deviceID.c_str());
  Serial.printf("WiFi SSID: %s\n", wifiSSID.c_str());
  Serial.printf("Quest目标: %s:%d\n", questIP.c_str(), questPort);
  Serial.printf("PC目标: %s:%d\n", pcIP.c_str(), pcPort);
  Serial.print("按钮引脚: ");
  for (int pin : buttonPins) {
    Serial.printf("%d ", pin);
  }
  Serial.println();
  Serial.println("===============");
}