# VR Emoji 交互系统技术规范

## 🎯 项目概述

基于VisionNav项目中成熟的ESP32蓝牙控制系统架构，设计一个VR Unity环境下的Emoji交互系统。用户通过长按按钮在VR房间中发送特定Emoji（啤酒🍺、亲吻💋），实现沉浸式社交反馈。

### 核心特性
- **简洁交互**：长按触发 → Emoji选择 → 目标发送
- **视觉反馈**：Emoji飞行动画，从发送者到接收者
- **多模态反馈**：触觉震动 + 音效 + 视觉特效
- **模块化架构**：借鉴ESP32系统的三层原子服务设计
- **网络同步**：实时多人交互支持

---

## 🏗️ 系统架构

### 核心设计原则
> **"好品味"原则**：消除特殊情况，数据结构优先，模块化设计，零破坏性

### 三层原子服务架构

```
┌─────────────────────────────────────────────────┐
│               VREmoController                   │
│           (系统协调器 - 单例模式)                │
└─────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ InputManager │  │NetworkSync  │  │FeedbackOrch │
│   输入处理    │  │  网络同步    │  │  反馈协调    │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## 📋 技术规范详情

### 1. 数据结构设计

#### 1.1 核心消息协议
```csharp
// 基础消息接口 (灵感来自ESP32Protocol)
[System.Serializable]
public struct VREmoMessage
{
    public string type;          // 消息类型：'emoji_trigger', 'emoji_send', 'feedback'
    public object data;          // 开放数据结构
    public long timestamp;       // Unix时间戳
    public string version;       // 协议版本 "1.0.0"
}

// Emoji数据结构
[System.Serializable]
public struct EmojiData
{
    public EmojiType emojiType;    // BEER, KISS
    public int senderId;           // 发送者ID
    public int targetId;           // 目标ID
    public Vector3 targetPosition; // 目标位置
    public float intensity;        // 反馈强度 0-1
}

// 反馈数据结构
[System.Serializable]
public struct FeedbackData
{
    public FeedbackType feedbackType;  // HAPTIC, AUDIO, VISUAL
    public string action;              // 具体动作标识
    public float intensity;            // 强度
    public float duration;             // 持续时间
    public string[] pattern;           // 震动模式
    public FeedbackPriority priority;  // 优先级
}

// 枚举定义
public enum EmojiType { BEER, KISS }
public enum FeedbackType { HAPTIC, AUDIO, VISUAL }
public enum FeedbackPriority { LOW, NORMAL, HIGH, URGENT }
```

#### 1.2 状态管理
```csharp
// 系统状态接口
public struct VREmoSystemState
{
    public bool isActive;                    // 系统是否激活
    public InputState inputState;            // 输入状态
    public NetworkState networkState;        // 网络状态
    public FeedbackQueueState feedbackQueue; // 反馈队列状态
}

