using UnityEngine;

public class NpcWave : MonoBehaviour
{
    public GameObject emojiPrefab;
    public Transform player;
    [Header("Spawn Settings")]
    public float spawnHeight = 2.2f; // 更高一点
    public float spawnRightOffset = 0f; // 右侧偏移（+右 / -左）

    // 动画事件会调用这个方法
    public void SendEmoji()
    {
        Vector3 spawnPos = transform.position + Vector3.up * spawnHeight + transform.right * spawnRightOffset;
        GameObject bubble = Instantiate(emojiPrefab, spawnPos, Quaternion.identity);
        var bubbleComp = bubble.GetComponent<EmojiBubble>();
        if (bubbleComp != null)
        {
            bubbleComp.SetTarget(player);
            bubbleComp.SetSender(transform);
            bubbleComp.SetSourcePrefab(emojiPrefab);
        }
    }
}