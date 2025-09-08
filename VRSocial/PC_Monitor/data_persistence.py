#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据持久化模块 - SQLite数据库存储和管理
支持高并发写入和灵活的数据查询
"""

import aiosqlite
import asyncio
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path


class DataPersistence:
    """数据持久化管理器"""
    
    def __init__(self):
        self.db_path = None
        self.db_connection = None
        self.write_buffer = []
        self.buffer_lock = asyncio.Lock()
        
        # 配置参数
        self.max_buffer_size = 100  # 批量写入缓冲区大小
        self.flush_interval = 5.0   # 自动刷新间隔(秒)
        self.auto_cleanup_days = 30 # 自动清理天数
        
        # 统计信息
        self.total_written = 0
        self.total_errors = 0
        self.last_flush_time = datetime.now()
    
    def initialize(self, config: Dict[str, Any]):
        """初始化数据库连接"""
        # 获取数据库路径
        db_dir = config.get('database_dir', './data')
        db_name = config.get('database_name', 'teeth_monitor.db')
        
        # 确保数据目录存在
        Path(db_dir).mkdir(parents=True, exist_ok=True)
        
        self.db_path = os.path.join(db_dir, db_name)
        
        print(f"[DataPersistence] 初始化数据库: {self.db_path}")
        
        # 启动异步初始化
        asyncio.create_task(self._async_initialize())
    
    async def _async_initialize(self):
        """异步初始化数据库"""
        try:
            # 创建数据库连接
            self.db_connection = await aiosqlite.connect(self.db_path)
            
            # 创建表结构
            await self._create_tables()
            
            # 启动自动刷新任务
            asyncio.create_task(self._auto_flush_loop())
            
            print("[DataPersistence] 数据库初始化完成")
            
        except Exception as e:
            print(f"[DataPersistence] 数据库初始化失败: {e}")
            raise
    
    async def _create_tables(self):
        """创建数据库表结构"""
        
        # 主消息表
        await self.db_connection.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                source_ip TEXT NOT NULL,
                source_port INTEGER NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT NOT NULL,
                message_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 牙套输入详情表
        await self.db_connection.execute('''
            CREATE TABLE IF NOT EXISTS teeth_inputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                gesture TEXT NOT NULL,
                teeth_buttons TEXT NOT NULL,  -- JSON array
                duration REAL NOT NULL,
                device_id TEXT,
                timestamp_esp BIGINT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            )
        ''')
        
        # 系统统计表
        await self.db_connection.execute('''
            CREATE TABLE IF NOT EXISTS system_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE UNIQUE NOT NULL,
                total_messages INTEGER DEFAULT 0,
                total_errors INTEGER DEFAULT 0,
                unique_devices INTEGER DEFAULT 0,
                gesture_stats TEXT,  -- JSON object
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 设备信息表
        await self.db_connection.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                ip_address TEXT NOT NULL,
                first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_messages INTEGER DEFAULT 0,
                device_info TEXT  -- JSON object
            )
        ''')
        
        # 创建索引优化查询
        await self.db_connection.execute('''
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
            ON messages (timestamp)
        ''')
        
        await self.db_connection.execute('''
            CREATE INDEX IF NOT EXISTS idx_teeth_inputs_gesture 
            ON teeth_inputs (gesture)
        ''')
        
        await self.db_connection.execute('''
            CREATE INDEX IF NOT EXISTS idx_devices_last_seen 
            ON devices (last_seen)
        ''')
        
        await self.db_connection.commit()
        print("[DataPersistence] 数据库表结构创建完成")
    
    async def store_message(self, message: Dict[str, Any]):
        """存储消息到缓冲区"""
        async with self.buffer_lock:
            self.write_buffer.append(message)
            
            # 如果缓冲区满了，立即刷新
            if len(self.write_buffer) >= self.max_buffer_size:
                await self._flush_buffer()
    
    async def _flush_buffer(self):
        """刷新缓冲区到数据库"""
        if not self.write_buffer or not self.db_connection:
            return
        
        try:
            messages_to_write = self.write_buffer.copy()
            self.write_buffer.clear()
            
            # 批量插入消息
            for message in messages_to_write:
                await self._insert_message(message)
            
            await self.db_connection.commit()
            
            self.total_written += len(messages_to_write)
            self.last_flush_time = datetime.now()
            
            print(f"[DataPersistence] 批量写入 {len(messages_to_write)} 条消息")
            
        except Exception as e:
            print(f"[DataPersistence] 刷新缓冲区失败: {e}")
            self.total_errors += 1
            
            # 将失败的消息放回缓冲区
            self.write_buffer.extend(messages_to_write)
    
    async def _insert_message(self, message: Dict[str, Any]):
        """插入单条消息"""
        # 插入主消息记录
        cursor = await self.db_connection.execute('''
            INSERT INTO messages 
            (timestamp, source_ip, source_port, message_type, content, message_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            message['timestamp'],
            message['source_ip'],
            message['source_port'],
            message['message_type'],
            json.dumps(message['content'], ensure_ascii=False),
            message['message_id']
        ))
        
        db_message_id = cursor.lastrowid
        
        # 如果是牙套输入消息，插入详细信息
        content = message['content']
        if message['message_type'] == 'teeth_input' and 'gesture' in content:
            await self.db_connection.execute('''
                INSERT INTO teeth_inputs 
                (message_id, gesture, teeth_buttons, duration, device_id, timestamp_esp)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                db_message_id,
                content.get('gesture', ''),
                json.dumps(content.get('teeth', [])),
                content.get('duration', 0.0),
                content.get('device_id', ''),
                content.get('timestamp', 0)
            ))
        
        # 更新设备信息
        device_id = content.get('device_id')
        if device_id:
            await self._update_device_info(device_id, message['source_ip'])
    
    async def _update_device_info(self, device_id: str, ip_address: str):
        """更新设备信息"""
        await self.db_connection.execute('''
            INSERT OR REPLACE INTO devices 
            (device_id, ip_address, first_seen, last_seen, total_messages)
            VALUES (
                ?, ?, 
                COALESCE((SELECT first_seen FROM devices WHERE device_id = ?), CURRENT_TIMESTAMP),
                CURRENT_TIMESTAMP,
                COALESCE((SELECT total_messages FROM devices WHERE device_id = ?), 0) + 1
            )
        ''', (device_id, ip_address, device_id, device_id))
    
    async def _auto_flush_loop(self):
        """自动刷新循环"""
        while True:
            try:
                await asyncio.sleep(self.flush_interval)
                
                async with self.buffer_lock:
                    if self.write_buffer:
                        await self._flush_buffer()
                
            except Exception as e:
                print(f"[DataPersistence] 自动刷新出错: {e}")
                await asyncio.sleep(1)
    
    async def flush_data(self):
        """手动刷新数据"""
        async with self.buffer_lock:
            await self._flush_buffer()
    
    async def get_recent_messages(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取最近的消息"""
        if not self.db_connection:
            return []
        
        try:
            cursor = await self.db_connection.execute('''
                SELECT timestamp, source_ip, message_type, content
                FROM messages 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (limit,))
            
            rows = await cursor.fetchall()
            
            messages = []
            for row in rows:
                messages.append({
                    'timestamp': row[0],
                    'source_ip': row[1],
                    'message_type': row[2],
                    'content': json.loads(row[3])
                })
            
            return messages
            
        except Exception as e:
            print(f"[DataPersistence] 查询最近消息失败: {e}")
            return []
    
    async def get_statistics_summary(self) -> Dict[str, Any]:
        """获取统计摘要"""
        if not self.db_connection:
            return {}
        
        try:
            # 消息统计
            cursor = await self.db_connection.execute('''
                SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
                FROM messages
            ''')
            total_messages, first_message, last_message = await cursor.fetchone()
            
            # 手势统计
            cursor = await self.db_connection.execute('''
                SELECT gesture, COUNT(*) 
                FROM teeth_inputs 
                GROUP BY gesture
            ''')
            gesture_stats = dict(await cursor.fetchall())
            
            # 设备统计
            cursor = await self.db_connection.execute('''
                SELECT COUNT(DISTINCT device_id)
                FROM devices
            ''')
            unique_devices = (await cursor.fetchone())[0]
            
            return {
                'total_messages': total_messages,
                'first_message_time': first_message,
                'last_message_time': last_message,
                'gesture_statistics': gesture_stats,
                'unique_devices': unique_devices,
                'buffer_size': len(self.write_buffer),
                'total_written': self.total_written,
                'total_errors': self.total_errors
            }
            
        except Exception as e:
            print(f"[DataPersistence] 获取统计摘要失败: {e}")
            return {}
    
    async def cleanup_old_data(self, days: int = None):
        """清理旧数据"""
        if not self.db_connection:
            return
        
        cleanup_days = days or self.auto_cleanup_days
        cutoff_date = datetime.now() - timedelta(days=cleanup_days)
        
        try:
            # 删除旧消息
            cursor = await self.db_connection.execute('''
                DELETE FROM messages WHERE timestamp < ?
            ''', (cutoff_date,))
            
            deleted_messages = cursor.rowcount
            
            # 删除孤立的牙套输入记录
            await self.db_connection.execute('''
                DELETE FROM teeth_inputs 
                WHERE message_id NOT IN (SELECT id FROM messages)
            ''')
            
            await self.db_connection.commit()
            
            print(f"[DataPersistence] 清理了 {deleted_messages} 条旧消息")
            
        except Exception as e:
            print(f"[DataPersistence] 清理旧数据失败: {e}")
    
    async def flush_and_close(self):
        """刷新并关闭数据库连接"""
        try:
            # 刷新剩余数据
            await self.flush_data()
            
            # 关闭连接
            if self.db_connection:
                await self.db_connection.close()
                self.db_connection = None
            
            print(f"[DataPersistence] 数据库已关闭，总共写入 {self.total_written} 条记录")
            
        except Exception as e:
            print(f"[DataPersistence] 关闭数据库时出错: {e}")


# 测试和维护工具
class DatabaseMaintenance:
    """数据库维护工具"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    async def vacuum_database(self):
        """压缩数据库"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('VACUUM')
            print("数据库压缩完成")
    
    async def export_data(self, output_file: str, start_date: str = None, end_date: str = None):
        """导出数据到JSON文件"""
        async with aiosqlite.connect(self.db_path) as db:
            # 构建查询条件
            where_clause = ""
            params = []
            
            if start_date:
                where_clause += " WHERE timestamp >= ?"
                params.append(start_date)
            
            if end_date:
                if where_clause:
                    where_clause += " AND timestamp <= ?"
                else:
                    where_clause += " WHERE timestamp <= ?"
                params.append(end_date)
            
            cursor = await db.execute(f'''
                SELECT * FROM messages {where_clause} ORDER BY timestamp
            ''', params)
            
            rows = await cursor.fetchall()
            
            # 导出到JSON文件
            with open(output_file, 'w', encoding='utf-8') as f:
                export_data = []
                for row in rows:
                    export_data.append({
                        'id': row[0],
                        'timestamp': row[1],
                        'source_ip': row[2],
                        'source_port': row[3],
                        'message_type': row[4],
                        'content': json.loads(row[5]),
                        'message_id': row[6],
                        'created_at': row[7]
                    })
                
                json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)
            
            print(f"导出了 {len(rows)} 条记录到 {output_file}")


if __name__ == "__main__":
    # 简单测试
    async def test_persistence():
        config = {
            'database_dir': './test_data',
            'database_name': 'test_teeth.db'
        }
        
        dp = DataPersistence()
        dp.initialize(config)
        
        await asyncio.sleep(1)  # 等待初始化完成
        
        # 测试消息
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
            },
            'message_id': 1
        }
        
        await dp.store_message(test_message)
        await dp.flush_data()
        
        stats = await dp.get_statistics_summary()
        print(f"统计信息: {stats}")
        
        await dp.flush_and_close()
    
    asyncio.run(test_persistence())