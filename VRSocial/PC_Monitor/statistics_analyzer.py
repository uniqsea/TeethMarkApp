#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统计分析模块 - 实时分析和统计牙套数据
提供详细的使用统计和性能分析
"""

import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
from dataclasses import dataclass, field


@dataclass
class DeviceStats:
    """设备统计信息"""
    device_id: str
    ip_address: str
    first_seen: datetime
    last_seen: datetime
    total_messages: int = 0
    gesture_counts: Dict[str, int] = field(default_factory=dict)
    error_count: int = 0
    avg_response_time: float = 0.0


@dataclass  
class GestureStats:
    """手势统计信息"""
    gesture_type: str
    total_count: int = 0
    avg_duration: float = 0.0
    min_duration: float = float('inf')
    max_duration: float = 0.0
    button_combinations: Dict[str, int] = field(default_factory=dict)
    hourly_distribution: Dict[int, int] = field(default_factory=lambda: defaultdict(int))


class StatisticsAnalyzer:
    """统计分析器"""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.device_stats = {}  # device_id -> DeviceStats
        self.gesture_stats = {}  # gesture -> GestureStats
        self.hourly_message_counts = defaultdict(int)
        self.daily_message_counts = defaultdict(int)
        
        # 实时统计队列
        self.recent_messages = deque(maxlen=1000)  # 最近1000条消息
        self.message_timestamps = deque(maxlen=100)  # 用于计算消息速率
        
        # 性能统计
        self.processing_times = deque(maxlen=1000)
        self.error_log = deque(maxlen=500)
        
        # 系统统计
        self.total_messages_processed = 0
        self.total_errors = 0
        self.total_bytes_received = 0
        
        print("[StatisticsAnalyzer] 统计分析器初始化完成")
    
    def initialize(self):
        """初始化统计分析器"""
        # 可以在这里加载历史统计数据
        pass
    
    def update_stats(self, message: Dict[str, Any]):
        """更新统计信息"""
        start_time = time.time()
        
        try:
            self.total_messages_processed += 1
            
            # 添加到最近消息队列
            self.recent_messages.append(message)
            
            # 记录时间戳用于速率计算
            timestamp = message.get('timestamp', datetime.now())
            self.message_timestamps.append(timestamp)
            
            # 更新时间分布统计
            self._update_time_distribution(timestamp)
            
            # 解析消息内容
            content = message.get('content', {})
            message_type = message.get('message_type', 'unknown')
            
            if message_type == 'teeth_input':
                self._update_teeth_input_stats(message, content)
            elif message_type == 'heartbeat':
                self._update_heartbeat_stats(message, content)
            
            # 更新设备统计
            self._update_device_stats(message, content)
            
        except Exception as e:
            self.total_errors += 1
            self.error_log.append({
                'timestamp': datetime.now(),
                'error': str(e),
                'message_type': message.get('message_type', 'unknown')
            })
            print(f"[StatisticsAnalyzer] 更新统计失败: {e}")
        
        finally:
            # 记录处理时间
            processing_time = time.time() - start_time
            self.processing_times.append(processing_time)
    
    def _update_time_distribution(self, timestamp: datetime):
        """更新时间分布统计"""
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        hour = timestamp.hour
        date_str = timestamp.strftime('%Y-%m-%d')
        
        self.hourly_message_counts[hour] += 1
        self.daily_message_counts[date_str] += 1
    
    def _update_teeth_input_stats(self, message: Dict[str, Any], content: Dict[str, Any]):
        """更新牙套输入统计"""
        gesture = content.get('gesture', 'unknown')
        teeth = content.get('teeth', [])
        duration = content.get('duration', 0.0)
        
        # 更新手势统计
        if gesture not in self.gesture_stats:
            self.gesture_stats[gesture] = GestureStats(gesture_type=gesture)
        
        stats = self.gesture_stats[gesture]
        stats.total_count += 1
        
        # 更新持续时间统计
        if duration > 0:
            total_duration = stats.avg_duration * (stats.total_count - 1) + duration
            stats.avg_duration = total_duration / stats.total_count
            stats.min_duration = min(stats.min_duration, duration)
            stats.max_duration = max(stats.max_duration, duration)
        
        # 更新按钮组合统计
        button_combo = '-'.join(map(str, sorted(teeth)))
        if button_combo:
            stats.button_combinations[button_combo] = stats.button_combinations.get(button_combo, 0) + 1
        
        # 更新小时分布
        timestamp = message.get('timestamp', datetime.now())
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        stats.hourly_distribution[timestamp.hour] += 1
    
    def _update_heartbeat_stats(self, message: Dict[str, Any], content: Dict[str, Any]):
        """更新心跳统计"""
        # 心跳消息主要用于设备状态监控
        # 具体统计在设备统计中处理
        pass
    
    def _update_device_stats(self, message: Dict[str, Any], content: Dict[str, Any]):
        """更新设备统计"""
        device_id = content.get('device_id', 'unknown')
        ip_address = message.get('source_ip', 'unknown')
        timestamp = message.get('timestamp', datetime.now())
        
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        if device_id not in self.device_stats:
            self.device_stats[device_id] = DeviceStats(
                device_id=device_id,
                ip_address=ip_address,
                first_seen=timestamp,
                last_seen=timestamp
            )
        
        stats = self.device_stats[device_id]
        stats.last_seen = timestamp
        stats.total_messages += 1
        stats.ip_address = ip_address  # 更新IP地址
        
        # 更新手势计数
        if message.get('message_type') == 'teeth_input':
            gesture = content.get('gesture', 'unknown')
            stats.gesture_counts[gesture] = stats.gesture_counts.get(gesture, 0) + 1
    
    def calculate_periodic_stats(self):
        """计算周期性统计"""
        # 清理过期的时间戳
        now = datetime.now()
        cutoff_time = now - timedelta(minutes=5)  # 只保留5分钟内的数据
        
        while self.message_timestamps and self.message_timestamps[0] < cutoff_time:
            self.message_timestamps.popleft()
    
    def get_current_stats(self) -> Dict[str, Any]:
        """获取当前统计信息"""
        now = datetime.now()
        runtime = now - self.start_time
        
        # 计算消息速率
        message_rate = self._calculate_message_rate()
        
        # 计算平均处理时间
        avg_processing_time = (
            sum(self.processing_times) / len(self.processing_times)
            if self.processing_times else 0
        )
        
        # 手势统计摘要
        gesture_stats = {
            gesture: {
                'count': stats.total_count,
                'avg_duration': round(stats.avg_duration, 2),
                'top_buttons': self._get_top_button_combinations(stats.button_combinations, 3)
            }
            for gesture, stats in self.gesture_stats.items()
        }
        
        # 设备统计摘要
        active_devices = len([
            dev for dev in self.device_stats.values()
            if (now - dev.last_seen).total_seconds() < 300  # 5分钟内活跃
        ])
        
        return {
            'runtime_seconds': runtime.total_seconds(),
            'total_messages': self.total_messages_processed,
            'total_errors': self.total_errors,
            'message_rate_per_minute': message_rate,
            'avg_processing_time_ms': round(avg_processing_time * 1000, 2),
            'gesture_stats': gesture_stats,
            'total_devices': len(self.device_stats),
            'active_devices': active_devices,
            'recent_message_count': len(self.recent_messages),
            'error_rate_percent': round((self.total_errors / max(1, self.total_messages_processed)) * 100, 2)
        }
    
    def _calculate_message_rate(self) -> float:
        """计算消息速率（每分钟）"""
        if len(self.message_timestamps) < 2:
            return 0.0
        
        now = datetime.now()
        one_minute_ago = now - timedelta(minutes=1)
        
        recent_count = sum(1 for ts in self.message_timestamps if ts >= one_minute_ago)
        return recent_count
    
    def _get_top_button_combinations(self, combinations: Dict[str, int], limit: int) -> List[tuple]:
        """获取最常用的按钮组合"""
        sorted_combos = sorted(combinations.items(), key=lambda x: x[1], reverse=True)
        return sorted_combos[:limit]
    
    def get_device_summary(self) -> List[Dict[str, Any]]:
        """获取设备摘要"""
        now = datetime.now()
        
        summary = []
        for device_id, stats in self.device_stats.items():
            last_seen_minutes = (now - stats.last_seen).total_seconds() / 60
            
            summary.append({
                'device_id': device_id,
                'ip_address': stats.ip_address,
                'total_messages': stats.total_messages,
                'last_seen_minutes_ago': round(last_seen_minutes, 1),
                'is_active': last_seen_minutes < 5,  # 5分钟内活跃
                'top_gesture': max(stats.gesture_counts.items(), key=lambda x: x[1])[0] if stats.gesture_counts else 'none',
                'first_seen': stats.first_seen.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return sorted(summary, key=lambda x: x['last_seen_minutes_ago'])
    
    def get_gesture_details(self, gesture: str) -> Optional[Dict[str, Any]]:
        """获取特定手势的详细统计"""
        if gesture not in self.gesture_stats:
            return None
        
        stats = self.gesture_stats[gesture]
        
        return {
            'gesture_type': stats.gesture_type,
            'total_count': stats.total_count,
            'avg_duration': round(stats.avg_duration, 2),
            'min_duration': round(stats.min_duration, 2) if stats.min_duration != float('inf') else 0,
            'max_duration': round(stats.max_duration, 2),
            'button_combinations': dict(stats.button_combinations),
            'hourly_distribution': dict(stats.hourly_distribution),
            'percentage_of_total': round((stats.total_count / max(1, self.total_messages_processed)) * 100, 2)
        }
    
    def get_time_distribution(self) -> Dict[str, Any]:
        """获取时间分布统计"""
        return {
            'hourly_distribution': dict(self.hourly_message_counts),
            'daily_distribution': dict(self.daily_message_counts),
            'peak_hour': max(self.hourly_message_counts.items(), key=lambda x: x[1])[0] if self.hourly_message_counts else 0,
            'total_days': len(self.daily_message_counts)
        }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """获取性能统计"""
        if not self.processing_times:
            return {'avg_processing_time_ms': 0, 'max_processing_time_ms': 0}
        
        processing_times_ms = [t * 1000 for t in self.processing_times]
        
        return {
            'avg_processing_time_ms': round(sum(processing_times_ms) / len(processing_times_ms), 2),
            'max_processing_time_ms': round(max(processing_times_ms), 2),
            'min_processing_time_ms': round(min(processing_times_ms), 2),
            'total_samples': len(processing_times_ms)
        }
    
    def get_error_summary(self) -> Dict[str, Any]:
        """获取错误摘要"""
        if not self.error_log:
            return {'total_errors': 0, 'recent_errors': []}
        
        # 最近1小时的错误
        one_hour_ago = datetime.now() - timedelta(hours=1)
        recent_errors = [
            error for error in self.error_log 
            if error['timestamp'] >= one_hour_ago
        ]
        
        return {
            'total_errors': len(self.error_log),
            'recent_errors_count': len(recent_errors),
            'recent_errors': recent_errors[-10:],  # 最近10个错误
            'error_rate_per_hour': len(recent_errors)
        }
    
    def cleanup_old_data(self):
        """清理旧数据"""
        # 清理过期的每日统计（保留30天）
        cutoff_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        keys_to_remove = [
            key for key in self.daily_message_counts.keys() 
            if key < cutoff_date
        ]
        
        for key in keys_to_remove:
            del self.daily_message_counts[key]
        
        if keys_to_remove:
            print(f"[StatisticsAnalyzer] 清理了 {len(keys_to_remove)} 天的旧统计数据")
    
    def get_final_report(self) -> Dict[str, Any]:
        """获取最终报告"""
        runtime = datetime.now() - self.start_time
        
        return {
            'session_summary': {
                'start_time': self.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'runtime': str(runtime),
                'total_messages_processed': self.total_messages_processed,
                'total_errors': self.total_errors,
                'success_rate_percent': round(((self.total_messages_processed - self.total_errors) / max(1, self.total_messages_processed)) * 100, 2)
            },
            'device_summary': self.get_device_summary(),
            'gesture_summary': {
                gesture: stats.total_count 
                for gesture, stats in self.gesture_stats.items()
            },
            'performance_summary': self.get_performance_stats()
        }


if __name__ == "__main__":
    # 测试统计分析器
    analyzer = StatisticsAnalyzer()
    
    # 模拟一些数据
    test_message = {
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
    }
    
    # 更新统计
    for i in range(10):
        analyzer.update_stats(test_message)
    
    # 获取统计信息
    current_stats = analyzer.get_current_stats()
    print("当前统计:", current_stats)
    
    device_summary = analyzer.get_device_summary()
    print("设备摘要:", device_summary)