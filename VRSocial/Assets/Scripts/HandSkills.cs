using UnityEngine;

public class HandSkills : MonoBehaviour
{
    public OVRHand leftHand;   // 左手
    public OVRHand rightHand;  // 右手
    public GameObject firePrefab;
    public GameObject waterPrefab;
    public Transform mouthPoint;

    private GameObject fireInstance;
    private GameObject waterInstance;

    void Start()
    {
        // 预先生成火/水粒子，默认关闭
        if (firePrefab != null)
        {
            fireInstance = Instantiate(firePrefab, mouthPoint.position, mouthPoint.rotation, mouthPoint);
            fireInstance.SetActive(false);
        }

        if (waterPrefab != null)
        {
            waterInstance = Instantiate(waterPrefab, mouthPoint.position, mouthPoint.rotation, mouthPoint);
            waterInstance.SetActive(false);
        }
    }

    void Update()
    {
        // 左手食指 Pinch = 喷水
        if (leftHand != null && leftHand.GetFingerIsPinching(OVRHand.HandFinger.Index))
        {
            waterInstance.SetActive(true);
        }
        else
        {
            waterInstance.SetActive(false);
        }

        // 右手食指 Pinch = 喷火
        if (rightHand != null && rightHand.GetFingerIsPinching(OVRHand.HandFinger.Index))
        {
            fireInstance.SetActive(true);
        }
        else
        {
            fireInstance.SetActive(false);
        }
    }
}