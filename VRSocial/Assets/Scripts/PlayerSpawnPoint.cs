using UnityEngine;
//把这个脚本挂到场景里的一个管理对象，比如 GameManager 或直接挂在 PlayerSpawnPoint 上都行。在 Inspector 里把字段拖进去：
// CameraRig → [BuildingBlock] Camera Rig
// SpawnPoint → PlayerSpawnPoint（你刚建的空物体）
public class PlayerSpawner : MonoBehaviour
{
    [Header("Player Spawn Settings")]
    public Transform cameraRig;      // [BuildingBlock] Camera Rig
    public Transform spawnPoint;     // 新建的 PlayerSpawnPoint 空物体

    void Start()
    {
        if (!cameraRig || !spawnPoint) return;

        // 将 Camera Rig 移动到出生点位置和旋转
        cameraRig.position = spawnPoint.position;
        cameraRig.rotation = spawnPoint.rotation;
    }
}