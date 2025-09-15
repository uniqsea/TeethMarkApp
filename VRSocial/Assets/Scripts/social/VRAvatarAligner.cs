using UnityEngine;

public class VRAvatarAligner : MonoBehaviour
{
    public Transform cameraRig;          // [BuildingBlock] Camera Rig
    public Transform centerEyeAnchor;    // TrackingSpace/CenterEyeAnchor
    public Transform headBone;           // 手动指定 Armature/.../Head
    public float forwardDistance = 0.5f; // 想离头多远（米）

    void Start()
    {
        if (!headBone || !cameraRig || !centerEyeAnchor) return;

        // ① 平移 CameraRig 到头骨位置
        Vector3 offset = headBone.position - centerEyeAnchor.position;
        cameraRig.position += offset;

        // ② 沿头部朝前方向推出去一段
        cameraRig.position += headBone.forward * forwardDistance;
    }
}