public struct InputState
{
    public bool isLongPressing;              // 是否正在长按
    public EmojiType? selectedEmoji;         // 当前选中的Emoji
    public int? targetPlayerId;              // 目标玩家ID
    public float pressStartTime;             // 按下开始时间
}
```

---

### 2. 核心组件实现

### 2.1 VREmoController (系统协调器)

```csharp
/// <summary>
/// VR Emoji交互系统主控制器
/// 单例模式，负责协调InputManager、NetworkSyncManager、FeedbackOrchestrator
/// 借鉴ESP32GestureHandler的事件驱动架构
/// </summary>
public class VREmoController : MonoBehaviour
{
    #region Singleton
    private static VREmoController _instance;
    public static VREmoController Instance => _instance;
    
    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }
        _instance = this;
        DontDestroyOnLoad(gameObject);
        InitializeSystem();
    }
    #endregion

    #region Core Services
    private InputManager inputManager;
    private NetworkSyncManager networkManager;
    private FeedbackOrchestrator feedbackOrchestrator;
    
    private VREmoSystemState currentState;
    #endregion

    #region Events (类似ESP32GestureHandlerEvents)
    public static event System.Action<EmojiData> OnEmojiTriggered;
    public static event System.Action<EmojiData> OnEmojiReceived;
    public static event System.Action<int, int> OnPlayerTargetSelected;
    public static event System.Action OnEmojiSelectionStarted;
    public static event System.Action OnEmojiSelectionCancelled;
    public static event System.Action<VREmoSystemState> OnSystemStateChanged;
    #endregion

    #region Initialization
    private void InitializeSystem()
    {
        // 获取或创建原子服务实例
        inputManager = InputManager.Instance;
        networkManager = NetworkSyncManager.Instance;
        feedbackOrchestrator = FeedbackOrchestrator.Instance;
        
        // 绑定服务间事件路由
        SetupServiceConnections();
        
        Debug.Log("✅ VREmoController initialized successfully");
        OnSystemStateChanged?.Invoke(GetCurrentState());
    }

    private void SetupServiceConnections()
    {
        // === Input Manager 事件路由 ===
        InputManager.OnLongPressStarted += HandleLongPressStarted;
        InputManager.OnEmojiSelected += HandleEmojiSelected;
        InputManager.OnTargetSelected += HandleTargetSelected;
        InputManager.OnLongPressReleased += HandleLongPressReleased;

        // === Network Manager 事件路由 ===
        NetworkSyncManager.OnEmojiMessageReceived += HandleEmojiReceived;
        NetworkSyncManager.OnNetworkStateChanged += HandleNetworkStateChanged;

        // === Feedback Orchestrator 事件路由 ===
        FeedbackOrchestrator.OnFeedbackCompleted += HandleFeedbackCompleted;
    }
    #endregion

    #region Event Handlers
    private void HandleLongPressStarted()
    {
        currentState.inputState.isLongPressing = true;
        feedbackOrchestrator.TriggerSelectionStartFeedback();
        OnEmojiSelectionStarted?.Invoke();
    }

    private void HandleEmojiSelected(EmojiType emoji)
    {
        currentState.inputState.selectedEmoji = emoji;
        feedbackOrchestrator.TriggerEmojiSelectFeedback(emoji);
    }

    private void HandleTargetSelected(int targetPlayerId)
    {
        currentState.inputState.targetPlayerId = targetPlayerId;
        OnPlayerTargetSelected?.Invoke(inputManager.GetCurrentPlayerId(), targetPlayerId);
        
        // 确认选择反馈
        feedbackOrchestrator.TriggerTargetSelectFeedback();
    }

    private void HandleLongPressReleased()
    {
        if (ValidateEmojiTrigger())
        {
            TriggerEmojiSend();
        }
        else
        {
            CancelEmojiSelection();
        }
        
        ResetInputState();
    }

    private void HandleEmojiReceived(VREmoMessage message)
    {
        var emojiData = (EmojiData)message.data;
        
        // 触发接收反馈
        feedbackOrchestrator.TriggerEmojiReceiveFeedback(emojiData);
        
        // 启动Emoji飞行动画
        StartEmojiAnimation(emojiData);
        
        OnEmojiReceived?.Invoke(emojiData);
    }
    #endregion

    #region Core Logic
    private bool ValidateEmojiTrigger()
    {
        return currentState.inputState.selectedEmoji.HasValue &&
               currentState.inputState.targetPlayerId.HasValue &&
               networkManager.IsTargetPlayerValid(currentState.inputState.targetPlayerId.Value);
    }

    private void TriggerEmojiSend()
    {
        var emojiData = new EmojiData
        {
            emojiType = currentState.inputState.selectedEmoji.Value,
            senderId = inputManager.GetCurrentPlayerId(),
            targetId = currentState.inputState.targetPlayerId.Value,
            targetPosition = GetTargetPlayerPosition(currentState.inputState.targetPlayerId.Value),
            intensity = CalculateIntensityByEmoji(currentState.inputState.selectedEmoji.Value)
        };

        // 发送网络消息
        var message = CreateEmojiMessage("emoji_send", emojiData);
        networkManager.SendEmojiMessage(message);
        
        // 触发发送反馈
        feedbackOrchestrator.TriggerEmojiSendFeedback(emojiData);
        
        OnEmojiTriggered?.Invoke(emojiData);
    }

    private void CancelEmojiSelection()
    {
        feedbackOrchestrator.TriggerCancelFeedback();
        OnEmojiSelectionCancelled?.Invoke();
    }

    private float CalculateIntensityByEmoji(EmojiType emoji)
    {
        return emoji switch
        {
            EmojiType.BEER => 0.6f,  // 中等强度
            EmojiType.KISS => 0.9f,  // 高强度
            _ => 0.5f
        };
    }
    #endregion

    #region Public API
    public VREmoSystemState GetCurrentState() => currentState;
    
    public bool IsSystemReady() => 
        inputManager.IsReady() && 
        networkManager.IsConnected() && 
        feedbackOrchestrator.IsReady();
    
    public void SetSystemEnabled(bool enabled)
    {
        currentState.isActive = enabled;
        inputManager.SetEnabled(enabled);
        OnSystemStateChanged?.Invoke(currentState);
    }
    #endregion

    #region Utility Methods
    private VREmoMessage CreateEmojiMessage(string type, EmojiData data)
    {
        return new VREmoMessage
        {
            type = type,
            data = data,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            version = "1.0.0"
        };
    }

    private Vector3 GetTargetPlayerPosition(int playerId)
    {
        // 实现获取目标玩家位置逻辑
        return networkManager.GetPlayerPosition(playerId);
    }

    private void ResetInputState()
    {
        currentState.inputState = new InputState
        {
            isLongPressing = false,
            selectedEmoji = null,
            targetPlayerId = null,
            pressStartTime = 0f
        };
    }
    #endregion
}
```

### 2.2 InputManager (输入处理器)

```csharp
/// <summary>
/// 输入处理器 - 专门处理VR控制器输入
/// 借鉴ESP32InputProcessor的事件驱动模式
/// </summary>
public class InputManager : MonoBehaviour
{
    #region Singleton
    private static InputManager _instance;
    public static InputManager Instance => _instance;
    #endregion

