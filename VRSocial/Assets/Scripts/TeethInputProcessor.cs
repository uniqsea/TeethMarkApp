using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

/// <summary>
/// 牙套输入数据结构 - 对应ESP32发送的JSON格式
/// </summary>
[System.Serializable]
public class TeethInputData
{
    public string gesture;      // "single_click", "long_press", "multi_press", "slide"
    public int[] teeth;         // 按钮编号数组 [1,2,3,4]
    public float duration;      // 持续时间(秒)
    public long timestamp;      // 时间戳
    public string device_id;    // 设备ID
    
    // 扩展字段支持
    public Dictionary<string, object> extra;
    
    public bool IsValid()
    {
        return !string.IsNullOrEmpty(gesture) && 
               teeth != null && teeth.Length > 0 &&
               duration >= 0;
    }
}

/// <summary>
/// 手势映射配置 - 在Unity Inspector中配置
/// </summary>
[System.Serializable]
public class TeethGestureMapping
{
    [Header("手势识别")]
    public string gestureName;          // 手势名称
    public int[] requiredTeeth;         // 需要的按钮组合
    public float minDuration = 0f;      // 最小持续时间
    public float maxDuration = 10f;     // 最大持续时间
    
    [Header("触发效果")]
    public MagicEffect triggerEffect;   // 触发的魔法效果
    public bool exactMatch = true;      // 是否需要精确匹配按钮
    
    public bool Matches(TeethInputData input)
    {
        if (gestureName != input.gesture) return false;
        if (input.duration < minDuration || input.duration > maxDuration) return false;
        
        if (exactMatch)
        {
            return requiredTeeth.Length == input.teeth.Length &&
                   requiredTeeth.All(t => input.teeth.Contains(t));
        }
        else
        {
            return requiredTeeth.All(t => input.teeth.Contains(t));
        }
    }
}

/// <summary>
/// 魔法效果枚举
/// </summary>
public enum MagicEffect
{
    None,
    Fire,           // 喷火
    Water,          // 喷水
    FireWater,      // 火水混合
    Healing,        // 治愈术
    Lightning,      // 闪电
    Custom1,        // 自定义效果1
    Custom2         // 自定义效果2
}

/// <summary>
/// 牙套输入处理器 - 解析JSON，识别手势，映射到魔法效果
/// 高度灵活的JSON处理和手势识别系统
/// </summary>
public class TeethInputProcessor
{
    private TeethGestureMapping[] gestureMappings;
    private readonly Dictionary<string, int> gestureStats = new Dictionary<string, int>();
    
    /// <summary>
    /// 设置手势映射配置
    /// </summary>
    public void SetGestureMappings(TeethGestureMapping[] mappings)
    {
        gestureMappings = mappings ?? new TeethGestureMapping[0];
        Debug.Log($"[TeethInputProcessor] 加载了 {gestureMappings.Length} 个手势映射");
        
        // 打印手势映射信息
        foreach (var mapping in gestureMappings)
        {
            Debug.Log($"[TeethInputProcessor] 手势: {mapping.gestureName} -> 效果: {mapping.triggerEffect}");
        }
    }
    
    /// <summary>
    /// 解析JSON输入为牙套数据结构
    /// </summary>
    public TeethInputData ParseInput(string jsonString)
    {
        if (string.IsNullOrEmpty(jsonString))
        {
            Debug.LogWarning("[TeethInputProcessor] JSON字符串为空");
            return null;
        }
        
        try
        {
            // 使用Unity内置JSON解析（简单场景）
            TeethInputData data = JsonUtility.FromJson<TeethInputData>(jsonString);
            
            // 基本验证
            if (data == null || !data.IsValid())
            {
                Debug.LogWarning($"[TeethInputProcessor] 无效的输入数据: {jsonString}");
                return null;
            }
            
            // 统计手势使用情况
            UpdateGestureStats(data.gesture);
            
            return data;
        }
        catch (Exception e)
        {
            Debug.LogError($"[TeethInputProcessor] JSON解析失败: {e.Message}\\n原始数据: {jsonString}");
            return null;
        }
    }
    
    /// <summary>
    /// 根据手势数据获取对应的魔法效果
    /// </summary>
    public MagicEffect GetEffectForGesture(TeethInputData input)
    {
        if (input == null || gestureMappings == null) return MagicEffect.None;
        
        // 查找匹配的手势映射
        foreach (var mapping in gestureMappings)
        {
            if (mapping.Matches(input))
            {
                Debug.Log($"[TeethInputProcessor] 手势匹配: {input.gesture} -> {mapping.triggerEffect}");
                return mapping.triggerEffect;
            }
        }
        
        // 如果没有找到映射，尝试默认规则
        MagicEffect defaultEffect = GetDefaultEffect(input);
        if (defaultEffect != MagicEffect.None)
        {
            Debug.Log($"[TeethInputProcessor] 使用默认映射: {input.gesture} -> {defaultEffect}");
        }
        else
        {
            Debug.LogWarning($"[TeethInputProcessor] 未找到手势映射: {input.gesture}");
        }
        
        return defaultEffect;
    }
    
    /// <summary>
    /// 获取默认的效果映射（当没有配置映射时使用）
    /// </summary>
    private MagicEffect GetDefaultEffect(TeethInputData input)
    {
        // 简单的默认规则
        switch (input.gesture.ToLower())
        {
            case "single_click":
                return input.teeth.Contains(1) || input.teeth.Contains(2) ? MagicEffect.Fire : MagicEffect.Water;
                
            case "long_press":
                return input.teeth.Length > 1 ? MagicEffect.FireWater : MagicEffect.Fire;
                
            case "slide":
                return MagicEffect.Lightning;
                
            case "multi_press":
                return input.teeth.Length >= 3 ? MagicEffect.Healing : MagicEffect.Water;
                
            default:
                return MagicEffect.None;
        }
    }
    
    /// <summary>
    /// 更新手势统计
    /// </summary>
    private void UpdateGestureStats(string gesture)
    {
        if (gestureStats.ContainsKey(gesture))
        {
            gestureStats[gesture]++;
        }
        else
        {
            gestureStats[gesture] = 1;
        }
    }
    
    /// <summary>
    /// 获取手势使用统计
    /// </summary>
    public Dictionary<string, int> GetGestureStatistics()
    {
        return new Dictionary<string, int>(gestureStats);
    }
    
    /// <summary>
    /// 清空统计数据
    /// </summary>
    public void ClearStatistics()
    {
        gestureStats.Clear();
    }
    
    /// <summary>
    /// 验证JSON格式是否正确（用于测试）
    /// </summary>
    public bool ValidateJSONFormat(string jsonString)
    {
        try
        {
            var data = JsonUtility.FromJson<TeethInputData>(jsonString);
            return data != null && data.IsValid();
        }
        catch
        {
            return false;
        }
    }
}