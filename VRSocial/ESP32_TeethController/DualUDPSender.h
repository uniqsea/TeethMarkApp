/*
 * 双UDP发送器 - 同时向Quest和PC发送数据
 * 高内聚低耦合的网络通信模块
 */

#ifndef DUAL_UDP_SENDER_H
#define DUAL_UDP_SENDER_H

#include <WiFi.h>
#include <WiFiUdp.h>
#include <IPAddress.h>

class DualUDPSender {
private:
  WiFiUDP questUDP;    // Quest通道
  WiFiUDP pcUDP;       // PC监控通道
  
  // 目标配置
  IPAddress questIP;
  int questPort;
  IPAddress pcIP;  
  int pcPort;
  
  // 统计信息
  unsigned long questSentCount;
  unsigned long questFailCount;
  unsigned long pcSentCount;
  unsigned long pcFailCount;
  
  // 错误处理
  unsigned long lastQuestSuccess;
  unsigned long lastPCSuccess;
  const unsigned long CONNECTION_TIMEOUT = 10000; // 10秒超时
  
public:
  void init(const String& questIPStr, int questPortNum,
            const String& pcIPStr, int pcPortNum);
  
  bool sendToQuest(const String& jsonData);
  bool sendToPC(const String& jsonData);
  
  // 状态查询
  bool isQuestConnected() const;
  bool isPCConnected() const;
  void getStatistics(unsigned long& qSent, unsigned long& qFail,
                    unsigned long& pSent, unsigned long& pFail) const;
  
  void printStatus() const;
  
private:
  bool sendUDP(WiFiUDP& udp, const IPAddress& ip, int port, 
               const String& data, const String& channelName);
  void updateConnectionStatus(const String& channel, bool success);
};

#endif