    #region Events
    public static event System.Action OnLongPressStarted;
    public static event System.Action<EmojiType> OnEmojiSelected;
    public static event System.Action<int> OnTargetSelected;
    public static event System.Action OnLongPressReleased;
    #endregion

    #region Configuration
    [Header("Input Configuration")]
    [SerializeField] private float longPressThreshold = 0.8f;     // 长按阈值
    [SerializeField] private float emojiSelectThreshold = 1.5f;   // Emoji选择阈值
    [SerializeField] private float targetSelectThreshold = 2.2f;  // 目标选择阈值
    
    [Header("VR Input Bindings")]
    [SerializeField] private InputActionReference triggerAction;  // 扳机键
    [SerializeField] private InputActionReference joystickAction; // 摇杆
    #endregion

    #region State Management
    private bool isEnabled = true;
    private bool isLongPressing = false;
    private float pressStartTime;
    private EmojiType? selectedEmoji;
    private int? targetPlayerId;
    
    // 输入状态机
    private enum InputPhase { IDLE, LONG_PRESSING, EMOJI_SELECTION, TARGET_SELECTION }
    private InputPhase currentPhase = InputPhase.IDLE;
    #endregion

    #region Unity Lifecycle
    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }
        _instance = this;
    }

    private void OnEnable()
    {
        triggerAction.action.performed += OnTriggerPressed;
        triggerAction.action.canceled += OnTriggerReleased;
        joystickAction.action.performed += OnJoystickMoved;
    }

    private void OnDisable()
    {
        triggerAction.action.performed -= OnTriggerPressed;
        triggerAction.action.canceled -= OnTriggerReleased;
        joystickAction.action.performed -= OnJoystickMoved;
    }

    private void Update()
    {
        if (!isEnabled || currentPhase == InputPhase.IDLE) return;
        
        ProcessLongPressLogic();
    }
    #endregion

    #region Input Handlers
    private void OnTriggerPressed(InputAction.CallbackContext context)
    {
        if (!isEnabled || currentPhase != InputPhase.IDLE) return;
        
        StartLongPress();
    }

    private void OnTriggerReleased(InputAction.CallbackContext context)
    {
        if (!isEnabled || currentPhase == InputPhase.IDLE) return;
        
        EndLongPress();
    }

    private void OnJoystickMoved(InputAction.CallbackContext context)
    {
        if (!isEnabled) return;
        
        var joystickValue = context.ReadValue<Vector2>();
        ProcessJoystickInput(joystickValue);
    }
    #endregion

    #region Long Press Logic
    private void StartLongPress()
    {
        pressStartTime = Time.time;
        currentPhase = InputPhase.LONG_PRESSING;
        OnLongPressStarted?.Invoke();
    }

    private void ProcessLongPressLogic()
    {
        float pressDuration = Time.time - pressStartTime;
        
        switch (currentPhase)
        {
            case InputPhase.LONG_PRESSING:
                if (pressDuration >= longPressThreshold)
                {
                    EnterEmojiSelection();
                }
                break;
                
            case InputPhase.EMOJI_SELECTION:
                if (pressDuration >= emojiSelectThreshold && selectedEmoji.HasValue)
                {
                    EnterTargetSelection();
                }
                break;
                
            case InputPhase.TARGET_SELECTION:
                // 等待摇杆输入选择目标
                break;
        }
    }

    private void EnterEmojiSelection()
    {
        currentPhase = InputPhase.EMOJI_SELECTION;
        // 显示Emoji选择UI
        ShowEmojiSelectionUI();
    }

    private void EnterTargetSelection()
    {
        currentPhase = InputPhase.TARGET_SELECTION;
        // 显示目标选择UI
        ShowTargetSelectionUI();
    }

    private void EndLongPress()
    {
        OnLongPressReleased?.Invoke();
        ResetInputState();
    }
    #endregion

    #region Joystick Processing
    private void ProcessJoystickInput(Vector2 joystickValue)
    {
        switch (currentPhase)
        {
            case InputPhase.EMOJI_SELECTION:
                ProcessEmojiSelection(joystickValue);
                break;
                
            case InputPhase.TARGET_SELECTION:
                ProcessTargetSelection(joystickValue);
                break;
        }
    }

    private void ProcessEmojiSelection(Vector2 joystickValue)
    {
        // 左右摇杆选择Emoji
        if (Mathf.Abs(joystickValue.x) > 0.7f)
        {
            EmojiType newSelection = joystickValue.x > 0 ? EmojiType.KISS : EmojiType.BEER;
            
            if (selectedEmoji != newSelection)
            {
                selectedEmoji = newSelection;
                OnEmojiSelected?.Invoke(newSelection);
            }
        }
    }

    private void ProcessTargetSelection(Vector2 joystickValue)
    {
        // 通过摇杆角度选择目标玩家
        float angle = Mathf.Atan2(joystickValue.y, joystickValue.x) * Mathf.Rad2Deg;
        int targetId = AngleToPlayerId(angle);
        
        if (targetPlayerId != targetId)
        {
            targetPlayerId = targetId;
            OnTargetSelected?.Invoke(targetId);
        }
    }

    private int AngleToPlayerId(float angle)
    {
        // 简化版：假设最多4个玩家，分布在四个象限
        if (angle >= -45f && angle <= 45f) return 1;      // 右
        if (angle >= 45f && angle <= 135f) return 2;      // 上
        if (angle >= -135f && angle <= -45f) return 3;    // 下
        return 4; // 左
    }
    #endregion

    #region UI Management
    private void ShowEmojiSelectionUI()
    {
        // 显示Emoji选择界面
        EmojiSelectionUI.Instance?.Show();
    }

    private void ShowTargetSelectionUI()
    {
        // 显示目标选择界面
        TargetSelectionUI.Instance?.Show();
    }

    private void HideAllUI()
    {
        EmojiSelectionUI.Instance?.Hide();
        TargetSelectionUI.Instance?.Hide();
    }
    #endregion

    #region Public API
    public bool IsReady() => isEnabled;
    public void SetEnabled(bool enabled) => isEnabled = enabled;
    public int GetCurrentPlayerId() => NetworkSyncManager.Instance.GetLocalPlayerId();
    
    public InputState GetCurrentInputState()
    {
        return new InputState
        {
            isLongPressing = isLongPressing,
            selectedEmoji = selectedEmoji,
            targetPlayerId = targetPlayerId,
            pressStartTime = pressStartTime
        };
    }
    #endregion

    #region Utility Methods
    private void ResetInputState()
    {
        currentPhase = InputPhase.IDLE;
        isLongPressing = false;
        selectedEmoji = null;
        targetPlayerId = null;
        pressStartTime = 0f;
        HideAllUI();
    }
    #endregion
}
```

### 2.3 NetworkSyncManager (网络同步管理器)

```csharp
/// <summary>
/// 网络同步管理器 - 处理Emoji消息的网络传输
/// 借鉴ESP32TransportService的事件驱动架构
/// </summary>
public class NetworkSyncManager : MonoBehaviour
{
    #region Singleton
    private static NetworkSyncManager _instance;
    public static NetworkSyncManager Instance => _instance;
    #endregion

