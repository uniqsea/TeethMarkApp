using System;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEngine;

/// <summary>
/// UDP消息接收器 - 在后台线程接收UDP消息，线程安全的消息队列
/// 高性能、低延迟的网络通信模块
/// </summary>
public class UDPReceiver
{
    private UdpClient udpClient;
    private Thread receivingThread;
    private bool isListening = false;
    
    // 线程安全的消息队列
    private readonly ConcurrentQueue<string> messageQueue = new ConcurrentQueue<string>();
    private readonly object lockObject = new object();
    
    // 统计信息
    private int totalReceived = 0;
    private int totalErrors = 0;
    private DateTime lastMessageTime;
    
    // 配置参数
    private const int MAX_QUEUE_SIZE = 1000;
    private const int RECEIVE_TIMEOUT = 1000; // 1秒超时
    
    /// <summary>
    /// 开始监听指定端口的UDP消息
    /// </summary>
    public void StartListening(int port)
    {
        if (isListening)
        {
            Debug.LogWarning("[UDPReceiver] 已经在监听中");
            return;
        }
        
        try
        {
            udpClient = new UdpClient(port);
            udpClient.Client.ReceiveTimeout = RECEIVE_TIMEOUT;
            
            isListening = true;
            
            // 启动接收线程
            receivingThread = new Thread(ReceiveMessages)
            {
                IsBackground = true,
                Name = "UDP_Receiver_Thread"
            };
            receivingThread.Start();
            
            Debug.Log($"[UDPReceiver] 开始监听端口 {port}");
        }
        catch (Exception e)
        {
            Debug.LogError($"[UDPReceiver] 启动监听失败: {e.Message}");
            isListening = false;
            throw;
        }
    }
    
    /// <summary>
    /// 停止监听
    /// </summary>
    public void StopListening()
    {
        lock (lockObject)
        {
            isListening = false;
        }
        
        try
        {
            udpClient?.Close();
            
            // 等待接收线程结束
            if (receivingThread != null && receivingThread.IsAlive)
            {
                receivingThread.Join(2000); // 最多等待2秒
                if (receivingThread.IsAlive)
                {
                    Debug.LogWarning("[UDPReceiver] 强制终止接收线程");
                    receivingThread.Abort();
                }
            }
            
            Debug.Log("[UDPReceiver] 监听已停止");
        }
        catch (Exception e)
        {
            Debug.LogError($"[UDPReceiver] 停止监听时出错: {e.Message}");
        }
        finally
        {
            udpClient = null;
            receivingThread = null;
        }
    }
    
    /// <summary>
    /// 检查是否有待处理的消息
    /// </summary>
    public bool HasPendingMessages()
    {
        return !messageQueue.IsEmpty;
    }
    
    /// <summary>
    /// 获取下一条消息（非阻塞）
    /// </summary>
    public string GetNextMessage()
    {
        messageQueue.TryDequeue(out string message);
        return message;
    }
    
    /// <summary>
    /// 获取所有待处理消息
    /// </summary>
    public string[] GetAllMessages()
    {
        var messages = new System.Collections.Generic.List<string>();
        while (messageQueue.TryDequeue(out string message))
        {
            messages.Add(message);
        }
        return messages.ToArray();
    }
    
    /// <summary>
    /// 检查是否正在监听
    /// </summary>
    public bool IsListening()
    {
        lock (lockObject)
        {
            return isListening && udpClient != null;
        }
    }
    
    /// <summary>
    /// 获取统计信息
    /// </summary>
    public (int received, int errors, DateTime lastMessage) GetStatistics()
    {
        return (totalReceived, totalErrors, lastMessageTime);
    }
    
    /// <summary>
    /// 后台线程接收消息的主循环
    /// </summary>
    private void ReceiveMessages()
    {
        Debug.Log("[UDPReceiver] 接收线程已启动");
        
        while (true)
        {
            lock (lockObject)
            {
                if (!isListening) break;
            }
            
            try
            {
                // 接收UDP数据
                IPEndPoint remoteEndPoint = new IPEndPoint(IPAddress.Any, 0);
                byte[] receivedBytes = udpClient.Receive(ref remoteEndPoint);
                
                if (receivedBytes.Length > 0)
                {
                    string message = Encoding.UTF8.GetString(receivedBytes);
                    
                    // 添加到消息队列
                    if (messageQueue.Count < MAX_QUEUE_SIZE)
                    {
                        messageQueue.Enqueue(message);
                        totalReceived++;
                        lastMessageTime = DateTime.Now;
                        
                        #if UNITY_EDITOR || DEBUG_UDP
                        Debug.Log($"[UDPReceiver] 收到消息来自 {remoteEndPoint}: {message}");
                        #endif
                    }
                    else
                    {
                        Debug.LogWarning("[UDPReceiver] 消息队列已满，丢弃消息");
                    }
                }
            }
            catch (SocketException e) when (e.SocketErrorCode == SocketError.TimedOut)
            {
                // 超时是正常的，继续循环
                continue;
            }
            catch (ObjectDisposedException)
            {
                // UDP客户端已被释放，正常退出
                break;
            }
            catch (Exception e)
            {
                totalErrors++;
                Debug.LogError($"[UDPReceiver] 接收消息时出错: {e.Message}");
                
                // 避免错误循环
                Thread.Sleep(100);
            }
        }
        
        Debug.Log("[UDPReceiver] 接收线程已退出");
    }
    
    /// <summary>
    /// 清空消息队列
    /// </summary>
    public void ClearMessageQueue()
    {
        while (messageQueue.TryDequeue(out _)) { }
    }
}