#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ESP32牙套数据监控系统
高度模块化的实时数据监控、持久化和分析系统

作者: VR魔法师项目
版本: 1.0
"""

import asyncio
import json
import signal
import sys
from datetime import datetime
from typing import Dict, Any, Optional

from udp_monitor import UDPMonitor
from data_persistence import DataPersistence
from console_display import ConsoleDisplay
from config_manager import ConfigManager
from statistics_analyzer import StatisticsAnalyzer


class TeethMonitorSystem:
    """牙套监控系统主控制器"""
    
    def __init__(self):
        self.config = ConfigManager()
        self.udp_monitor = UDPMonitor()
        self.data_persistence = DataPersistence()
        self.console_display = ConsoleDisplay()
        self.statistics = StatisticsAnalyzer()
        
        self.is_running = False
        self.total_messages = 0
        self.error_count = 0
        
        # 注册信号处理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    async def start(self):
        """启动监控系统"""
        print("=== ESP32牙套监控系统启动 ===")
        
        try:
            # 初始化各组件
            await self._initialize_components()
            
            # 启动监控
            self.is_running = True
            await self._run_monitoring_loop()
            
        except Exception as e:
            print(f"系统启动失败: {e}")
            await self.shutdown()
    
    async def _initialize_components(self):
        """初始化所有组件"""
        print("正在初始化系统组件...")
        
        # 加载配置
        self.config.load_config()
        
        # 初始化数据持久化
        self.data_persistence.initialize(self.config.get_database_config())
        
        # 初始化UDP监听
        listen_port = self.config.get_monitor_port()
        await self.udp_monitor.start_listening(listen_port)
        
        # 初始化统计分析器
        self.statistics.initialize()
        
        # 初始化控制台显示
        self.console_display.initialize()
        
        print(f"系统初始化完成，监听端口: {listen_port}")
    
    async def _run_monitoring_loop(self):
        """主监控循环"""
        print("开始监控ESP32数据...")
        
        # 创建并发任务
        tasks = [
            asyncio.create_task(self._message_processing_loop()),
            asyncio.create_task(self._statistics_update_loop()),
            asyncio.create_task(self._console_update_loop()),
            asyncio.create_task(self._heartbeat_loop())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            print("监控循环已取消")
        except Exception as e:
            print(f"监控循环出错: {e}")
            self.error_count += 1
    
    async def _message_processing_loop(self):
        """消息处理循环"""
        while self.is_running:
            try:
                # 获取新消息
                messages = await self.udp_monitor.get_new_messages()
                
                for message_data in messages:
                    await self._process_message(message_data)
                
                # 短暂延迟避免过度轮询
                await asyncio.sleep(0.01)
                
            except Exception as e:
                print(f"消息处理出错: {e}")
                self.error_count += 1
                await asyncio.sleep(0.1)
    
    async def _process_message(self, message_data: Dict[str, Any]):
        """处理单条消息"""
        try:
            self.total_messages += 1
            
            # 解析消息内容
            parsed_message = self._parse_message(message_data)
            if not parsed_message:
                return
            
            # 数据持久化
            await self.data_persistence.store_message(parsed_message)
            
            # 更新统计信息
            self.statistics.update_stats(parsed_message)
            
            # 控制台显示
            self.console_display.display_message(parsed_message)
            
        except Exception as e:
            print(f"处理消息失败: {e}")
            self.error_count += 1
    
    def _parse_message(self, message_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """解析消息数据"""
        try:
            # 提取UDP消息信息
            ip_address = message_data.get('ip', 'unknown')
            port = message_data.get('port', 0)
            raw_data = message_data.get('data', '')
            timestamp = message_data.get('timestamp', datetime.now())
            
            # 解析JSON内容
            if isinstance(raw_data, str):
                json_data = json.loads(raw_data)
            else:
                json_data = raw_data
            
            # 构建完整消息结构
            parsed_message = {
                'timestamp': timestamp,
                'source_ip': ip_address,
                'source_port': port,
                'message_type': json_data.get('type', 'teeth_input'),
                'content': json_data,
                'message_id': self.total_messages
            }
            
            return parsed_message
            
        except json.JSONDecodeError as e:
            print(f"JSON解析失败: {e}, 原始数据: {raw_data}")
            return None
        except Exception as e:
            print(f"消息解析出错: {e}")
            return None
    
    async def _statistics_update_loop(self):
        """统计信息更新循环"""
        while self.is_running:
            try:
                # 更新统计信息
                self.statistics.calculate_periodic_stats()
                
                # 每30秒更新一次
                await asyncio.sleep(30)
                
            except Exception as e:
                print(f"统计更新出错: {e}")
                await asyncio.sleep(5)
    
    async def _console_update_loop(self):
        """控制台更新循环"""
        while self.is_running:
            try:
                # 更新控制台显示
                stats = self.statistics.get_current_stats()
                self.console_display.update_status(
                    total_messages=self.total_messages,
                    error_count=self.error_count,
                    stats=stats
                )
                
                # 每秒更新一次
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"控制台更新出错: {e}")
                await asyncio.sleep(1)
    
    async def _heartbeat_loop(self):
        """心跳循环 - 定期保存数据和清理"""
        while self.is_running:
            try:
                # 强制刷新数据库
                await self.data_persistence.flush_data()
                
                # 清理旧统计数据
                self.statistics.cleanup_old_data()
                
                # 每5分钟执行一次
                await asyncio.sleep(300)
                
            except Exception as e:
                print(f"心跳处理出错: {e}")
                await asyncio.sleep(60)
    
    def _signal_handler(self, signum, frame):
        """信号处理器"""
        print(f"\\n收到信号 {signum}，准备关闭系统...")
        asyncio.create_task(self.shutdown())
    
    async def shutdown(self):
        """优雅关闭系统"""
        print("正在关闭监控系统...")
        
        self.is_running = False
        
        try:
            # 停止UDP监听
            await self.udp_monitor.stop_listening()
            
            # 保存所有数据
            await self.data_persistence.flush_and_close()
            
            # 输出最终统计
            final_stats = self.statistics.get_final_report()
            print("\\n=== 最终统计报告 ===")
            print(f"总消息数: {self.total_messages}")
            print(f"错误次数: {self.error_count}")
            print(f"运行时长: {final_stats.get('runtime', 'N/A')}")
            print("系统已关闭")
            
        except Exception as e:
            print(f"关闭过程中出错: {e}")


async def main():
    """主函数"""
    monitor = TeethMonitorSystem()
    await monitor.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\n程序被用户中断")
    except Exception as e:
        print(f"程序异常退出: {e}")
    finally:
        print("程序结束")