    #region Events
    public static event System.Action<VREmoMessage> OnEmojiMessageReceived;
    public static event System.Action<bool> OnNetworkStateChanged;
    public static event System.Action<int> OnPlayerJoined;
    public static event System.Action<int> OnPlayerLeft;
    #endregion

    #region Network State
    private bool isConnected = false;
    private int localPlayerId = -1;
    private Dictionary<int, PlayerNetworkData> connectedPlayers = new();
    
    [System.Serializable]
    public struct PlayerNetworkData
    {
        public int playerId;
        public string playerName;
        public Vector3 position;
        public bool isActive;
    }
    #endregion

    #region Mirror Networking (或其他网络方案)
    [Header("Network Configuration")]
    [SerializeField] private bool useLocalNetwork = true;
    [SerializeField] private float networkUpdateRate = 20f;
    #endregion

    #region Unity Lifecycle
    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }
        _instance = this;
        
        InitializeNetwork();
    }
    #endregion

    #region Network Initialization
    private void InitializeNetwork()
    {
        // 根据选择的网络方案初始化
        if (useLocalNetwork)
        {
            InitializeLocalNetwork();
        }
        else
        {
            InitializeMirrorNetwork();
        }
    }

    private void InitializeLocalNetwork()
    {
        // 本地测试网络
        localPlayerId = 1;
        isConnected = true;
        
        // 模拟其他玩家
        AddMockPlayers();
        
        OnNetworkStateChanged?.Invoke(true);
        Debug.Log("✅ Local Network initialized");
    }

    private void InitializeMirrorNetwork()
    {
        // Mirror Networking 初始化
        // 实际项目中需要配置Mirror NetworkManager
        Debug.Log("🔄 Initializing Mirror Network...");
    }

    private void AddMockPlayers()
    {
        // 添加模拟玩家用于测试
        for (int i = 2; i <= 4; i++)
        {
            var playerData = new PlayerNetworkData
            {
                playerId = i,
                playerName = $"Player_{i}",
                position = new Vector3(i * 2f, 0f, 0f),
                isActive = true
            };
            
            connectedPlayers[i] = playerData;
            OnPlayerJoined?.Invoke(i);
        }
    }
    #endregion

    #region Message Handling
    public void SendEmojiMessage(VREmoMessage message)
    {
        if (!isConnected)
        {
            Debug.LogWarning("⚠️ Network not connected, cannot send message");
            return;
        }

        // 本地网络：直接触发接收事件模拟网络传输
        if (useLocalNetwork)
        {
            StartCoroutine(SimulateNetworkDelay(message));
        }
        else
        {
            // 实际网络发送
            SendNetworkMessage(message);
        }

        Debug.Log($"📤 Emoji message sent: {message.type}");
    }

    private System.Collections.IEnumerator SimulateNetworkDelay(VREmoMessage message)
    {
        // 模拟网络延迟
        yield return new WaitForSeconds(0.1f);
        
        // 触发接收事件
        OnEmojiMessageReceived?.Invoke(message);
    }

    private void SendNetworkMessage(VREmoMessage message)
    {
        // 实际网络发送实现
        // 使用Mirror或其他网络方案发送
    }

    // 网络接收消息回调
    public void OnReceiveNetworkMessage(string messageJson)
    {
        try
        {
            var message = JsonUtility.FromJson<VREmoMessage>(messageJson);
            if (ValidateMessage(message))
            {
                OnEmojiMessageReceived?.Invoke(message);
                Debug.Log($"📥 Emoji message received: {message.type}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ Failed to parse network message: {e.Message}");
        }
    }

    private bool ValidateMessage(VREmoMessage message)
    {
        return !string.IsNullOrEmpty(message.type) && 
               message.data != null && 
               message.timestamp > 0;
    }
    #endregion

    #region Player Management
    public bool IsTargetPlayerValid(int playerId)
    {
        return connectedPlayers.ContainsKey(playerId) && 
               connectedPlayers[playerId].isActive;
    }

    public Vector3 GetPlayerPosition(int playerId)
    {
        if (connectedPlayers.TryGetValue(playerId, out var playerData))
        {
            return playerData.position;
        }
        return Vector3.zero;
    }

    public List<int> GetConnectedPlayerIds()
    {
        return connectedPlayers.Keys.Where(id => connectedPlayers[id].isActive).ToList();
    }

    public void UpdatePlayerPosition(int playerId, Vector3 position)
    {
        if (connectedPlayers.ContainsKey(playerId))
        {
            var playerData = connectedPlayers[playerId];
            playerData.position = position;
            connectedPlayers[playerId] = playerData;
        }
    }
    #endregion

    #region Public API
    public bool IsConnected() => isConnected;
    public int GetLocalPlayerId() => localPlayerId;
    
    public NetworkState GetNetworkState()
    {
        return new NetworkState
        {
            isConnected = isConnected,
            localPlayerId = localPlayerId,
            connectedPlayerCount = connectedPlayers.Count,
            networkType = useLocalNetwork ? "Local" : "Mirror"
        };
    }
    #endregion

    #region Network State Structure
    [System.Serializable]
    public struct NetworkState
    {
        public bool isConnected;
        public int localPlayerId;
        public int connectedPlayerCount;
        public string networkType;
    }
    #endregion
}
```

### 2.4 FeedbackOrchestrator (反馈协调器)

```csharp
/// <summary>
/// 反馈协调器 - 统一管理触觉、音效、视觉反馈
/// 借鉴ESP32OutputProcessor的优先级队列系统
/// </summary>
public class FeedbackOrchestrator : MonoBehaviour
{
    #region Singleton
    private static FeedbackOrchestrator _instance;
    public static FeedbackOrchestrator Instance => _instance;
    #endregion

