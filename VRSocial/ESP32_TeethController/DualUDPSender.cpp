/*
 * 双UDP发送器实现
 */

#include "DualUDPSender.h"

void DualUDPSender::init(const String& questIPStr, int questPortNum,
                        const String& pcIPStr, int pcPortNum) {
  Serial.println("初始化双UDP发送器...");
  
  // 解析IP地址
  questIP.fromString(questIPStr);
  questPort = questPortNum;
  pcIP.fromString(pcIPStr);
  pcPort = pcPortNum;
  
  // 初始化UDP连接
  questUDP.begin(8001); // 本地端口
  pcUDP.begin(8002);    // 本地端口
  
  // 初始化统计
  questSentCount = 0;
  questFailCount = 0;
  pcSentCount = 0;
  pcFailCount = 0;
  lastQuestSuccess = millis();
  lastPCSuccess = millis();
  
  Serial.printf("Quest目标: %s:%d\n", questIPStr.c_str(), questPortNum);
  Serial.printf("PC目标: %s:%d\n", pcIPStr.c_str(), pcPortNum);
  Serial.println("双UDP发送器初始化完成");
}

bool DualUDPSender::sendToQuest(const String& jsonData) {
  bool success = sendUDP(questUDP, questIP, questPort, jsonData, "Quest");
  
  if (success) {
    questSentCount++;
    lastQuestSuccess = millis();
  } else {
    questFailCount++;
  }
  
  return success;
}

bool DualUDPSender::sendToPC(const String& jsonData) {
  bool success = sendUDP(pcUDP, pcIP, pcPort, jsonData, "PC");
  
  if (success) {
    pcSentCount++;
    lastPCSuccess = millis();
  } else {
    pcFailCount++;
  }
  
  return success;
}

bool DualUDPSender::sendUDP(WiFiUDP& udp, const IPAddress& ip, int port,
                           const String& data, const String& channelName) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("%s发送失败: WiFi未连接\n", channelName.c_str());
    return false;
  }
  
  if (!udp.beginPacket(ip, port)) {
    Serial.printf("%s发送失败: 无法开始数据包\n", channelName.c_str());
    return false;
  }
  
  size_t bytesWritten = udp.write((const uint8_t*)data.c_str(), data.length());
  if (bytesWritten != data.length()) {
    Serial.printf("%s发送失败: 写入字节数不匹配 (%d/%d)\n", 
                  channelName.c_str(), bytesWritten, data.length());
    udp.endPacket(); // 清理
    return false;
  }
  
  if (!udp.endPacket()) {
    Serial.printf("%s发送失败: 无法完成数据包发送\n", channelName.c_str());
    return false;
  }
  
  // 详细日志（可选）
  #ifdef DEBUG_UDP
  Serial.printf("%s发送成功: %d字节到 %s:%d\n", 
                channelName.c_str(), data.length(), 
                ip.toString().c_str(), port);
  #endif
  
  return true;
}

bool DualUDPSender::isQuestConnected() const {
  return (millis() - lastQuestSuccess) < CONNECTION_TIMEOUT;
}

bool DualUDPSender::isPCConnected() const {
  return (millis() - lastPCSuccess) < CONNECTION_TIMEOUT;
}

void DualUDPSender::getStatistics(unsigned long& qSent, unsigned long& qFail,
                                 unsigned long& pSent, unsigned long& pFail) const {
  qSent = questSentCount;
  qFail = questFailCount;
  pSent = pcSentCount;
  pFail = pcFailCount;
}

void DualUDPSender::printStatus() const {
  Serial.println("=== UDP发送器状态 ===");
  Serial.printf("Quest: 成功=%lu, 失败=%lu, 连接=%s\n",
                questSentCount, questFailCount,
                isQuestConnected() ? "是" : "否");
  Serial.printf("PC: 成功=%lu, 失败=%lu, 连接=%s\n",
                pcSentCount, pcFailCount,
                isPCConnected() ? "是" : "否");
  Serial.println("====================");
}