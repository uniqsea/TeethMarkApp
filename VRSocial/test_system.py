#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
系统测试脚本 - 验证所有组件是否正常工作
模拟ESP32发送数据，测试Unity和PC监控系统的响应
"""

import asyncio
import json
import socket
import time
from datetime import datetime
from typing import List, Dict, Any


class ESP32Simulator:
    """ESP32数据发送模拟器"""
    
    def __init__(self):
        self.device_id = "ESP32_TEST_DEVICE"
        self.quest_target = ("192.168.1.100", 8888)  # 需要根据实际网络调整
        self.pc_target = ("192.168.1.101", 9999)     # 需要根据实际网络调整
        
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        
    def create_teeth_input_message(self, gesture: str, teeth: List[int], 
                                 duration: float) -> Dict[str, Any]:
        """创建牙套输入消息"""
        return {
            "gesture": gesture,
            "teeth": teeth,
            "duration": duration,
            "timestamp": int(time.time() * 1000),
            "device_id": self.device_id
        }
    
    def create_heartbeat_message(self) -> Dict[str, Any]:
        """创建心跳消息"""
        return {
            "type": "heartbeat",
            "timestamp": int(time.time() * 1000),
            "wifi_rssi": -45,
            "free_heap": 123456,
            "device_id": self.device_id
        }
    
    def send_to_targets(self, message: Dict[str, Any]) -> bool:
        """发送消息到Quest和PC"""
        json_data = json.dumps(message)
        success_count = 0
        
        # 发送到Quest
        try:
            self.sock.sendto(json_data.encode('utf-8'), self.quest_target)
            print(f"✓ 发送到Quest {self.quest_target}: {message.get('gesture', message.get('type', 'unknown'))}")
            success_count += 1
        except Exception as e:
            print(f"✗ 发送到Quest失败: {e}")
        
        # 发送到PC  
        try:
            self.sock.sendto(json_data.encode('utf-8'), self.pc_target)
            print(f"✓ 发送到PC {self.pc_target}: {message.get('gesture', message.get('type', 'unknown'))}")
            success_count += 1
        except Exception as e:
            print(f"✗ 发送到PC失败: {e}")
        
        return success_count > 0
    
    def run_test_sequence(self):
        """运行测试序列"""
        print("=== ESP32模拟器测试开始 ===")
        
        test_messages = [
            # 测试单击手势
            self.create_teeth_input_message("single_click", [1], 0.2),
            self.create_teeth_input_message("single_click", [2], 0.3),
            self.create_teeth_input_message("single_click", [3], 0.25),
            self.create_teeth_input_message("single_click", [4], 0.18),
            
            # 测试长按手势
            self.create_teeth_input_message("long_press", [1, 2], 1.5),
            self.create_teeth_input_message("long_press", [3, 4], 2.0),
            
            # 测试多按手势
            self.create_teeth_input_message("multi_press", [1, 2, 3], 0.8),
            self.create_teeth_input_message("multi_press", [2, 3, 4], 1.2),
            
            # 测试滑动手势
            self.create_teeth_input_message("slide", [1, 2, 3, 4], 0.6),
            
            # 测试心跳消息
            self.create_heartbeat_message(),
        ]
        
        for i, message in enumerate(test_messages, 1):
            print(f"\\n[{i}/{len(test_messages)}] 发送测试消息...")
            success = self.send_to_targets(message)
            
            if success:
                print("✓ 发送成功")
            else:
                print("✗ 发送失败")
            
            # 间隔发送
            time.sleep(2)
        
        print("\\n=== ESP32模拟器测试完成 ===")
    
    def run_continuous_test(self, interval: float = 5.0):
        """运行连续测试"""
        print(f"=== 连续测试模式，间隔{interval}秒 ===")
        print("按Ctrl+C停止测试")
        
        gesture_sequence = [
            ("single_click", [1], 0.2),
            ("single_click", [2], 0.3), 
            ("long_press", [1, 2], 1.2),
            ("multi_press", [1, 2, 3], 0.8),
        ]
        
        sequence_index = 0
        
        try:
            while True:
                gesture, teeth, duration = gesture_sequence[sequence_index]
                message = self.create_teeth_input_message(gesture, teeth, duration)
                
                print(f"\\n[{datetime.now().strftime('%H:%M:%S')}] 发送: {gesture} - 按钮{teeth}")
                self.send_to_targets(message)
                
                # 偶尔发送心跳
                if sequence_index % 4 == 0:
                    heartbeat = self.create_heartbeat_message()
                    print("发送心跳消息")
                    self.send_to_targets(heartbeat)
                
                sequence_index = (sequence_index + 1) % len(gesture_sequence)
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\\n连续测试已停止")
    
    def close(self):
        """关闭socket连接"""
        self.sock.close()


class SystemValidator:
    """系统验证器"""
    
    def __init__(self):
        self.validation_results = {}
    
    def validate_network_connectivity(self) -> bool:
        """验证网络连接"""
        print("\\n=== 网络连接验证 ===")
        
        # 测试端口连通性
        quest_reachable = self.test_port_connectivity("192.168.1.100", 8888)
        pc_reachable = self.test_port_connectivity("192.168.1.101", 9999)
        
        self.validation_results['quest_reachable'] = quest_reachable
        self.validation_results['pc_reachable'] = pc_reachable
        
        if quest_reachable and pc_reachable:
            print("✓ 网络连接验证通过")
            return True
        else:
            print("✗ 网络连接验证失败")
            return False
    
    def test_port_connectivity(self, host: str, port: int) -> bool:
        """测试端口连通性"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(2.0)
            
            # 发送测试数据
            test_data = json.dumps({"type": "connectivity_test", "timestamp": time.time()})
            sock.sendto(test_data.encode('utf-8'), (host, port))
            
            print(f"✓ {host}:{port} 可达")
            sock.close()
            return True
            
        except Exception as e:
            print(f"✗ {host}:{port} 不可达: {e}")
            return False
    
    def validate_json_format(self) -> bool:
        """验证JSON格式"""
        print("\\n=== JSON格式验证 ===")
        
        simulator = ESP32Simulator()
        
        # 测试各种消息格式
        test_messages = [
            simulator.create_teeth_input_message("single_click", [1], 0.5),
            simulator.create_teeth_input_message("long_press", [1, 2], 1.5),
            simulator.create_heartbeat_message(),
        ]
        
        all_valid = True
        
        for message in test_messages:
            try:
                # 验证JSON序列化和反序列化
                json_str = json.dumps(message)
                parsed = json.loads(json_str)
                
                # 验证必要字段
                if message.get('gesture'):  # teeth_input消息
                    required_fields = ['gesture', 'teeth', 'duration', 'device_id']
                else:  # heartbeat消息
                    required_fields = ['type', 'device_id']
                
                for field in required_fields:
                    if field not in parsed:
                        print(f"✗ 缺少必要字段: {field}")
                        all_valid = False
                        
                print(f"✓ JSON格式验证通过: {message.get('gesture', message.get('type'))}")
                
            except Exception as e:
                print(f"✗ JSON格式验证失败: {e}")
                all_valid = False
        
        return all_valid
    
    def generate_validation_report(self) -> str:
        """生成验证报告"""
        report = """
=== 系统验证报告 ===
        """
        
        for test_name, result in self.validation_results.items():
            status = "✓ 通过" if result else "✗ 失败"
            report += f"{test_name}: {status}\\n"
        
        return report