    #region Events
    public static event System.Action<FeedbackData> OnFeedbackTriggered;
    public static event System.Action<FeedbackData> OnFeedbackCompleted;
    #endregion

    #region Feedback Components
    [Header("Feedback Components")]
    [SerializeField] private HapticFeedbackManager hapticManager;
    [SerializeField] private AudioFeedbackManager audioManager;
    [SerializeField] private VisualFeedbackManager visualManager;
    #endregion

    #region Queue System (类似ESP32OutputProcessor)
    private Queue<FeedbackRequest> feedbackQueue = new();
    private bool isProcessingFeedback = false;
    private const int MAX_QUEUE_SIZE = 50;
    
    [System.Serializable]
    private struct FeedbackRequest
    {
        public FeedbackData feedbackData;
        public FeedbackPriority priority;
        public float timestamp;
    }
    #endregion

    #region Feedback Patterns (类似ESP32的FEEDBACK_PATTERNS)
    private static readonly Dictionary<string, FeedbackPattern> FEEDBACK_PATTERNS = new()
    {
        // Emoji选择反馈
        ["selection_start"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.3f },
            audioCue = "ui_select_start",
            visualEffect = "selection_glow",
            duration = 0.2f
        },
        
        ["emoji_beer_select"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.4f, 0.1f, 0.4f },
            audioCue = "beer_select",
            visualEffect = "beer_highlight",
            duration = 0.6f
        },
        
        ["emoji_kiss_select"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.6f, 0.2f, 0.6f, 0.2f, 0.6f },
            audioCue = "kiss_select",
            visualEffect = "heart_particles",
            duration = 1.0f
        },
        
        ["target_select"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.5f },
            audioCue = "target_locked",
            visualEffect = "target_highlight",
            duration = 0.3f
        },
        
        // Emoji发送反馈
        ["emoji_send"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.7f, 0.3f, 0.7f },
            audioCue = "emoji_sent",
            visualEffect = "send_burst",
            duration = 0.8f
        },
        
        // Emoji接收反馈
        ["emoji_beer_received"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.5f, 0.2f, 0.5f, 0.2f, 0.5f },
            audioCue = "beer_cheers",
            visualEffect = "beer_splash",
            duration = 1.5f
        },
        
        ["emoji_kiss_received"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.8f, 0.4f, 0.8f, 0.4f, 0.8f, 0.4f, 0.8f },
            audioCue = "kiss_sound",
            visualEffect = "heart_explosion",
            duration = 2.0f
        },
        
        // 取消反馈
        ["selection_cancelled"] = new FeedbackPattern
        {
            hapticPattern = new float[] { 0.2f, 0.1f, 0.2f, 0.1f, 0.2f },
            audioCue = "ui_cancel",
            visualEffect = "fade_out",
            duration = 0.5f
        }
    };

    [System.Serializable]
    private struct FeedbackPattern
    {
        public float[] hapticPattern;
        public string audioCue;
        public string visualEffect;
        public float duration;
    }
    #endregion

    #region Unity Lifecycle
    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }
        _instance = this;
        
        InitializeFeedbackSystems();
    }

    private void Update()
    {
        ProcessFeedbackQueue();
    }
    #endregion

    #region Initialization
    private void InitializeFeedbackSystems()
    {
        // 获取或创建反馈管理器组件
        if (hapticManager == null)
            hapticManager = GetComponent<HapticFeedbackManager>() ?? gameObject.AddComponent<HapticFeedbackManager>();
        
        if (audioManager == null)
            audioManager = GetComponent<AudioFeedbackManager>() ?? gameObject.AddComponent<AudioFeedbackManager>();
        
        if (visualManager == null)
            visualManager = GetComponent<VisualFeedbackManager>() ?? gameObject.AddComponent<VisualFeedbackManager>();

        Debug.Log("✅ FeedbackOrchestrator initialized");
    }
    #endregion

    #region Public Trigger Methods
    public void TriggerSelectionStartFeedback()
    {
        TriggerPatternFeedback("selection_start", FeedbackPriority.NORMAL);
    }

    public void TriggerEmojiSelectFeedback(EmojiType emoji)
    {
        string patternKey = emoji == EmojiType.BEER ? "emoji_beer_select" : "emoji_kiss_select";
        TriggerPatternFeedback(patternKey, FeedbackPriority.NORMAL);
    }

    public void TriggerTargetSelectFeedback()
    {
        TriggerPatternFeedback("target_select", FeedbackPriority.NORMAL);
    }

    public void TriggerEmojiSendFeedback(EmojiData emojiData)
    {
        TriggerPatternFeedback("emoji_send", FeedbackPriority.HIGH);
    }

    public void TriggerEmojiReceiveFeedback(EmojiData emojiData)
    {
        string patternKey = emojiData.emojiType == EmojiType.BEER ? 
                           "emoji_beer_received" : "emoji_kiss_received";
        TriggerPatternFeedback(patternKey, FeedbackPriority.URGENT);
    }

    public void TriggerCancelFeedback()
    {
        TriggerPatternFeedback("selection_cancelled", FeedbackPriority.NORMAL);
    }
    #endregion

    #region Pattern Processing
    private void TriggerPatternFeedback(string patternKey, FeedbackPriority priority)
    {
        if (!FEEDBACK_PATTERNS.TryGetValue(patternKey, out var pattern))
        {
            Debug.LogWarning($"⚠️ Feedback pattern not found: {patternKey}");
            return;
        }

        var feedbackData = new FeedbackData
        {
            feedbackType = FeedbackType.HAPTIC, // 主要反馈类型
            action = patternKey,
            intensity = CalculateIntensityFromPattern(pattern),
            duration = pattern.duration,
            pattern = pattern.hapticPattern.Select(f => f.ToString()).ToArray(),
            priority = priority
        };

        QueueFeedback(feedbackData, priority);
    }

    private float CalculateIntensityFromPattern(FeedbackPattern pattern)
    {
        if (pattern.hapticPattern == null || pattern.hapticPattern.Length == 0)
            return 0.5f;
        
        return pattern.hapticPattern.Max(); // 使用最大强度作为整体强度
    }
    #endregion

    #region Queue Management (类似ESP32OutputProcessor)
    private void QueueFeedback(FeedbackData feedbackData, FeedbackPriority priority)
    {
        if (feedbackQueue.Count >= MAX_QUEUE_SIZE)
        {
            Debug.LogWarning("⚠️ Feedback queue full, dropping oldest feedback");
            feedbackQueue.Dequeue();
        }

        var request = new FeedbackRequest
        {
            feedbackData = feedbackData,
            priority = priority,
            timestamp = Time.time
        };

        feedbackQueue.Enqueue(request);
        OnFeedbackTriggered?.Invoke(feedbackData);
    }

    private void ProcessFeedbackQueue()
    {
        if (isProcessingFeedback || feedbackQueue.Count == 0) return;

        var request = feedbackQueue.Dequeue();
        StartCoroutine(ExecuteFeedback(request));
    }

    private System.Collections.IEnumerator ExecuteFeedback(FeedbackRequest request)
    {
        isProcessingFeedback = true;
        
        var feedbackData = request.feedbackData;
        var pattern = FEEDBACK_PATTERNS[feedbackData.action];

        // 并行执行多模态反馈
        var tasks = new List<Coroutine>();
        
        // 触觉反馈
        if (pattern.hapticPattern != null && pattern.hapticPattern.Length > 0)
        {
            tasks.Add(StartCoroutine(hapticManager.ExecuteHapticPattern(pattern.hapticPattern, feedbackData.intensity)));
        }
        
        // 音效反馈
        if (!string.IsNullOrEmpty(pattern.audioCue))
        {
            tasks.Add(StartCoroutine(audioManager.PlayAudioCue(pattern.audioCue, feedbackData.intensity)));
        }
        
        // 视觉反馈
        if (!string.IsNullOrEmpty(pattern.visualEffect))
        {
            tasks.Add(StartCoroutine(visualManager.TriggerVisualEffect(pattern.visualEffect, feedbackData.intensity)));
        }

        // 等待所有反馈完成
        yield return new WaitForSeconds(pattern.duration);
        
        OnFeedbackCompleted?.Invoke(feedbackData);
        isProcessingFeedback = false;
    }
    #endregion

    #region Public API
    public bool IsReady()
    {
        return hapticManager != null && 
               audioManager != null && 
               visualManager != null;
    }

    public FeedbackQueueState GetQueueStatus()
    {
        return new FeedbackQueueState
        {
            queueLength = feedbackQueue.Count,
            isProcessing = isProcessingFeedback,
            maxQueueSize = MAX_QUEUE_SIZE
        };
    }

    public void ClearQueue()
    {
        feedbackQueue.Clear();
        Debug.Log("🗑️ Feedback queue cleared");
    }
    #endregion
}

