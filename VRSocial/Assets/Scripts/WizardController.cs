using UnityEngine;

public class WizardController : MonoBehaviour
{
    [Header("VR Tracking")]
    public Transform vrHead;  // CenterEyeAnchor / Main Camera
    
    [Header("Position Settings")]
    public Vector3 positionOffset = new Vector3(0, -1.5f, 3f);  // 相对头部的偏移：前方1.5米，下降1.6米
    
    [Header("Rotation Settings")]
    public bool followHeadRotation = true;  // 是否跟随头部旋转

    void LateUpdate()
    {
        if (vrHead == null) return;

        // 位置跟随：头部位置 + 基于头部朝向的偏移
        Vector3 headForward = new Vector3(vrHead.forward.x, 0, vrHead.forward.z).normalized;
        Vector3 headRight = new Vector3(vrHead.right.x, 0, vrHead.right.z).normalized;
        
        Vector3 worldOffset = headRight * positionOffset.x +        // 左右偏移
                             Vector3.up * positionOffset.y +        // 上下偏移  
                             headForward * positionOffset.z;        // 前后偏移
        
        transform.position = vrHead.position + worldOffset;
        
        // 旋转跟随：只取头部Y轴旋转（水平朝向）
        if (followHeadRotation)
        {
            transform.rotation = Quaternion.Euler(0, vrHead.eulerAngles.y, 0);
        }
    }
}