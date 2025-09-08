#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理模块 - 统一管理所有配置参数
支持配置文件、环境变量和命令行参数
"""

import json
import os
from typing import Dict, Any, Optional
from pathlib import Path


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self.config = {}
        self.default_config = self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            # 网络设置
            "network": {
                "monitor_port": 9999,
                "listen_host": "0.0.0.0",
                "max_packet_size": 65536,
                "buffer_size": 10000
            },
            
            # 数据库设置
            "database": {
                "database_dir": "./data",
                "database_name": "teeth_monitor.db",
                "auto_cleanup_days": 30,
                "backup_enabled": True,
                "backup_interval_hours": 24
            },
            
            # 显示设置
            "display": {
                "show_full_json": False,
                "show_message_details": True,
                "auto_scroll": True,
                "max_history_messages": 20,
                "status_update_interval": 10
            },
            
            # 系统设置
            "system": {
                "log_level": "INFO",
                "log_file": "monitor.log",
                "max_log_size_mb": 100,
                "enable_console_logging": True,
                "enable_file_logging": True
            },
            
            # 监控设置
            "monitoring": {
                "heartbeat_timeout": 30,
                "message_rate_limit": 1000,  # 每秒最大消息数
                "error_threshold": 100,      # 错误阈值
                "auto_restart_on_error": True
            },
            
            # 统计设置
            "statistics": {
                "enable_realtime_stats": True,
                "stats_update_interval": 5,
                "keep_detailed_stats_days": 7,
                "enable_performance_monitoring": True
            },
            
            # 扩展设置
            "extensions": {
                "enable_web_interface": False,
                "web_port": 8080,
                "enable_api": False,
                "api_port": 8081,
                "enable_notifications": False
            }
        }
    
    def load_config(self):
        """加载配置"""
        print(f"[ConfigManager] 加载配置文件: {self.config_file}")
        
        # 首先使用默认配置
        self.config = self.default_config.copy()
        
        # 尝试从文件加载
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                    self._merge_config(self.config, file_config)
                print(f"[ConfigManager] 从文件加载配置成功")
            except Exception as e:
                print(f"[ConfigManager] 加载配置文件失败: {e}，使用默认配置")
        else:
            print(f"[ConfigManager] 配置文件不存在，创建默认配置")
            self.save_config()
        
        # 从环境变量覆盖
        self._load_from_environment()
        
        # 验证配置
        self._validate_config()
        
        print(f"[ConfigManager] 配置加载完成")
    
    def save_config(self):
        """保存配置到文件"""
        try:
            # 确保配置目录存在
            config_dir = os.path.dirname(self.config_file)
            if config_dir and not os.path.exists(config_dir):
                Path(config_dir).mkdir(parents=True, exist_ok=True)
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            
            print(f"[ConfigManager] 配置已保存到 {self.config_file}")
            
        except Exception as e:
            print(f"[ConfigManager] 保存配置失败: {e}")
    
    def _merge_config(self, target: Dict[str, Any], source: Dict[str, Any]):
        """递归合并配置"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._merge_config(target[key], value)
            else:
                target[key] = value
    
    def _load_from_environment(self):
        """从环境变量加载配置"""
        env_mappings = {
            'TEETH_MONITOR_PORT': ('network', 'monitor_port', int),
            'TEETH_DB_DIR': ('database', 'database_dir', str),
            'TEETH_DB_NAME': ('database', 'database_name', str),
            'TEETH_LOG_LEVEL': ('system', 'log_level', str),
            'TEETH_LOG_FILE': ('system', 'log_file', str),
            'TEETH_SHOW_JSON': ('display', 'show_full_json', lambda x: x.lower() == 'true'),
            'TEETH_AUTO_CLEANUP_DAYS': ('database', 'auto_cleanup_days', int),
            'TEETH_HEARTBEAT_TIMEOUT': ('monitoring', 'heartbeat_timeout', int),
        }
        
        for env_var, (section, key, converter) in env_mappings.items():
            value = os.getenv(env_var)
            if value is not None:
                try:
                    converted_value = converter(value)
                    if section not in self.config:
                        self.config[section] = {}
                    self.config[section][key] = converted_value
                    print(f"[ConfigManager] 从环境变量设置 {section}.{key} = {converted_value}")
                except (ValueError, TypeError) as e:
                    print(f"[ConfigManager] 环境变量 {env_var} 转换失败: {e}")
    
    def _validate_config(self):
        """验证配置有效性"""
        errors = []
        
        # 验证网络端口
        monitor_port = self.get_monitor_port()
        if not (1024 <= monitor_port <= 65535):
            errors.append(f"监听端口无效: {monitor_port}")
        
        # 验证数据库目录
        db_dir = self.get_database_config()['database_dir']
        try:
            Path(db_dir).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            errors.append(f"无法创建数据库目录 {db_dir}: {e}")
        
        # 验证日志级别
        log_level = self.get_log_level()
        if log_level not in ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']:
            errors.append(f"无效的日志级别: {log_level}")
        
        if errors:
            print(f"[ConfigManager] 配置验证失败:")
            for error in errors:
                print(f"  - {error}")
            raise ValueError("配置验证失败")
        
        print(f"[ConfigManager] 配置验证通过")
    
    def get_monitor_port(self) -> int:
        """获取监听端口"""
        return self.config['network']['monitor_port']
    
    def get_database_config(self) -> Dict[str, Any]:
        """获取数据库配置"""
        return self.config['database'].copy()
    
    def get_display_config(self) -> Dict[str, Any]:
        """获取显示配置"""
        return self.config['display'].copy()
    
    def get_log_level(self) -> str:
        """获取日志级别"""
        return self.config['system']['log_level']
    
    def get_log_file(self) -> Optional[str]:
        """获取日志文件路径"""
        if self.config['system']['enable_file_logging']:
            return self.config['system']['log_file']
        return None
    
    def get_monitoring_config(self) -> Dict[str, Any]:
        """获取监控配置"""
        return self.config['monitoring'].copy()
    
    def get_statistics_config(self) -> Dict[str, Any]:
        """获取统计配置"""
        return self.config['statistics'].copy()
    
    def get_extensions_config(self) -> Dict[str, Any]:
        """获取扩展配置"""
        return self.config['extensions'].copy()
    
    def set_config_value(self, section: str, key: str, value: Any):
        """设置配置值"""
        if section not in self.config:
            self.config[section] = {}
        
        old_value = self.config[section].get(key)
        self.config[section][key] = value
        
        print(f"[ConfigManager] 更新配置 {section}.{key}: {old_value} -> {value}")
    
    def get_config_value(self, section: str, key: str, default: Any = None) -> Any:
        """获取配置值"""
        return self.config.get(section, {}).get(key, default)
    
    def print_config(self):
        """打印当前配置"""
        print("=== 当前配置 ===")
        print(json.dumps(self.config, ensure_ascii=False, indent=2))
        print("===============")
    
    def export_config(self, output_file: str):
        """导出配置到指定文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            print(f"[ConfigManager] 配置已导出到 {output_file}")
        except Exception as e:
            print(f"[ConfigManager] 导出配置失败: {e}")
    
    def reset_to_defaults(self):
        """重置为默认配置"""
        self.config = self.default_config.copy()
        self.save_config()
        print("[ConfigManager] 配置已重置为默认值")


if __name__ == "__main__":
    # 测试配置管理器
    config = ConfigManager("test_config.json")
    config.load_config()
    config.print_config()
    
    # 测试修改配置
    config.set_config_value('network', 'monitor_port', 8888)
    config.save_config()
    
    print(f"监听端口: {config.get_monitor_port()}")
    print(f"数据库配置: {config.get_database_config()}")