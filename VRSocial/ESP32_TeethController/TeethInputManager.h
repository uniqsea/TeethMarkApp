/*
 * 牙套按钮输入管理器
 * 负责检测按钮状态，识别手势类型
 */

#ifndef TEETH_INPUT_MANAGER_H
#define TEETH_INPUT_MANAGER_H

#include <Arduino.h>
#include <vector>

// 按钮状态结构
struct ButtonState {
  int pin;
  bool currentState;
  bool lastState;
  unsigned long pressStartTime;
  unsigned long lastChangeTime;
  bool isPressed;
};

// 牙套输入结构
struct TeethInput {
  bool isValid;
  String gesture;           // "single_click", "long_press", "multi_press", "slide"
  std::vector<int> teeth;   // 按钮编号数组
  float duration;           // 持续时间(秒)
  
  TeethInput() : isValid(false), duration(0) {}
};

class TeethInputManager {
private:
  std::vector<ButtonState> buttons;
  
  // 手势识别参数
  const unsigned long DEBOUNCE_TIME = 50;    // 去抖动时间(ms)
  const unsigned long LONG_PRESS_TIME = 800; // 长按阈值(ms)
  const unsigned long SLIDE_MAX_INTERVAL = 300; // 滑动最大间隔(ms)
  const unsigned long MULTI_PRESS_WINDOW = 500;  // 多按窗口时间(ms)
  
  // 手势检测状态
  std::vector<int> currentGesture;
  unsigned long gestureStartTime;
  unsigned long lastButtonTime;
  bool gestureActive;
  
public:
  void init(const std::vector<int>& buttonPins);
  TeethInput checkInput();
  
private:
  void updateButtonStates();
  TeethInput analyzeGesture();
  String getGestureType(const std::vector<int>& sequence, unsigned long duration);
  void resetGesture();
  void debugPrintButtonStates();
};

#endif