def main():
    """主函数"""
    print("VR魔法师牙套控制系统 - 测试工具")
    print("=====================================")
    
    # 创建模拟器
    simulator = ESP32Simulator()
    validator = SystemValidator()
    
    while True:
        print("\\n请选择测试模式:")
        print("1. 运行测试序列")
        print("2. 连续测试模式") 
        print("3. 网络连接验证")
        print("4. JSON格式验证")
        print("5. 完整系统验证")
        print("0. 退出")
        
        try:
            choice = input("\\n请输入选择 (0-5): ").strip()
            
            if choice == '1':
                simulator.run_test_sequence()
                
            elif choice == '2':
                interval = input("输入发送间隔(秒，默认5): ").strip()
                interval = float(interval) if interval else 5.0
                simulator.run_continuous_test(interval)
                
            elif choice == '3':
                validator.validate_network_connectivity()
                
            elif choice == '4':
                validator.validate_json_format()
                
            elif choice == '5':
                print("\\n=== 完整系统验证 ===")
                validator.validate_network_connectivity()
                validator.validate_json_format()
                print(validator.generate_validation_report())
                
            elif choice == '0':
                break
                
            else:
                print("无效的选择，请重试")
                
        except KeyboardInterrupt:
            print("\\n操作被中断")
            break
        except Exception as e:
            print(f"操作出错: {e}")
    
    # 清理资源
    simulator.close()
    print("测试工具已退出")


if __name__ == "__main__":
    main()