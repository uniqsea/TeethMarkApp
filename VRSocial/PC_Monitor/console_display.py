#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
控制台显示模块 - 实时显示监控数据和系统状态
美观的终端UI界面
"""

import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional
from collections import deque


class ConsoleDisplay:
    """控制台显示管理器"""
    
    def __init__(self):
        self.is_initialized = False
        self.message_history = deque(maxlen=20)  # 保留最近20条消息
        self.current_stats = {}
        self.last_update_time = datetime.now()
        
        # 显示配置
        self.show_full_json = False
        self.show_message_details = True
        self.auto_scroll = True
        
        # 颜色代码 (ANSI)
        self.colors = {
            'reset': '\\033[0m',
            'red': '\\033[91m',
            'green': '\\033[92m',
            'yellow': '\\033[93m',
            'blue': '\\033[94m',
            'magenta': '\\033[95m',
            'cyan': '\\033[96m',
            'white': '\\033[97m',
            'bold': '\\033[1m',
            'underline': '\\033[4m'
        }
    
    def initialize(self):
        """初始化控制台显示"""
        if self.is_initialized:
            return
        
        # 清屏
        self.clear_screen()
        
        # 显示标题
        self.print_header()
        
        self.is_initialized = True
        print(f"{self.colors['green']}[ConsoleDisplay] 控制台显示初始化完成{self.colors['reset']}")
    
    def clear_screen(self):
        """清屏"""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def print_header(self):
        """打印程序标题"""
        header = f"""
{self.colors['cyan']}{self.colors['bold']}
╔══════════════════════════════════════════════════════════════╗
║                    ESP32牙套数据监控系统                      ║
║                     VR Magic Controller                     ║
╚══════════════════════════════════════════════════════════════╝
{self.colors['reset']}
"""
        print(header)
    
    def display_message(self, message: Dict[str, Any]):
        """显示新接收的消息"""
        try:
            # 添加到历史记录
            self.message_history.append({
                'timestamp': message.get('timestamp', datetime.now()),
                'content': message.get('content', {}),
                'source': f"{message.get('source_ip', 'unknown')}:{message.get('source_port', 0)}",
                'type': message.get('message_type', 'unknown')
            })
            
            # 实时显示消息
            self._print_message(message)
            
        except Exception as e:
            print(f"{self.colors['red']}[ConsoleDisplay] 显示消息出错: {e}{self.colors['reset']}")
    
    def _print_message(self, message: Dict[str, Any]):
        """打印单条消息"""
        timestamp = message.get('timestamp', datetime.now())
        source = f"{message.get('source_ip', 'unknown')}:{message.get('source_port', 0)}"
        message_type = message.get('message_type', 'unknown')
        content = message.get('content', {})
        
        # 时间戳格式化
        time_str = timestamp.strftime("%H:%M:%S.%f")[:-3] if hasattr(timestamp, 'strftime') else str(timestamp)
        
        # 根据消息类型选择颜色
        type_color = self._get_type_color(message_type)
        
        print(f"{self.colors['white']}[{time_str}]{self.colors['reset']} "
              f"{type_color}[{message_type}]{self.colors['reset']} "
              f"{self.colors['cyan']}来自 {source}{self.colors['reset']}")
        
        # 显示内容详情
        if self.show_message_details and message_type == 'teeth_input':
            self._print_teeth_input_details(content)
        elif message_type == 'heartbeat':
            self._print_heartbeat_details(content)
        else:
            # 显示原始JSON（如果启用）
            if self.show_full_json:
                print(f"  {self.colors['yellow']}数据: {content}{self.colors['reset']}")
        
        print()  # 空行分隔
    
    def _print_teeth_input_details(self, content: Dict[str, Any]):
        """打印牙套输入详情"""
        gesture = content.get('gesture', 'unknown')
        teeth = content.get('teeth', [])
        duration = content.get('duration', 0)
        device_id = content.get('device_id', 'unknown')
        
        # 手势类型颜色
        gesture_color = self._get_gesture_color(gesture)
        
        print(f"  {gesture_color}手势: {gesture}{self.colors['reset']} | "
              f"{self.colors['magenta']}按钮: {teeth}{self.colors['reset']} | "
              f"{self.colors['yellow']}时长: {duration:.2f}s{self.colors['reset']} | "
              f"{self.colors['blue']}设备: {device_id}{self.colors['reset']}")
    
    def _print_heartbeat_details(self, content: Dict[str, Any]):
        """打印心跳详情"""
        wifi_rssi = content.get('wifi_rssi', 0)
        free_heap = content.get('free_heap', 0)
        
        # RSSI颜色（信号强度）
        rssi_color = self.colors['green'] if wifi_rssi > -50 else self.colors['yellow'] if wifi_rssi > -70 else self.colors['red']
        
        print(f"  {rssi_color}WiFi信号: {wifi_rssi}dBm{self.colors['reset']} | "
              f"{self.colors['cyan']}内存: {free_heap // 1024}KB{self.colors['reset']}")
    
    def update_status(self, total_messages: int, error_count: int, stats: Dict[str, Any]):
        """更新状态显示"""
        self.current_stats = {
            'total_messages': total_messages,
            'error_count': error_count,
            'stats': stats,
            'last_update': datetime.now()
        }
        
        # 每10秒显示一次状态摘要
        if (datetime.now() - self.last_update_time).seconds >= 10:
            self._print_status_summary()
            self.last_update_time = datetime.now()
    
    def _print_status_summary(self):
        """打印状态摘要"""
        stats = self.current_stats
        
        print(f"{self.colors['bold']}{self.colors['white']}--- 系统状态摘要 ---{self.colors['reset']}")
        print(f"{self.colors['green']}总消息: {stats.get('total_messages', 0)}{self.colors['reset']} | "
              f"{self.colors['red']}错误: {stats.get('error_count', 0)}{self.colors['reset']} | "
              f"{self.colors['blue']}更新时间: {datetime.now().strftime('%H:%M:%S')}{self.colors['reset']}")
        
        # 显示手势统计
        gesture_stats = stats.get('stats', {}).get('gesture_stats', {})
        if gesture_stats:
            gesture_summary = " | ".join([f"{k}: {v}" for k, v in gesture_stats.items()])
            print(f"{self.colors['magenta']}手势统计: {gesture_summary}{self.colors['reset']}")
        
        print()
    
    def _get_type_color(self, message_type: str) -> str:
        """根据消息类型获取颜色"""
        color_map = {
            'teeth_input': self.colors['green'],
            'heartbeat': self.colors['blue'],
            'error': self.colors['red'],
            'system': self.colors['cyan'],
            'unknown': self.colors['yellow']
        }
        return color_map.get(message_type, self.colors['white'])
    
    def _get_gesture_color(self, gesture: str) -> str:
        """根据手势类型获取颜色"""
        color_map = {
            'single_click': self.colors['green'],
            'long_press': self.colors['blue'],
            'multi_press': self.colors['magenta'],
            'slide': self.colors['cyan'],
            'unknown': self.colors['yellow']
        }
        return color_map.get(gesture, self.colors['white'])
    
    def print_recent_messages(self, count: int = 10):
        """打印最近的消息"""
        print(f"{self.colors['bold']}最近 {min(count, len(self.message_history))} 条消息:{self.colors['reset']}")
        
        recent_messages = list(self.message_history)[-count:]
        for i, msg in enumerate(recent_messages, 1):
            timestamp = msg['timestamp']
            time_str = timestamp.strftime("%H:%M:%S") if hasattr(timestamp, 'strftime') else str(timestamp)
            
            print(f"{i:2}. [{time_str}] {msg['type']} 来自 {msg['source']}")
            
            if msg['type'] == 'teeth_input':
                content = msg['content']
                gesture = content.get('gesture', 'unknown')
                teeth = content.get('teeth', [])
                print(f"    手势: {gesture}, 按钮: {teeth}")
        print()
    
    def show_help(self):
        """显示帮助信息"""
        help_text = f"""
{self.colors['bold']}控制台命令:{self.colors['reset']}
  {self.colors['green']}h, help{self.colors['reset']}     - 显示此帮助
  {self.colors['green']}s, status{self.colors['reset']}   - 显示系统状态
  {self.colors['green']}r, recent{self.colors['reset']}   - 显示最近消息
  {self.colors['green']}c, clear{self.colors['reset']}    - 清屏
  {self.colors['green']}q, quit{self.colors['reset']}     - 退出程序
  
