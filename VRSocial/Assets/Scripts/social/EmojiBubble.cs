using UnityEngine;

public class EmojiBubble : MonoBehaviour
{
    [SerializeField] private Transform target;
    public float speed = 1.5f;
    public float verticalOffset = 0.5f; // 向上偏移的距离（米）

    public void SetTarget(Transform t)
    {
        target = t;
    }

    void Awake()
    {
        if (target == null)
        {
            GameObject playerObj = GameObject.FindWithTag("Player");
            if (playerObj != null) target = playerObj.transform;
        }
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
        if (other.CompareTag("Player"))
        {
            Debug.Log("Emoji 接收成功！");
            Destroy(gameObject);
        }
    }
}