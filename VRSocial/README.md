# VR魔法师牙套控制系统

## 系统概述

这是一个完整的VR魔法控制系统，通过ESP32连接的智能牙套，实现手势识别控制VR世界中的魔法效果。系统采用双通道UDP通信架构，同时支持生产使用和调试监控。

### 核心特性

- **双通道通信**: ESP32同时向Quest和PC发送数据
- **实时魔法控制**: 牙套按钮直接控制VR中的喷火/喷水效果
- **数据持久化**: PC端SQLite数据库存储所有操作记录
- **实时监控**: 美观的控制台界面显示系统状态
- **高度模块化**: 所有组件独立设计，易于扩展和维护

## 系统架构

```
ESP32牙套设备 (数据源)
├── UDP发送到Quest:8888 (生产通道，低延迟)
└── UDP发送到PC:9999 (监控通道，数据持久化)

Quest VR (生产使用)  
├── TeethController: UDP接收 + 效果控制
├── WizardController: 角色位置跟随
└── HandSkills: 保持原有手势功能

PC监控系统 (调试分析)
├── 实时数据监控和显示
├── SQLite数据库持久化
├── 统计分析和报表
└── 交互式控制台界面
```

## 快速开始

### 1. ESP32设备配置

1. **硬件连接**
   ```
   按钮1 -> GPIO 2
   按钮2 -> GPIO 4  
   按钮3 -> GPIO 5
   按钮4 -> GPIO 18
   
   所有按钮另一端连接GND
   ```

2. **上传代码**
   ```bash
   # 使用Arduino IDE打开
   ESP32_TeethController/TeethController.ino
   
   # 配置WiFi信息 (在ConfigManager中)
   WiFi SSID: "你的WiFi名称"
   WiFi密码: "你的WiFi密码"
   
   # 配置目标IP (根据实际网络调整)
   Quest IP: "192.168.1.100"  
   PC IP: "192.168.1.101"
   
   # 编译并上传到ESP32
   ```

3. **验证连接**
   ```bash
   # 打开串口监视器，波特率115200
   # 应该看到WiFi连接和UDP发送成功的日志
   ```

### 2. Unity VR配置

1. **安装脚本**
   ```bash
   # 复制所有Unity脚本到项目
   Assets/Scripts/TeethController.cs
   Assets/Scripts/UDPReceiver.cs
   Assets/Scripts/TeethInputProcessor.cs
   Assets/Scripts/MagicEffectController.cs
   Assets/Scripts/WizardController.cs
   ```

2. **场景配置**
   ```
   VR Scene Hierarchy:
   ├── [BuildingBlock] Camera Rig (VR原有系统)
   └── Wizard GameObject
       ├── WizardController组件
       │   ├── VR Head: 拖入CenterEyeAnchor
       │   ├── Position Offset: (0, -1.5, 3)
       │   └── Follow Head Rotation: ✓
       └── TeethController组件
           ├── Listen Port: 8888
           ├── Fire Prefab: 拖入火效果预制体
           ├── Water Prefab: 拖入水效果预制体
           ├── Mouth Point: 拖入角色嘴部Transform
           └── Gesture Mappings: 配置手势映射
   ```

3. **手势映射配置**
   ```
   在TeethController的Inspector中配置:
   
   [0] Single Click Fire
       Gesture Name: "single_click"
       Required Teeth: [1] 或 [2]
       Trigger Effect: Fire
   
   [1] Single Click Water  
       Gesture Name: "single_click"
       Required Teeth: [3] 或 [4]
       Trigger Effect: Water
   
   [2] Long Press Mixed
       Gesture Name: "long_press" 
       Required Teeth: [1,2] 或 [3,4]
       Trigger Effect: FireWater
   ```

### 3. PC监控系统配置

1. **安装Python依赖**
   ```bash
   cd PC_Monitor
   pip install aiosqlite asyncio
   ```

2. **配置监控系统**
   ```bash
   # 编辑config.json (首次运行会自动创建)
   {
     "network": {
       "monitor_port": 9999,
       "listen_host": "0.0.0.0"
     },
     "database": {
       "database_dir": "./data",
       "database_name": "teeth_monitor.db"
     }
   }
   ```

3. **启动监控**
   ```bash
   python teeth_monitor.py
   ```

### 4. 网络配置

确保所有设备在同一WiFi网络：

```bash
# 查找设备IP地址

# Windows
ipconfig

# macOS/Linux  
ifconfig

# 确保防火墙允许UDP通信
# Windows: 允许Python和Unity程序通过防火墙
# macOS: 系统偏好设置 -> 安全性与隐私 -> 防火墙 -> 防火墙选项
```

## 详细配置说明

### ESP32配置详解

#### ConfigManager.cpp配置
```cpp
// 默认WiFi配置 (需要修改)
wifiSSID = "你的WiFi名称";
wifiPassword = "你的WiFi密码";

// 目标IP配置 (根据实际网络修改)
questIP = "192.168.1.100";    // Quest设备的IP
questPort = 8888;
pcIP = "192.168.1.101";       // PC的IP  
pcPort = 9999;

// 按钮引脚配置 (根据实际接线修改)
buttonPins = {2, 4, 5, 18};   // GPIO引脚
```

#### 手势识别参数调整
```cpp
// 在TeethInputManager.h中调整
const unsigned long DEBOUNCE_TIME = 50;       // 去抖动时间
const unsigned long LONG_PRESS_TIME = 800;    // 长按阈值  
const unsigned long SLIDE_MAX_INTERVAL = 300; // 滑动间隔
const unsigned long MULTI_PRESS_WINDOW = 500; // 多按窗口
```

