/*
 * ESP32牙套控制器 - 双UDP通道发送
 * 同时向Quest和PC发送牙套按钮数据
 * 
 * 作者: VR魔法师项目
 * 版本: 1.0
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include "TeethInputManager.h"
#include "DualUDPSender.h"
#include "ConfigManager.h"

// 全局组件实例
TeethInputManager inputManager;
DualUDPSender udpSender;
ConfigManager config;

// 系统状态
bool systemReady = false;
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 5000; // 5秒心跳

void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32牙套控制器启动 ===");
  
  // 初始化配置
  config.init();
  
  // 初始化输入管理器
  inputManager.init(config.getButtonPins());
  
  // 连接WiFi
  connectWiFi();
  
  // 初始化UDP发送器
  udpSender.init(config.getQuestIP(), config.getQuestPort(), 
                 config.getPCIP(), config.getPCPort());
  
  systemReady = true;
  Serial.println("系统就绪，开始监听按钮输入...");
}

void loop() {
  if (!systemReady) {
    delay(100);
    return;
  }
  
  // 检查WiFi连接
  checkWiFiConnection();
  
  // 处理按钮输入
  handleTeethInput();
  
  // 发送心跳
  sendHeartbeatIfNeeded();
  
  delay(10); // 避免过度轮询
}

void connectWiFi() {
  Serial.print("连接WiFi: ");
  Serial.println(config.getSSID());
  
  WiFi.begin(config.getSSID(), config.getPassword());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi连接成功! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi连接失败!");
    // 进入AP模式用于配置
    startConfigMode();
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi连接丢失，尝试重连...");
    connectWiFi();
  }
}

void handleTeethInput() {
  TeethInput input = inputManager.checkInput();
  
  if (input.isValid) {
    // 构建JSON数据
    DynamicJsonDocument doc(1024);
    doc["gesture"] = input.gesture;
    doc["teeth"] = input.teeth;
    doc["duration"] = input.duration;
    doc["timestamp"] = millis();
    doc["device_id"] = config.getDeviceID();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // 双通道发送
    bool questSent = udpSender.sendToQuest(jsonString);
    bool pcSent = udpSender.sendToPC(jsonString);
    
    // 日志输出
    Serial.printf("按钮输入: %s | Quest:%s PC:%s\n", 
                  jsonString.c_str(),
                  questSent ? "✓" : "✗",
                  pcSent ? "✓" : "✗");
  }
}

void sendHeartbeatIfNeeded() {
  unsigned long now = millis();
  if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
    
    DynamicJsonDocument doc(512);
    doc["type"] = "heartbeat";
    doc["timestamp"] = now;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["device_id"] = config.getDeviceID();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    udpSender.sendToPC(jsonString); // 心跳只发送给PC监控
    lastHeartbeat = now;
  }
}

void startConfigMode() {
  Serial.println("进入配置模式...");
  // 这里可以实现Web配置界面
  // 简化版本：通过串口配置
}