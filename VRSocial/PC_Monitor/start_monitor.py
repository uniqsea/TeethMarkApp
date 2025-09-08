#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
启动脚本 - 快速启动牙套监控系统
支持命令行参数和配置覆盖
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from teeth_monitor import TeethMonitorSystem


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="VR魔法师牙套监控系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python start_monitor.py                    # 默认配置启动
  python start_monitor.py --port 8888       # 指定监听端口
  python start_monitor.py --debug           # 调试模式
  python start_monitor.py --config custom.json  # 使用自定义配置文件
        """
    )
    
    parser.add_argument(
        '--port', '-p',
        type=int,
        default=None,
        help='UDP监听端口 (默认: 9999)'
    )
    
    parser.add_argument(
        '--host', '-H',
        type=str,
        default=None,
        help='监听主机地址 (默认: 0.0.0.0)'
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        default='config.json',
        help='配置文件路径 (默认: config.json)'
    )
    
    parser.add_argument(
        '--debug', '-d',
        action='store_true',
        help='启用调试模式'
    )
    
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default=None,
        help='日志级别'
    )
    
    parser.add_argument(
        '--db-dir',
        type=str,
        default=None,
        help='数据库目录路径'
    )
    
    parser.add_argument(
        '--no-console',
        action='store_true',
        help='禁用交互式控制台'
    )
    
    parser.add_argument(
        '--version', '-v',
        action='version',
        version='VR魔法师牙套监控系统 v1.0'
    )
    
    return parser.parse_args()


def setup_environment_variables(args):
    """根据命令行参数设置环境变量"""
    if args.port:
        os.environ['TEETH_MONITOR_PORT'] = str(args.port)
    
    if args.host:
        os.environ['TEETH_MONITOR_HOST'] = args.host
    
    if args.debug:
        os.environ['TEETH_LOG_LEVEL'] = 'DEBUG'
        os.environ['TEETH_SHOW_JSON'] = 'true'
        os.environ['TEETH_DETAIL_ON'] = 'true'
    
    if args.log_level:
        os.environ['TEETH_LOG_LEVEL'] = args.log_level
    
    if args.db_dir:
        os.environ['TEETH_DB_DIR'] = args.db_dir


def check_dependencies():
    """检查系统依赖"""
    missing_deps = []
    
    try:
        import aiosqlite
    except ImportError:
        missing_deps.append('aiosqlite')
    
    # 检查Python版本
    if sys.version_info < (3, 7):
        print("错误: 需要Python 3.7或更高版本")
        return False
    
    if missing_deps:
        print("错误: 缺少以下依赖包:")
        for dep in missing_deps:
            print(f"  - {dep}")
        print("\\n请运行: pip install -r requirements.txt")
        return False
    
    return True


def print_startup_banner(args):
    """打印启动横幅"""
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║                    VR魔法师牙套监控系统                      ║
║                      启动中...                              ║
╚══════════════════════════════════════════════════════════════╝

配置信息:
- 配置文件: {args.config}
- 监听端口: {args.port or '9999 (默认)'}
- 监听地址: {args.host or '0.0.0.0 (默认)'}
- 调试模式: {'开启' if args.debug else '关闭'}
- 日志级别: {args.log_level or 'INFO (默认)'}
- 数据库目录: {args.db_dir or './data (默认)'}

控制台快捷键:
- Ctrl+C: 优雅关闭系统
- 输入 'help': 查看交互命令
- 输入 'status': 查看系统状态
"""
    print(banner)


async def run_monitor_system(args):
    """运行监控系统"""
    try:
        # 创建监控系统实例
        monitor = TeethMonitorSystem()
        
        # 如果指定了配置文件，更新配置管理器
        if args.config != 'config.json':
            monitor.config.config_file = args.config
        
        # 启动系统
        await monitor.start()
        
    except KeyboardInterrupt:
        print("\\n收到中断信号，正在关闭系统...")
    except Exception as e:
        print(f"系统运行出错: {e}")
        raise


def main():
    """主函数"""
    # 解析命令行参数
    args = parse_arguments()
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    # 设置环境变量
    setup_environment_variables(args)
    
    # 打印启动信息
    print_startup_banner(args)
    
    # 运行监控系统
    try:
        if sys.platform == 'win32':
            # Windows系统的asyncio兼容性处理
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
        asyncio.run(run_monitor_system(args))
        
    except KeyboardInterrupt:
        print("程序被用户中断")
    except Exception as e:
        print(f"程序异常退出: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    finally:
        print("程序结束")


if __name__ == "__main__":
    main()