#region Support Structures
[System.Serializable]
public struct FeedbackQueueState
{
    public int queueLength;
    public bool isProcessing;
    public int maxQueueSize;
}

// 各种反馈管理器的简化接口
public class HapticFeedbackManager : MonoBehaviour
{
    public System.Collections.IEnumerator ExecuteHapticPattern(float[] pattern, float intensity)
    {
        // VR控制器触觉反馈实现
        Debug.Log($"🎮 Haptic feedback: intensity={intensity}");
        yield return new WaitForSeconds(0.5f);
    }
}

public class AudioFeedbackManager : MonoBehaviour
{
    public System.Collections.IEnumerator PlayAudioCue(string cueName, float intensity)
    {
        // 音效播放实现
        Debug.Log($"🔊 Audio cue: {cueName}, intensity={intensity}");
        yield return new WaitForSeconds(0.3f);
    }
}

public class VisualFeedbackManager : MonoBehaviour
{
    public System.Collections.IEnumerator TriggerVisualEffect(string effectName, float intensity)
    {
        // 视觉特效实现
        Debug.Log($"✨ Visual effect: {effectName}, intensity={intensity}");
        yield return new WaitForSeconds(0.4f);
    }
}
#endregion
```

---

## 🎮 Unity实现指南

### 3. 项目结构建议

```
VREmojiInteraction/
├── Scripts/
│   ├── Core/
│   │   ├── VREmoController.cs        // 主控制器
│   │   ├── InputManager.cs           // 输入处理
│   │   ├── NetworkSyncManager.cs     // 网络同步
│   │   └── FeedbackOrchestrator.cs   // 反馈协调
│   ├── Components/
│   │   ├── EmojiEntity.cs            // Emoji实体
│   │   ├── EmojiAnimator.cs          // 飞行动画
│   │   ├── PlayerTargetIndicator.cs  // 目标指示器
│   │   └── EmojiSelectionUI.cs       // 选择界面
│   ├── Data/
│   │   ├── VREmoProtocol.cs          // 协议定义
│   │   ├── EmojiConfig.cs            // Emoji配置
│   │   └── FeedbackPatterns.cs       // 反馈模式库
│   └── Utils/
│       ├── ObjectPool.cs             // 对象池
│       └── VREmoDebug.cs             // 调试工具
├── Prefabs/
│   ├── EmojiEntities/
│   │   ├── BeerEmoji.prefab
│   │   └── KissEmoji.prefab
│   ├── UI/
│   │   ├── EmojiSelectionPanel.prefab
│   │   └── TargetSelectionIndicator.prefab
│   └── Effects/
│       ├── BeerSplashEffect.prefab
│       └── HeartExplosionEffect.prefab
├── Materials/
├── Audio/
│   ├── UI/
│   ├── Emoji/
│   └── Feedback/
└── Scenes/
    ├── VRRoom_MainScene.unity
    └── VRRoom_TestScene.unity
