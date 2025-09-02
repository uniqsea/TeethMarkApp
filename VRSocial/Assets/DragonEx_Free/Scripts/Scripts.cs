using UnityEngine;
using System.Collections;
using TMPro;

namespace Ex
{
    public class Scripts : MonoBehaviour
    {
        public GameObject attackEffect;
        public Animator animator;
        public TextMeshProUGUI text;
        private void Start()
        {
            StartCoroutine(PlayAnimationSequence());
        }
        private IEnumerator PlayAnimationSequence()
        {

            yield return new WaitForSeconds(10f);
            
            if(text != null){
                text.text = "Move";
            }
            animator.SetBool("isRunning", true);
            
            yield return new WaitForSeconds(5f);
            
            animator.SetBool("isRunning", false);
            
            yield return new WaitForSeconds(1f);
            if(text != null){
                text.text = "Attack1";
            }
            animator.SetTrigger("Attack1");
            yield return new WaitForSeconds(5f);
            if(text != null){ 
                text.text = "Attack2";
            }
            attackEffect.SetActive(false);
            animator.SetTrigger("Attack2");
            
            yield return new WaitForSeconds(5f); 
            if(text != null){
                text.text = "Hurt";
            }
            attackEffect.SetActive(false);
            animator.SetTrigger("isHurt");
            yield return new WaitForSeconds(5f); 
            animator.SetTrigger("isHurt");
            if(text != null){
                text.text = "Abnormal";
            }
            animator.SetBool("Abnormal", true);
            yield return new WaitForSeconds(5f);
                                                
            if(text != null){                                     
                text.text = "Die";
            }
            animator.SetTrigger("isDie");

        }
        public void ActivateAttackEffect1()
        {
            attackEffect.SetActive(true);
        }
        public void ActivateAttackEffect2()
        {
            attackEffect.SetActive(true);
        }
        public void DieFinish()
        {
            Destroy(gameObject);
        }
    }
}
