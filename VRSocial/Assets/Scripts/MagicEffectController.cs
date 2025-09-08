using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 魔法效果状态
/// </summary>
public class EffectInstance
{
    public GameObject effectObject;
    public MagicEffect effectType;
    public float remainingTime;
    public bool isActive;
    
    public EffectInstance(GameObject obj, MagicEffect type, float duration)
    {
        effectObject = obj;
        effectType = type;
        remainingTime = duration;
        isActive = true;
    }
}

/// <summary>
/// 魔法效果控制器 - 管理所有VR魔法效果
/// 替代原有的HandSkills，支持更多效果类型和精确控制
/// </summary>
public class MagicEffectController
{
    // 效果预制体
    private GameObject firePrefab;
    private GameObject waterPrefab;
    private Transform mouthPoint;
    
    // 效果实例池
    private readonly Dictionary<MagicEffect, GameObject> effectInstances = 
        new Dictionary<MagicEffect, GameObject>();
    private readonly List<EffectInstance> activeEffects = new List<EffectInstance>();
    
    // 配置参数
    private const float DEFAULT_EFFECT_DURATION = 2.0f;
    private const int MAX_CONCURRENT_EFFECTS = 5;
    
    // 统计信息
    private int totalEffectsTriggered = 0;
    private readonly Dictionary<MagicEffect, int> effectCounts = 
        new Dictionary<MagicEffect, int>();
    
    /// <summary>
    /// 初始化魔法效果控制器
    /// </summary>
    public void Initialize(GameObject fire, GameObject water, Transform mouth)
    {
        firePrefab = fire;
        waterPrefab = water;
        mouthPoint = mouth;
        
        Debug.Log("[MagicEffectController] 初始化完成");
        
        // 预创建效果实例（性能优化）
        PreCreateEffectInstances();
    }
    