```

### 4. 关键技术实现

#### 4.1 Emoji飞行动画系统
```csharp
public class EmojiAnimator : MonoBehaviour
{
    [Header("Animation Settings")]
    [SerializeField] private AnimationCurve flightCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
    [SerializeField] private float flightDuration = 2.0f;
    [SerializeField] private float arcHeight = 2.0f;
    
    public void StartFlight(Vector3 startPos, Vector3 targetPos, EmojiType emojiType)
    {
        StartCoroutine(AnimateFlightPath(startPos, targetPos, emojiType));
    }
    
    private System.Collections.IEnumerator AnimateFlightPath(Vector3 start, Vector3 target, EmojiType emojiType)
    {
        float elapsedTime = 0f;
        Vector3 controlPoint = Vector3.Lerp(start, target, 0.5f) + Vector3.up * arcHeight;
        
        while (elapsedTime < flightDuration)
        {
            float t = elapsedTime / flightDuration;
            float curveValue = flightCurve.Evaluate(t);
            
            // 贝塞尔曲线飞行路径
            Vector3 currentPos = CalculateBezierPoint(start, controlPoint, target, curveValue);
            transform.position = currentPos;
            
            // Emoji特定的旋转和缩放
            ApplyEmojiSpecificAnimation(emojiType, curveValue);
            
            elapsedTime += Time.deltaTime;
            yield return null;
        }
        
        // 到达目标，触发接收效果
        TriggerArrivalEffect(emojiType);
    }
}
```

#### 4.2 XR输入系统集成
```csharp
// 使用Unity XR Input System
[Header("XR Input Actions")]
[SerializeField] private InputActionReference primaryButtonAction;
[SerializeField] private InputActionReference thumbstickAction;

