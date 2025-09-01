#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

// BLE UUID - 与应用程序同步
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_RX   "12345678-1234-5678-1234-56789abcdef1"  // App 写入到ESP32
#define CHARACTERISTIC_TX   "12345678-1234-5678-1234-56789abcdef2"  // ESP32 通知到App

BLECharacteristic* txCharacteristic;
String rxBuffer;
String serialBuffer;

// ---------- 发 JSON ----------
void sendGesture(const char* type, const int* teeth, size_t n, int duration) {
  StaticJsonDocument<256> doc;
  doc["gesture"] = type;
  JsonArray arr = doc.createNestedArray("Teeth");
  for (size_t i = 0; i < n; i++) arr.add(teeth[i]);
  doc["Duration"] = duration;

  String out;
  serializeJson(doc, out);
  out += "\n";

  txCharacteristic->setValue(out.c_str());
  txCharacteristic->notify();

  Serial.print("TX: ");
  Serial.println(out);
}

// ---------- 处理 App 回复 ----------
void handleLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) {
    Serial.print("JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  const char* info = doc["info"] | "";
  const char* output_mode = doc["output_mode"] | "";

  Serial.println("RX from App:");
  Serial.printf("  info = %s\n", info);
  Serial.printf("  output_mode = %s\n", output_mode);
}

// ---------- BLE RX ----------
class RxCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    String value = pCharacteristic->getValue().c_str();

    Serial.print("Raw RX: ");
    Serial.println(value);

    // rxBuffer += value;
    // int pos;
    // while ((pos = rxBuffer.indexOf('\n')) != -1) {
    //   String line = rxBuffer.substring(0, pos);
    //   handleLine(line);
    //   rxBuffer.remove(0, pos + 1);
    // }
    handleLine(value);
  }
};



// ---------- 串口命令 ----------
void handleSerialCommand(String cmd) {
  cmd.trim();
  if (cmd == "single click") {
    int teeth[1] = {2};
    sendGesture("single_click", teeth, 1, 150);
  } else if (cmd == "slide left") {
    int teeth[3] = {3, 2, 1};
    sendGesture("slide_left", teeth, 3, 600);
  } else if(cmd == "slide right") {
    int teeth[3] = {1, 2, 3};
    sendGesture("slide_right", teeth, 3, 600);
  } else if (cmd == "multi press") {
    int teeth[3] = {1, 2, 3};
    sendGesture("multi_press", teeth, 3, 300);
  } else {
    Serial.println("Commands: single click | slide left | slide right | multi press");
  }
}

// ---------- setup ----------
void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 BLE JSON Gesture Test Starting...");

  BLEDevice::init("TeethMark");
  BLEServer* pServer = BLEDevice::createServer();
  BLEService* pService = pServer->createService(SERVICE_UUID);

  // TX
  txCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txCharacteristic->addDescriptor(new BLE2902());

  // RX
  BLECharacteristic* rxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_RX,
    BLECharacteristic::PROPERTY_WRITE
  );
  rxCharacteristic->setCallbacks(new RxCallback());

  pService->start();
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);    // 开启扫描响应包
  pAdvertising->setMinPreferred(0x06);    // iOS 兼容参数
  pAdvertising->setMinPreferred(0x12);    // iOS 兼容参数
  pAdvertising->start();

  Serial.println("BLE ready as 'TeethMark'");
  Serial.println("Type in Serial: single click | slide left | slide right | multi press");
}

// ---------- loop ----------
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        handleSerialCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      serialBuffer += c;
    }
  }
}