### Unity配置详解

#### TeethController高级配置
```csharp
[Header("Network Settings")]
public int listenPort = 8888;           // UDP监听端口
public bool enableLogging = true;       // 启用详细日志

[Header("Magic Effects")]  
public GameObject firePrefab;           // 火焰效果预制体
public GameObject waterPrefab;          // 水流效果预制体
public Transform mouthPoint;            // 效果生成点

[Header("Gesture Mapping")]
public TeethGestureMapping[] gestureMappings; // 手势映射数组
```

#### 自定义手势映射
```csharp
// 创建新的手势映射
[System.Serializable]
public class TeethGestureMapping {
    public string gestureName = "single_click";     // 手势名称
    public int[] requiredTeeth = {1};               // 需要的按钮
    public float minDuration = 0f;                  // 最小持续时间
    public float maxDuration = 10f;                 // 最大持续时间
    public MagicEffect triggerEffect = MagicEffect.Fire; // 触发效果
    public bool exactMatch = true;                  // 精确匹配
}
```

### PC监控配置详解

#### config.json完整配置
```json
{
  "network": {
    "monitor_port": 9999,
    "listen_host": "0.0.0.0",
    "max_packet_size": 65536,
    "buffer_size": 10000
  },
  "database": {
    "database_dir": "./data",
    "database_name": "teeth_monitor.db", 
    "auto_cleanup_days": 30,
    "backup_enabled": true
  },
  "display": {
    "show_full_json": false,
    "show_message_details": true,
    "auto_scroll": true,
    "max_history_messages": 20
  },
  "system": {
    "log_level": "INFO",
    "log_file": "monitor.log",
    "enable_console_logging": true,
    "enable_file_logging": true
  }
}
```

#### 环境变量配置
```bash
# 可选的环境变量覆盖
export TEETH_MONITOR_PORT=9999
export TEETH_DB_DIR="./data"
export TEETH_LOG_LEVEL="DEBUG"
export TEETH_SHOW_JSON="true"
```

## 故障排除

### 常见问题及解决方案

#### 1. ESP32无法连接WiFi
```
症状: 串口显示WiFi连接失败
解决:
- 检查WiFi名称和密码是否正确
- 确认WiFi是2.4GHz网络(ESP32不支持5GHz)
- 检查路由器是否允许新设备连接
```

#### 2. Unity无法接收数据
```
症状: Unity控制台无UDP消息
解决:
- 检查防火墙是否阻止Unity UDP端口8888
- 确认ESP32和Quest在同一网络
- 检查Quest的IP地址是否正确配置
- 在Unity Console查看[UDPReceiver]日志
```

#### 3. PC监控无法启动
```
症状: Python程序启动失败
解决:
- 检查端口9999是否被其他程序占用
- 确认Python依赖包已正确安装
- 检查数据库目录权限
- 查看错误日志确定具体问题
```

#### 4. 手势识别不准确
```
症状: 按钮按下但无效果触发
解决:
- 调整DEBOUNCE_TIME减少抖动
- 检查按钮硬件连接
- 在串口监视器查看按钮状态日志
- 调整手势映射的匹配条件
```

### 调试技巧

#### ESP32调试
```cpp
// 在主程序中启用调试模式
#define DEBUG_MODE 1

// 查看详细的UDP发送日志
#define DEBUG_UDP 1

// 串口监视器命令
// 波特率: 115200
// 查看WiFi状态、按钮状态、UDP发送状态
```

#### Unity调试
```csharp
// 在TeethController中启用详细日志
[SerializeField] private bool enableLogging = true;

// Unity Console过滤
// 搜索 [TeethController] 查看接收日志
// 搜索 [UDPReceiver] 查看网络日志  
// 搜索 [MagicEffectController] 查看效果日志
```

#### PC监控调试
```python
# 启动时使用调试模式
python teeth_monitor.py --debug

# 交互式控制台命令
> status      # 查看系统状态
> recent      # 查看最近消息
> json on     # 开启JSON详细显示
> detail on   # 开启详细信息显示
```

## 性能优化

### ESP32优化
- 调整WiFi功率模式获得更好的稳定性
- 使用EEPROM存储配置避免每次重新配置
- 实现WiFi断线重连机制

### Unity优化  
- 使用对象池管理魔法效果实例
- 限制并发效果数量避免性能下降
- 异步处理UDP消息队列

### PC监控优化
- 批量写入数据库减少IO开销
- 定期清理旧数据控制数据库大小
- 使用索引优化查询性能

## 扩展开发

### 添加新的魔法效果
1. 在`MagicEffect`枚举中添加新类型
2. 在`MagicEffectController`中添加对应的预制体处理
3. 在Unity Inspector中配置手势映射

### 添加新的手势类型
1. 在`TeethInputManager.cpp`中实现手势识别逻辑
2. 在Unity `TeethInputProcessor.cs`中添加对应处理
3. 在PC监控中更新统计分析

### Web界面扩展
PC监控系统已预留Web界面扩展接口：
```json
"extensions": {
  "enable_web_interface": true,
  "web_port": 8080,
  "enable_api": true,
  "api_port": 8081
}
```

## 许可证

本项目采用MIT许可证，详见LICENSE文件。

## 贡献指南

欢迎提交Issue和Pull Request！

## 联系方式

项目维护者: VR魔法师开发团队