// 在InputManager中配置XR输入
private void ConfigureXRInput()
{
    // 绑定VR控制器输入
    primaryButtonAction.action.performed += OnPrimaryButtonPressed;
    thumbstickAction.action.performed += OnThumbstickMoved;
}
```

### 5. 扩展性设计

#### 5.1 新Emoji类型添加
```csharp
// Emoji配置的可扩展结构
[CreateAssetMenu(fileName = "EmojiConfig", menuName = "VREmo/Emoji Configuration")]
public class EmojiConfigSO : ScriptableObject
{
    [System.Serializable]
    public struct EmojiDefinition
    {
        public EmojiType type;
        public GameObject prefab;
        public FeedbackPattern receiveFeedback;
        public string displayName;
        public Sprite icon;
    }
    
    [SerializeField] private EmojiDefinition[] emojiDefinitions;
    
    // 支持运行时动态添加新Emoji类型
    public void RegisterNewEmoji(EmojiDefinition newEmoji) { ... }
}
```

#### 5.2 网络方案适配层
```csharp
// 网络抽象接口，支持多种网络方案
public interface INetworkProvider
{
    bool IsConnected { get; }
    void SendMessage(VREmoMessage message);
    event System.Action<VREmoMessage> OnMessageReceived;
}

// 具体实现可以是Mirror、Photon、或自定义方案
public class MirrorNetworkProvider : INetworkProvider { ... }
public class PhotonNetworkProvider : INetworkProvider { ... }
```

---

## 🛠️ 开发建议

### 开发优先级
1. **第一阶段**：核心架构搭建（VREmoController + 基础组件）
2. **第二阶段**：输入系统实现（长按检测 + Emoji选择）
3. **第三阶段**：本地反馈系统（触觉 + 音效 + 视觉）
4. **第四阶段**：网络同步功能（本地测试 → 真实网络）
5. **第五阶段**：动画和视觉效果优化

### 测试策略
- **单元测试**：每个原子服务独立测试
- **集成测试**：完整交互流程测试
- **性能测试**：VR环境下的帧率和延迟测试
- **用户测试**：真实VR环境下的交互体验测试

### 性能优化建议
- **对象池**：Emoji实体和粒子效果复用
- **LOD系统**：根据距离调整Emoji细节
- **异步加载**：音效和特效资源异步加载
- **网络优化**：消息压缩和批量发送

---

## 📝 最后说明

这个技术规范基于VisionNav项目中经过实战验证的ESP32蓝牙控制系统架构，将其"好品味"的设计理念延伸到VR环境中。

### 核心优势
1. **模块化设计**：三层原子服务，职责清晰，易于测试和维护
2. **事件驱动架构**：松耦合，易于扩展新功能
3. **数据结构优先**：统一协议，消除特殊情况
4. **优先级队列系统**：确保重要反馈及时执行
5. **向后兼容性**：支持新Emoji类型和反馈模式的无缝添加

### 实现建议
- 从最简单的本地双人互动开始实现
- 优先完成触觉反馈，再扩展音效和视觉
- 使用Unity的现代系统（Input System、Timeline、Job System）
- 遵循SOLID原则，保持代码可测试性

这个系统将为VR社交应用提供一个坚实、可扩展的Emoji交互基础。