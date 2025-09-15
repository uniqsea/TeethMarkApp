using UnityEngine;

public class AvatarController : MonoBehaviour
{
    [Header("VR Tracking")]
    public Transform vrHead;  // CenterEyeAnchor / Main Camera

    // [Header("Avatar Position")]
    // public Transform avatarPosition;
    
    [Header("Position Settings")]
    public Vector3 positionOffset = new Vector3(0, -1.5f, 3f);  // 相对头部的偏移：前方1.5米，下降1.6米
    
    [Header("Size-based Offset")]
    public bool useSizeBasedOffset = false;            // 是否基于角色尺寸调整偏移
    public Vector3 sizeMultiplier = Vector3.zero;      // 尺寸影响系数：x*width, y*height, z*depth
    
    [Header("Rotation Settings")]
    public bool followHeadRotation = true;  // 是否跟随头部旋转

    void LateUpdate()
    {

        // 获取模型整体的包围盒
        Bounds bounds = GetComponentInChildren<Renderer>().bounds;

        // 高度
        float height = bounds.size.y;

        // 宽度（左右跨度）
        float width = bounds.size.x;

        // 深度（前后跨度）
        float depth = bounds.size.z;

        if (vrHead == null) return;

        // 位置跟随：头部位置 + 基于头部朝向的偏移
        Vector3 headForward = new Vector3(vrHead.forward.x, 0, vrHead.forward.z).normalized;
        Vector3 headRight = new Vector3(vrHead.right.x, 0, vrHead.right.z).normalized;
        
        // 计算本地空间的最终偏移（基于手动偏移 + 尺寸偏移）
        Vector3 sizeOffsetLocal = useSizeBasedOffset
            ? new Vector3(width * sizeMultiplier.x, height * sizeMultiplier.y, depth * sizeMultiplier.z)
            : Vector3.zero;

        Vector3 finalLocalOffset = positionOffset + sizeOffsetLocal;

        // 将本地偏移映射到世界空间（基于头部的前/右/上方向）
        Vector3 worldOffset = headRight * finalLocalOffset.x +        // 左右偏移
                             Vector3.up * finalLocalOffset.y +        // 上下偏移  
                             headForward * finalLocalOffset.z;        // 前后偏移
        
        transform.position = vrHead.position + worldOffset;

        Debug.Log("height: " + height);
        Debug.Log("width: " + width);
        Debug.Log("depth: " + depth);
        
        // 旋转跟随：只取头部Y轴旋转（水平朝向）
        if (followHeadRotation)
        {
            transform.rotation = Quaternion.Euler(0, vrHead.eulerAngles.y, 0);
        }
    }
}