{self.colors['bold']}显示设置:{self.colors['reset']}
  {self.colors['yellow']}json on/off{self.colors['reset']}  - 切换完整JSON显示
  {self.colors['yellow']}detail on/off{self.colors['reset']} - 切换详细信息显示
"""
        print(help_text)
    
    def toggle_json_display(self, enable: Optional[bool] = None):
        """切换JSON显示模式"""
        if enable is None:
            self.show_full_json = not self.show_full_json
        else:
            self.show_full_json = enable
        
        status = "开启" if self.show_full_json else "关闭"
        print(f"{self.colors['yellow']}完整JSON显示: {status}{self.colors['reset']}")
    
    def toggle_detail_display(self, enable: Optional[bool] = None):
        """切换详细信息显示"""
        if enable is None:
            self.show_message_details = not self.show_message_details
        else:
            self.show_message_details = enable
        
        status = "开启" if self.show_message_details else "关闭"
        print(f"{self.colors['yellow']}详细信息显示: {status}{self.colors['reset']}")
    
    def print_goodbye(self):
        """打印退出信息"""
        goodbye = f"""
{self.colors['cyan']}
╔══════════════════════════════════════════════════════════════╗
║                       监控系统已退出                         ║
║                     感谢使用本系统！                         ║
╚══════════════════════════════════════════════════════════════╝
{self.colors['reset']}
"""
        print(goodbye)


class InteractiveConsole:
    """交互式控制台"""
    
    def __init__(self, display: ConsoleDisplay):
        self.display = display
        self.running = False
    
    def start_interactive_mode(self):
        """启动交互模式"""
        print(f"{self.display.colors['green']}进入交互模式，输入 'help' 查看命令{self.display.colors['reset']}")
        self.running = True
        
        while self.running:
            try:
                command = input(f"{self.display.colors['bold']}> {self.display.colors['reset']}").strip().lower()
                self.process_command(command)
            except KeyboardInterrupt:
                print("\\n退出交互模式...")
                break
            except EOFError:
                break
    
    def process_command(self, command: str):
        """处理控制台命令"""
        if command in ['h', 'help']:
            self.display.show_help()
        
        elif command in ['s', 'status']:
            stats = self.display.current_stats
            print(f"总消息: {stats.get('total_messages', 0)}")
            print(f"错误数: {stats.get('error_count', 0)}")
            print(f"最后更新: {stats.get('last_update', 'N/A')}")
        
        elif command in ['r', 'recent']:
            self.display.print_recent_messages()
        
        elif command in ['c', 'clear']:
            self.display.clear_screen()
            self.display.print_header()
        
        elif command in ['q', 'quit']:
            self.running = False
        
        elif command.startswith('json'):
            parts = command.split()
            if len(parts) > 1:
                enable = parts[1].lower() == 'on'
                self.display.toggle_json_display(enable)
            else:
                self.display.toggle_json_display()
        
        elif command.startswith('detail'):
            parts = command.split()
            if len(parts) > 1:
                enable = parts[1].lower() == 'on'
                self.display.toggle_detail_display(enable)
            else:
                self.display.toggle_detail_display()
        
        elif command == '':
            pass  # 忽略空命令
        
        else:
            print(f"{self.display.colors['red']}未知命令: {command}，输入 'help' 查看帮助{self.display.colors['reset']}")


if __name__ == "__main__":
    # 测试控制台显示
    import time
    
    display = ConsoleDisplay()
    display.initialize()
    
    # 模拟消息
    test_messages = [
        {
            'timestamp': datetime.now(),
            'source_ip': '192.168.1.100',
            'source_port': 12345,
            'message_type': 'teeth_input',
            'content': {
                'gesture': 'single_click',
                'teeth': [1, 2],
                'duration': 0.5,
                'device_id': 'ESP32_TEST'
            }
        },
        {
            'timestamp': datetime.now(),
            'source_ip': '192.168.1.100',
            'source_port': 12345,
            'message_type': 'heartbeat',
            'content': {
                'wifi_rssi': -45,
                'free_heap': 123456
            }
        }
    ]
    
    for msg in test_messages:
        display.display_message(msg)
        time.sleep(1)
    
    display.update_status(100, 5, {'gesture_stats': {'single_click': 50, 'long_press': 30}})
    
    # 启动交互模式
    interactive = InteractiveConsole(display)
    interactive.start_interactive_mode()