using UnityEngine;

public class EmojiBubble : MonoBehaviour
{
    [SerializeField] private Transform target;
    [SerializeField] private Transform sender;
    public GameObject sourcePrefab; // 生成本气泡所用的 prefab（用于回复时复用）
    public float speed = 1.5f;
    public float verticalOffset = 0.5f; // 向上偏移的距离（米）

    [Header("Binder (optional)")]
    public SocialHapticsBinder binder; // 可不指定，运行时自动查找

    [Header("Hit Rules")]
    public bool requireTargetHit = false; // 默认不强制命中 target
    public float activationDelay = 0.15f; // 生成后的短暂保护期，避免立刻与自身碰撞

    private float _spawnTime;

    public void SetTarget(Transform t)
    {
        target = t;
    }

    public void SetSender(Transform s)
    {
        sender = s;
    }

    public void SetSourcePrefab(GameObject prefab)
    {
        sourcePrefab = prefab;
    }

    void Awake()
    {
        if (target == null)
        {
            GameObject playerObj = GameObject.FindWithTag("Player");
            if (playerObj != null) target = playerObj.transform;
        }
        if (binder == null)
        {
            binder = FindAnyObjectByType<SocialHapticsBinder>();
        }
        _spawnTime = Time.time;
    }

    void Update()
    {
        if (target == null) return;

        // 在目标位置基础上增加一个向上的偏移
        Vector3 targetPos = target.position + Vector3.up * verticalOffset;

        transform.position = Vector3.MoveTowards(
            transform.position,
            targetPos,
            speed * Time.deltaTime
        );
    }

    void OnTriggerEnter(Collider other)
    {
        // 保护期：避免刚生成时与自身/附近碰撞体误触
        if (Time.time - _spawnTime < activationDelay) return;

        // 仅允许命中目标（若启用）
        if (requireTargetHit && target != null)
        {
            if (other.transform.root != target.root) return;
        }

        if (other.CompareTag("Player"))
        {
            var type = ResolveEmojiTypeFromName();
            if (binder != null && !string.IsNullOrEmpty(type))
            {
                binder.OnReceiveEmoji(type);
                // 把“上一条消息的发送者”暂存到接收方，便于 Double Area Middle 时回发给对方
                var tracker = other.GetComponentInParent<LastEmojiTracker>();
                if (tracker == null)
                {
                    tracker = other.transform.root.gameObject.AddComponent<LastEmojiTracker>();
                }
                tracker.lastSender = sender ? sender : transform; // 兜底用当前气泡
                tracker.lastEmojiType = type;
                // 记录 prefab 引用或名字，供回放；若实例化时未提供 prefab 资产引用，则至少保留名字
                if (sourcePrefab != null)
                {
                    tracker.lastPrefab = sourcePrefab;
                    tracker.lastPrefabName = sourcePrefab.name;
                }
                else
                {
                    tracker.lastPrefab = null;
                    tracker.lastPrefabName = ResolveEmojiTypeFromName();
                }
            }
            Destroy(gameObject);
        }
    }

    private string ResolveEmojiTypeFromName()
    {
        var n = gameObject.name ?? string.Empty;
        int idx = n.IndexOf("(Clone)");
        if (idx >= 0) n = n.Substring(0, idx);
        n = n.Trim().ToLowerInvariant();
        if (n.Contains("champagne")) return "champagne";
        if (n.Contains("kiss")) return "kiss";
        return n; // 兜底：直接用小写名
    }
}