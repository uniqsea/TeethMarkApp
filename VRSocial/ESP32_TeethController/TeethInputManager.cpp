/*
 * 牙套按钮输入管理器实现
 */

#include "TeethInputManager.h"

void TeethInputManager::init(const std::vector<int>& buttonPins) {
  Serial.println("初始化按钮输入管理器...");
  
  buttons.clear();
  for (int pin : buttonPins) {
    ButtonState btn;
    btn.pin = pin;
    btn.currentState = false;
    btn.lastState = false;
    btn.pressStartTime = 0;
    btn.lastChangeTime = 0;
    btn.isPressed = false;
    
    pinMode(pin, INPUT_PULLUP); // 使用内部上拉电阻
    buttons.push_back(btn);
    
    Serial.printf("按钮引脚 %d 初始化完成\n", pin);
  }
  
  resetGesture();
  Serial.printf("按钮管理器初始化完成，共 %d 个按钮\n", buttons.size());
}

TeethInput TeethInputManager::checkInput() {
  updateButtonStates();
  return analyzeGesture();
}

void TeethInputManager::updateButtonStates() {
  unsigned long now = millis();
  
  for (auto& btn : buttons) {
    bool reading = !digitalRead(btn.pin); // 反转读取（按下为HIGH）
    
    // 去抖动处理
    if (reading != btn.lastState) {
      btn.lastChangeTime = now;
    }
    
    if ((now - btn.lastChangeTime) > DEBOUNCE_TIME) {
      if (reading != btn.currentState) {
        btn.currentState = reading;
        
        if (reading) { // 按下
          btn.pressStartTime = now;
          btn.isPressed = true;
          
          // 添加到当前手势序列
          currentGesture.push_back(btn.pin);
          lastButtonTime = now;
          
          if (!gestureActive) {
            gestureStartTime = now;
            gestureActive = true;
          }
          
          Serial.printf("按钮 %d 按下\n", btn.pin);
          
        } else { // 松开
          btn.isPressed = false;
          Serial.printf("按钮 %d 松开，持续时间: %lums\n", 
                       btn.pin, now - btn.pressStartTime);
        }
      }
    }
    
    btn.lastState = reading;
  }
}

TeethInput TeethInputManager::analyzeGesture() {
  TeethInput result;
  unsigned long now = millis();
  
  // 检查手势是否完成
  bool anyPressed = false;
  for (const auto& btn : buttons) {
    if (btn.isPressed) {
      anyPressed = true;
      break;
    }
  }
  
  // 如果没有按钮被按下，且距离最后一次按钮操作超过阈值，则分析手势
  if (!anyPressed && gestureActive && 
      (now - lastButtonTime) > MULTI_PRESS_WINDOW) {
    
    if (!currentGesture.empty()) {
      unsigned long totalDuration = now - gestureStartTime;
      result.isValid = true;
      result.gesture = getGestureType(currentGesture, totalDuration);
      result.duration = totalDuration / 1000.0; // 转换为秒
      
      // 去重并排序牙齿序列
      std::vector<int> uniqueTeeth = currentGesture;
      std::sort(uniqueTeeth.begin(), uniqueTeeth.end());
      uniqueTeeth.erase(std::unique(uniqueTeeth.begin(), uniqueTeeth.end()), 
                       uniqueTeeth.end());
      result.teeth = uniqueTeeth;
      
      Serial.printf("手势识别: %s, 牙齿: ", result.gesture.c_str());
      for (int tooth : result.teeth) {
        Serial.printf("%d ", tooth);
      }
      Serial.printf("持续时间: %.2fs\n", result.duration);
    }
    
    resetGesture();
  }
  
  return result;
}

String TeethInputManager::getGestureType(const std::vector<int>& sequence, 
                                        unsigned long duration) {
  if (sequence.empty()) return "unknown";
  
  // 获取唯一按钮数量
  std::vector<int> uniqueButtons = sequence;
  std::sort(uniqueButtons.begin(), uniqueButtons.end());
  uniqueButtons.erase(std::unique(uniqueButtons.begin(), uniqueButtons.end()), 
                     uniqueButtons.end());
  
  int uniqueCount = uniqueButtons.size();
  int totalPresses = sequence.size();
  
  // 手势分类逻辑
  if (uniqueCount == 1) {
    if (duration > LONG_PRESS_TIME) {
      return "long_press";
    } else if (totalPresses > 1) {
      return "multi_press";
    } else {
      return "single_click";
    }
  } else if (uniqueCount > 1) {
    // 检查是否为滑动手势
    bool isSlide = true;
    for (int i = 1; i < sequence.size(); i++) {
      if (abs(sequence[i] - sequence[i-1]) != 1) {
        isSlide = false;
        break;
      }
    }
    
    if (isSlide && duration < SLIDE_MAX_INTERVAL * uniqueCount) {
      return "slide";
    } else {
      return "multi_press";
    }
  }
  
  return "unknown";
}

void TeethInputManager::resetGesture() {
  currentGesture.clear();
  gestureStartTime = 0;
  lastButtonTime = 0;
  gestureActive = false;
}

void TeethInputManager::debugPrintButtonStates() {
  Serial.print("按钮状态: ");
  for (const auto& btn : buttons) {
    Serial.printf("%d:%s ", btn.pin, btn.isPressed ? "ON" : "OFF");
  }
  Serial.println();
}