using UnityEngine;

public class VRAvatarIK : MonoBehaviour
{
    public Animator animator;
    public Transform headTarget;
    public Transform leftHandTarget;
    public Transform rightHandTarget;

    void OnAnimatorIK(int layerIndex)
    {
        if (animator == null) return;

        // 头部朝向
        animator.SetLookAtWeight(1.0f);
        animator.SetLookAtPosition(headTarget.position);

        // 左手
        animator.SetIKPositionWeight(AvatarIKGoal.LeftHand, 1.0f);
        animator.SetIKRotationWeight(AvatarIKGoal.LeftHand, 1.0f);
        animator.SetIKPosition(AvatarIKGoal.LeftHand, leftHandTarget.position);
        animator.SetIKRotation(AvatarIKGoal.LeftHand, leftHandTarget.rotation);

        // 右手
        animator.SetIKPositionWeight(AvatarIKGoal.RightHand, 1.0f);
        animator.SetIKRotationWeight(AvatarIKGoal.RightHand, 1.0f);
        animator.SetIKPosition(AvatarIKGoal.RightHand, rightHandTarget.position);
        animator.SetIKRotation(AvatarIKGoal.RightHand, rightHandTarget.rotation);
    }
}