    /// <summary>
    /// 触发指定的魔法效果
    /// </summary>
    public void TriggerEffect(MagicEffect effectType, float duration = -1)
    {
        if (mouthPoint == null)
        {
            Debug.LogError("[MagicEffectController] mouthPoint未设置");
            return;
        }
        
        // 使用默认持续时间
        if (duration <= 0) duration = DEFAULT_EFFECT_DURATION;
        
        // 限制并发效果数量
        if (activeEffects.Count >= MAX_CONCURRENT_EFFECTS)
        {
            Debug.LogWarning("[MagicEffectController] 达到最大并发效果限制");
            StopOldestEffect();
        }
        
        try
        {
            GameObject effectObj = GetOrCreateEffectInstance(effectType);
            if (effectObj != null)
            {
                // 激活效果
                effectObj.SetActive(true);
                
                // 添加到活跃效果列表
                var effectInstance = new EffectInstance(effectObj, effectType, duration);
                activeEffects.Add(effectInstance);
                
                // 更新统计
                totalEffectsTriggered++;
                UpdateEffectStats(effectType);
                
                Debug.Log($"[MagicEffectController] 触发效果: {effectType}, 持续: {duration}s");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[MagicEffectController] 触发效果失败: {e.Message}");
        }
    }
    
    /// <summary>
    /// 停止指定类型的所有效果
    /// </summary>
    public void StopEffect(MagicEffect effectType)
    {
        for (int i = activeEffects.Count - 1; i >= 0; i--)
        {
            if (activeEffects[i].effectType == effectType)
            {
                StopEffectInstance(activeEffects[i]);
                activeEffects.RemoveAt(i);
            }
        }
    }
    
    /// <summary>
    /// 停止所有效果
    /// </summary>
    public void StopAllEffects()
    {
        for (int i = activeEffects.Count - 1; i >= 0; i--)
        {
            StopEffectInstance(activeEffects[i]);
        }
        activeEffects.Clear();
    }
    
    /// <summary>
    /// 每帧更新 - 管理效果生命周期
    /// </summary>
    public void Update()
    {
        float deltaTime = Time.deltaTime;
        
        // 更新活跃效果
        for (int i = activeEffects.Count - 1; i >= 0; i--)
        {
            var effect = activeEffects[i];
            effect.remainingTime -= deltaTime;
            
            // 检查效果是否应该停止
            if (effect.remainingTime <= 0)
            {
                StopEffectInstance(effect);
                activeEffects.RemoveAt(i);
            }
        }
    }
    
    /// <summary>
    /// 获取或创建效果实例
    /// </summary>
    private GameObject GetOrCreateEffectInstance(MagicEffect effectType)
    {
        // 检查是否已有实例
        if (effectInstances.TryGetValue(effectType, out GameObject existingInstance))
        {
            if (existingInstance != null) return existingInstance;
        }
        
        // 创建新实例
        GameObject newInstance = CreateEffectInstance(effectType);
        if (newInstance != null)
        {
            effectInstances[effectType] = newInstance;
        }
        
        return newInstance;
    }
    
    /// <summary>
    /// 创建效果实例
    /// </summary>
    private GameObject CreateEffectInstance(MagicEffect effectType)
    {
        GameObject prefab = GetPrefabForEffect(effectType);
        if (prefab == null) return null;
        
        GameObject instance = Object.Instantiate(prefab, mouthPoint.position, 
                                                mouthPoint.rotation, mouthPoint);
        instance.name = $"{effectType}_Effect";
        instance.SetActive(false); // 初始状态为非活跃
        
        return instance;
    }
    
    /// <summary>
    /// 根据效果类型获取对应的预制体
    /// </summary>
    private GameObject GetPrefabForEffect(MagicEffect effectType)
    {
        switch (effectType)
        {
            case MagicEffect.Fire:
                return firePrefab;
                
            case MagicEffect.Water:
                return waterPrefab;
                
            case MagicEffect.FireWater:
                // 可以创建组合效果或随机选择
                return Random.value > 0.5f ? firePrefab : waterPrefab;
                
            case MagicEffect.Lightning:
            case MagicEffect.Healing:
            case MagicEffect.Custom1:
            case MagicEffect.Custom2:
                // 这些效果需要额外的预制体，当前使用火效果作为占位
                Debug.LogWarning($"[MagicEffectController] 效果 {effectType} 暂未实现，使用火效果");
                return firePrefab;
                
            default:
                Debug.LogWarning($"[MagicEffectController] 未知效果类型: {effectType}");
                return null;
        }
    }
    
    /// <summary>
    /// 停止效果实例
    /// </summary>
    private void StopEffectInstance(EffectInstance effectInstance)
    {
        if (effectInstance?.effectObject != null)
        {
            effectInstance.effectObject.SetActive(false);
            effectInstance.isActive = false;
        }
    }
    
    /// <summary>
    /// 停止最旧的效果（当达到并发限制时）
    /// </summary>
    private void StopOldestEffect()
    {
        if (activeEffects.Count > 0)
        {
            var oldest = activeEffects[0];
            StopEffectInstance(oldest);
            activeEffects.RemoveAt(0);
        }
    }
    
    /// <summary>
    /// 预创建效果实例（性能优化）
    /// </summary>
    private void PreCreateEffectInstances()
    {
        if (firePrefab != null)
        {
            GetOrCreateEffectInstance(MagicEffect.Fire);
        }
        
        if (waterPrefab != null)
        {
            GetOrCreateEffectInstance(MagicEffect.Water);
        }
        
        Debug.Log("[MagicEffectController] 预创建效果实例完成");
    }
    
    /// <summary>
    /// 更新效果统计
    /// </summary>
    private void UpdateEffectStats(MagicEffect effectType)
    {
        if (effectCounts.ContainsKey(effectType))
        {
            effectCounts[effectType]++;
        }
        else
        {
            effectCounts[effectType] = 1;
        }
    }
    
    /// <summary>
    /// 获取效果统计信息
    /// </summary>
    public (int total, Dictionary<MagicEffect, int> counts, int active) GetStatistics()
    {
        return (totalEffectsTriggered, 
                new Dictionary<MagicEffect, int>(effectCounts), 
                activeEffects.Count);
    }
    
    /// <summary>
    /// 清理资源
    /// </summary>
    public void Cleanup()
    {
        StopAllEffects();
        
        foreach (var instance in effectInstances.Values)
        {
            if (instance != null)
            {
                Object.Destroy(instance);
            }
        }
        effectInstances.Clear();
        
        Debug.Log("[MagicEffectController] 资源清理完成");
    }
}