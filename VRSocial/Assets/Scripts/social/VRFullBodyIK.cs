using UnityEngine;

public class VRFullBodyIK : MonoBehaviour
{
    [Header("Avatar")]
    public Animator animator;                  // Avatar上的Animator

    [Header("BuildingBlock Camera Rig")]
    public Transform cameraRig;                // [BuildingBlock] Camera Rig
    public Transform centerEyeAnchor;          // TrackingSpace/CenterEyeAnchor
    public Transform leftHandAnchor;            // TrackingSpace/LeftHandAnchor/[BuildingBlock] Hand Tracking left
    public Transform rightHandAnchor;           // TrackingSpace/RightHandAnchor/[BuildingBlock] Hand Tracking right

    private bool aligned = false;

    void Start()
    {
        if (!animator) animator = GetComponent<Animator>();
    }

    void Update()
    {
        // 只在第一次Update时做对齐
        if (!aligned && animator && centerEyeAnchor && cameraRig)
        {
            Transform headBone = animator.GetBoneTransform(HumanBodyBones.Head);
            if (headBone)
            {
                Vector3 offset = headBone.position - centerEyeAnchor.position;
                cameraRig.position += offset;
                aligned = true;
            }
        }
    }

    void OnAnimatorIK(int layerIndex)
    {
        if (animator == null) return;

        // 头部朝向
        if (centerEyeAnchor)
        {
            animator.SetLookAtWeight(1.0f);
            animator.SetLookAtPosition(centerEyeAnchor.position);
        }

        // 左手
        if (leftHandAnchor)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.LeftHand, 1.0f);
            animator.SetIKRotationWeight(AvatarIKGoal.LeftHand, 1.0f);
            animator.SetIKPosition(AvatarIKGoal.LeftHand, leftHandAnchor.position);
            animator.SetIKRotation(AvatarIKGoal.LeftHand, leftHandAnchor.rotation);
        }

        // 右手
        if (rightHandAnchor)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.RightHand, 1.0f);
            animator.SetIKRotationWeight(AvatarIKGoal.RightHand, 1.0f);
            animator.SetIKPosition(AvatarIKGoal.RightHand, rightHandAnchor.position);
            animator.SetIKRotation(AvatarIKGoal.RightHand, rightHandAnchor.rotation);
        }
    }
}
