// LaserController.cs
using UnityEngine;

public class LaserController : MonoBehaviour
{
    public LineRenderer line;
    public Transform startPoint;
    public Transform endPoint;

    void Update()
    {
        line.SetPosition(0, startPoint.position);
        line.SetPosition(1, endPoint.position);
    }
}