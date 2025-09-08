#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UDP监听模块 - 异步接收ESP32发送的数据
高性能、线程安全的网络接收模块
"""

import asyncio
import json
import socket
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import deque


class UDPMonitor:
    """异步UDP监听器"""
    
    def __init__(self):
        self.transport = None
        self.protocol = None
        self.is_listening = False
        
        # 消息队列
        self.message_queue = deque(maxlen=10000)  # 最多缓存10000条消息
        self.message_lock = asyncio.Lock()
        
        # 统计信息
        self.total_received = 0
        self.total_errors = 0
        self.bytes_received = 0
        self.start_time = None
        
        # 配置参数
        self.max_packet_size = 65536  # UDP最大包大小
    
    async def start_listening(self, port: int, host: str = '0.0.0.0'):
        """开始UDP监听"""
        if self.is_listening:
            print(f"[UDPMonitor] 已经在监听端口 {port}")
            return
        
        try:
            # 创建UDP端点
            loop = asyncio.get_running_loop()
            
            self.transport, self.protocol = await loop.create_datagram_endpoint(
                lambda: UDPProtocol(self),
                local_addr=(host, port)
            )
            
            self.is_listening = True
            self.start_time = datetime.now()
            
            print(f"[UDPMonitor] 开始监听 {host}:{port}")
            
        except Exception as e:
            print(f"[UDPMonitor] 启动监听失败: {e}")
            raise
    
    async def stop_listening(self):
        """停止UDP监听"""
        if not self.is_listening:
            return
        
        try:
            if self.transport:
                self.transport.close()
            
            self.is_listening = False
            
            # 输出统计信息
            runtime = datetime.now() - self.start_time if self.start_time else 0
            print(f"[UDPMonitor] 监听已停止")
            print(f"[UDPMonitor] 统计: 接收{self.total_received}条消息, "
                  f"错误{self.total_errors}次, 运行时长{runtime}")
            
        except Exception as e:
            print(f"[UDPMonitor] 停止监听时出错: {e}")
    
    async def get_new_messages(self) -> List[Dict[str, Any]]:
        """获取新接收的消息（非阻塞）"""
        async with self.message_lock:
            messages = list(self.message_queue)
            self.message_queue.clear()
            return messages
    
    async def _add_message(self, message: Dict[str, Any]):
        """添加新消息到队列（内部方法）"""
        async with self.message_lock:
            self.message_queue.append(message)
            self.total_received += 1
            self.bytes_received += len(str(message.get('data', '')))
    
    def _add_error(self):
        """记录错误（内部方法）"""
        self.total_errors += 1
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        runtime = datetime.now() - self.start_time if self.start_time else 0
        
        return {
            'is_listening': self.is_listening,
            'total_received': self.total_received,
            'total_errors': self.total_errors,
            'bytes_received': self.bytes_received,
            'runtime_seconds': runtime.total_seconds() if runtime else 0,
            'queue_size': len(self.message_queue),
            'avg_message_size': (self.bytes_received / max(1, self.total_received)),
            'message_rate': (self.total_received / max(1, runtime.total_seconds()) if runtime else 0)
        }


class UDPProtocol(asyncio.DatagramProtocol):
    """UDP协议处理器"""
    
    def __init__(self, monitor: UDPMonitor):
        self.monitor = monitor
        super().__init__()
    
    def connection_made(self, transport):
        """连接建立"""
        self.transport = transport
        sock = transport.get_extra_info('socket')
        print(f"[UDPProtocol] UDP连接已建立，本地地址: {sock.getsockname()}")
    
    def datagram_received(self, data: bytes, addr: tuple):
        """接收到UDP数据包"""
        try:
            # 解码数据
            message_str = data.decode('utf-8', errors='ignore')
            
            # 构建消息对象
            message = {
                'timestamp': datetime.now(),
                'ip': addr[0],
                'port': addr[1],
                'data': message_str,
                'size': len(data)
            }
            
            # 尝试解析JSON验证数据格式
            try:
                json_data = json.loads(message_str)
                message['parsed_json'] = json_data
                message['is_valid_json'] = True
            except json.JSONDecodeError:
                message['is_valid_json'] = False
            
            # 添加到队列
            asyncio.create_task(self.monitor._add_message(message))
            
            # 调试输出（可配置）
            if hasattr(self.monitor, 'debug_mode') and self.monitor.debug_mode:
                print(f"[UDPProtocol] 收到数据来自 {addr}: {message_str[:100]}...")
            
        except Exception as e:
            print(f"[UDPProtocol] 处理数据包出错: {e}")
            self.monitor._add_error()
    
    def error_received(self, exc):
        """接收错误"""
        print(f"[UDPProtocol] UDP错误: {exc}")
        self.monitor._add_error()
    
    def connection_lost(self, exc):
        """连接丢失"""
        if exc:
            print(f"[UDPProtocol] UDP连接丢失: {exc}")
        else:
            print("[UDPProtocol] UDP连接正常关闭")


class UDPMessageFilter:
    """UDP消息过滤器 - 可选的消息处理功能"""
    
    def __init__(self):
        self.filters = []
        self.blocked_ips = set()
        self.allowed_message_types = set()
    
    def add_ip_filter(self, ip: str, allow: bool = True):
        """添加IP过滤规则"""
        if not allow:
            self.blocked_ips.add(ip)
        elif ip in self.blocked_ips:
            self.blocked_ips.remove(ip)
    
    def add_message_type_filter(self, message_types: List[str]):
        """设置允许的消息类型"""
        self.allowed_message_types.update(message_types)
    
    def should_process_message(self, message: Dict[str, Any]) -> bool:
        """判断消息是否应该被处理"""
        # IP过滤
        if message['ip'] in self.blocked_ips:
            return False
        
        # 消息类型过滤
        if self.allowed_message_types:
            json_data = message.get('parsed_json', {})
            message_type = json_data.get('type', 'unknown')
            if message_type not in self.allowed_message_types:
                return False
        
        return True
    
    def get_filter_stats(self) -> Dict[str, Any]:
        """获取过滤统计"""
        return {
            'blocked_ips_count': len(self.blocked_ips),
            'allowed_message_types': list(self.allowed_message_types),
            'filter_rules_count': len(self.filters)
        }


# 测试用的独立运行代码
async def test_udp_monitor():
    """测试UDP监听器"""
    monitor = UDPMonitor()
    
    try:
        await monitor.start_listening(9999)
        print("UDP监听器已启动，按Ctrl+C停止...")
        
        while True:
            messages = await monitor.get_new_messages()
            for msg in messages:
                print(f"收到消息: {msg}")
            
            await asyncio.sleep(1)
    
    except KeyboardInterrupt:
        print("\\n停止测试...")
    finally:
        await monitor.stop_listening()


if __name__ == "__main__":
    asyncio.run(test_udp_monitor())