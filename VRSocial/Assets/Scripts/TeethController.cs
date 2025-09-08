using UnityEngine;
using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

/// <summary>
/// 牙套控制器 - 接收ESP32发送的牙套按钮数据，控制VR魔法效果
/// 高度模块化设计，支持灵活的JSON格式
/// </summary>
public class TeethController : MonoBehaviour
{
    [Header("Network Settings")]
    [SerializeField] private int listenPort = 8888;
    [SerializeField] private bool enableLogging = true;
    
    [Header("Magic Effects")]
    [SerializeField] private GameObject firePrefab;
    [SerializeField] private GameObject waterPrefab;
    [SerializeField] private Transform mouthPoint;
    
    [Header("Gesture Mapping")]
    [SerializeField] private TeethGestureMapping[] gestureMappings;
    
    // 核心组件
    private UDPReceiver udpReceiver;
    private TeethInputProcessor inputProcessor;
    private MagicEffectController effectController;
    private ConnectionStatusUI statusUI;
    
    // 运行状态
    private bool isRunning = false;
    private int receivedMessageCount = 0;
    
    void Start()
    {
        InitializeComponents();
        StartListening();
    }
    
    void OnDestroy()
    {
        StopListening();
    }
    
    void Update()
    {
        // 处理接收到的消息队列
        if (udpReceiver != null)
        {
            while (udpReceiver.HasPendingMessages())
            {
                string jsonMessage = udpReceiver.GetNextMessage();
                ProcessTeethInput(jsonMessage);
            }
        }
        
        // 更新效果控制器
        effectController?.Update();
    }
    
    private void InitializeComponents()
    {
        Log("初始化牙套控制器组件...");
        
        // 初始化UDP接收器
        udpReceiver = new UDPReceiver();
        
        // 初始化输入处理器
        inputProcessor = new TeethInputProcessor();
        inputProcessor.SetGestureMappings(gestureMappings);
        
        // 初始化效果控制器
        effectController = new MagicEffectController();
        effectController.Initialize(firePrefab, waterPrefab, mouthPoint);
        
        // 初始化状态UI（可选）
        statusUI = GetComponent<ConnectionStatusUI>();
        
        Log("组件初始化完成");
    }
    
    private void StartListening()
    {
        try
        {
            udpReceiver.StartListening(listenPort);
            isRunning = true;
            Log($"开始监听UDP端口 {listenPort}");
            
            statusUI?.SetConnectionStatus(true);
        }
        catch (Exception e)
        {
            LogError($"启动UDP监听失败: {e.Message}");
            statusUI?.SetConnectionStatus(false);
        }
    }
    
    private void StopListening()
    {
        if (udpReceiver != null)
        {
            udpReceiver.StopListening();
            isRunning = false;
            Log("UDP监听已停止");
        }
        
        statusUI?.SetConnectionStatus(false);
    }
    
    private void ProcessTeethInput(string jsonMessage)
    {
        try
        {
            receivedMessageCount++;
            Log($"收到消息 #{receivedMessageCount}: {jsonMessage}");
            
            // 解析JSON输入
            TeethInputData inputData = inputProcessor.ParseInput(jsonMessage);
            if (inputData == null) return;
            
            // 根据手势触发相应效果
            MagicEffect effect = inputProcessor.GetEffectForGesture(inputData);
            if (effect != MagicEffect.None)
            {
                effectController.TriggerEffect(effect, inputData.duration);
                Log($"触发效果: {effect}, 持续时间: {inputData.duration}s");
                
                // 发送反馈给ESP32（可选）
                SendFeedbackToESP32(inputData, effect);
            }
            
            // 更新状态UI
            statusUI?.UpdateLastMessage(inputData);
        }
        catch (Exception e)
        {
            LogError($"处理牙套输入失败: {e.Message}");
        }
    }
    
    private void SendFeedbackToESP32(TeethInputData input, MagicEffect effect)
    {
        // 这里可以实现反馈功能，发送状态给ESP32
        // 当前版本暂时不实现，专注于单向通信
        
        var feedback = new {
            info = $"{effect.ToString().ToLower()}_activated",
            output_mode = effect.ToString().ToLower(),
            status = "success",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        
        // 可以在这里添加UDP发送逻辑
    }
    
    private void Log(string message)
    {
        if (enableLogging)
        {
            Debug.Log($"[TeethController] {message}");
        }
    }
    
    private void LogError(string message)
    {
        Debug.LogError($"[TeethController] {message}");
    }
    
    // 公共接口用于调试和配置
    public void SetListenPort(int port)
    {
        if (!isRunning)
        {
            listenPort = port;
        }
    }
    
    public void RestartListener()
    {
        StopListening();
        StartListening();
    }
    
    public int GetReceivedMessageCount()
    {
        return receivedMessageCount;
    }
    
    public bool IsListening()
    {
        return isRunning && udpReceiver != null && udpReceiver.IsListening();
    }
}