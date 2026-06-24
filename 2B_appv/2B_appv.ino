#include <WiFi.h>
#include <esp_now.h>
#include <ArduinoMqttClient.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <SPI.h>
#include <HX711.h>
#include <ESP32Servo.h>
#include <U8g2lib.h>
#include "SmartAgriProtocol.h" // Protocol Dependency

#define TRIG_PIN 5
#define ECHO_PIN 18
#define LDR_PIN 34
#define HX_DT 32
#define HX_SCK 4
#define MOTOR_PIN 27
#define LED_PIN 23
#define SERVO_PIN 19
#define OLED_SDA 21
#define OLED_SCL 22

const char* WIFI_SSID = "Poyi Recharge Cheyyada";
const char* WIFI_PASS = "mmokedaa";
const char* TB_SERVER = "mqtt.thingsboard.cloud";
const int TB_PORT = 1883;
const char* TB_TOKEN = "Yl7P3jRo2vJI2z7ZAGxH";

WiFiClient wifiClient;
MqttClient mqttClient(wifiClient);

// Target Node 2A MAC Configuration
static const uint8_t NODE2A_MAC[6] = { 0xB4, 0xBF, 0xE9, 0x0D, 0xB8, 0x18 };

static const int DARK_THRESHOLD = 1700;
static const int WATER_LOW_DISTANCE_CM = 20;
static const int FEED_SERVO_OPEN = 90;
static const int FEED_SERVO_CLOSED = 0;

HX711 scale;
Servo feedServo;
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

uint32_t seqNo = 0;
bool autoMode = true;
uint8_t manualFanPercent = 0;
uint8_t actualFanPercent = 0;

int16_t remoteTempCx10 = INT16_MIN;
float remoteHumidity = NAN;
char remoteRFID[18] = "NO CARD";
bool remoteDataKnown = false;

int32_t feedThresholdRaw = 1000;
int16_t distanceCm = -1;
uint16_t ldrRaw = 0;
int32_t weightRaw = 0;
uint8_t servoAngle = FEED_SERVO_CLOSED;
int8_t ledManual = -1;
uint32_t alertFlags = 0;
unsigned long lastPacketMillis = 0;
bool commOk = false;

void updateDisplay() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  u8g2.drawStr(0, 10, "ZONE 2B STATUS");
  char line[32];
  sprintf(line, "Water:%d cm", distanceCm);
  u8g2.drawStr(0, 22, line);

  sprintf(line, "Feed:%ld", weightRaw);
  u8g2.drawStr(0, 34, line);

  float tempC = unpackFloat10(remoteTempCx10);
  if(isnan(tempC)) u8g2.drawStr(0, 46, "Temp:NO DATA");
  else {
    sprintf(line, "Temp:%.1f C", tempC);
    u8g2.drawStr(0, 46, line);
  }

  sprintf(line, "Fan:%d%%", actualFanPercent);
  u8g2.drawStr(0, 58, line);

  if(commOk) u8g2.drawStr(70, 58, "COMM OK");
  else u8g2.drawStr(55, 58, "COMM LOST");
  u8g2.sendBuffer();
}

void addBroadcastPeer() {
  if(esp_now_is_peer_exist(NODE2A_MAC)) return;
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, NODE2A_MAC, 6);
  peer.channel = 0; 
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

void applyFan(uint8_t percent) {
  percent = constrain(percent, 0, 100);
  actualFanPercent = percent;
  ledcWrite(MOTOR_PIN, map(percent, 0, 100, 0, 255)); // Hardware PWM conversion map
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if(duration == 0) return -1;
  return (long)(duration * 0.0343f / 2.0f);
}

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  lastPacketMillis = millis();
  commOk = true;
  
  if(isValidTelemetry(data, len)) {
    TelemetryPacket p;
    memcpy(&p, data, sizeof(p));
    if(p.nodeId == NODE_ZONE2A_CATTLE_MONITOR) {
        remoteTempCx10 = p.temperatureCx10;
        remoteHumidity = unpackFloat10(p.humidityx10);
        remoteDataKnown = true;
        strncpy(remoteRFID, p.rfid, sizeof(remoteRFID)-1);
        remoteRFID[sizeof(remoteRFID)-1] = '\0';
    }
    return;
  }

  if(!isValidCommand(data, len)) return;
  CommandPacket cmd;
  memcpy(&cmd, data, sizeof(cmd));

  if(cmd.targetNode != NODE_ZONE2B_CATTLE_RESOURCES && cmd.targetNode != NODE_BROADCAST) return;

  if(cmd.commandId == CMD_SET_AUTO) autoMode = cmd.value != 0;
  else if(cmd.commandId == CMD_SET_MOTOR_PERCENT || cmd.commandId == CMD_SET_FAN_PERCENT) {
    manualFanPercent = constrain(cmd.value, 0, 100);
    if(!autoMode) applyFan(manualFanPercent);
  }
  else if(cmd.commandId == CMD_SET_SERVO_ANGLE) {
    autoMode = false;
    servoAngle = constrain(cmd.value, 0, 180);
    feedServo.write(servoAngle);
  }
  else if(cmd.commandId == CMD_SET_LED_MODE) ledManual = cmd.value ? 1 : 0;
  else if(cmd.commandId == CMD_SYNC_TEMPERATURE_X10) remoteTempCx10 = cmd.value;
  else if(cmd.commandId == CMD_SET_FEED_THRESHOLD) feedThresholdRaw = max(0, (int)cmd.value);
  else if(cmd.commandId == CMD_ALL_OFF) {
    autoMode = false;
    applyFan(0);
    ledManual = 0;
    digitalWrite(LED_PIN, LOW);
  }
  updateDisplay();
}

void sampleSensors() {
  distanceCm = readDistanceCm();
  ldrRaw = analogRead(LDR_PIN);
  if(scale.is_ready()) weightRaw = scale.read();
}

// Automation Logic: Controls automated security lights, feed gates, and thermal fan profiles
void runAutomation() {
  alertFlags = 0;
  if(distanceCm < 0) alertFlags |= ALERT_SENSOR_FAULT;
  if(distanceCm > WATER_LOW_DISTANCE_CM) alertFlags |= ALERT_LOW_WATER;
  if(weightRaw < feedThresholdRaw) alertFlags |= ALERT_LOW_FEED;
  if(!autoMode) alertFlags |= ALERT_MANUAL_MODE;

  // Perimeter Light Automation
  bool lightOn = false;
  if(ledManual >= 0) lightOn = ledManual == 1;
  else lightOn = ldrRaw < DARK_THRESHOLD; // Turn illumination array ON during dark conditions
  digitalWrite(LED_PIN, lightOn ? HIGH : LOW);

  if(autoMode) {
    // Feed Gate Automation
    servoAngle = (weightRaw < feedThresholdRaw) ? FEED_SERVO_OPEN : FEED_SERVO_CLOSED;
    feedServo.write(servoAngle);

    // Multi-Stage Multi-Variable Linear Thermal Fan Speed Core Mapping
    float tempC = unpackFloat10(remoteTempCx10);
    if(!isnan(tempC)) {
      if(tempC < 27) applyFan(0);
      else if(tempC < 29) applyFan(40);
      else if(tempC < 31) applyFan(60);
      else if(tempC < 33) applyFan(80);
      else applyFan(100); // Deploy full ventilation capacity above 33°C
    }
  }
}

void sendTelemetry() {
  TelemetryPacket p;
  initTelemetry(p, NODE_ZONE2B_CATTLE_RESOURCES, ++seqNo);
  p.distanceCm = distanceCm;
  p.ldr1 = ldrRaw;
  p.weightRaw = weightRaw;
  p.servoAngle = servoAngle;
  p.motorPercent = actualFanPercent;
  p.ledState = digitalRead(LED_PIN);
  p.autoMode = autoMode;
  p.alertFlags = alertFlags;

  esp_now_send(NODE2A_MAC, reinterpret_cast<uint8_t*>(&p), sizeof(p));
}

void sendToThingsBoard() {
  String payload = "{";
  payload += "\"feedWeight\":" + String(weightRaw);
  payload += ",\"feedLevel\":" + String(distanceCm);
  payload += ",\"ldrValue\":" + String(ldrRaw);
  payload += ",\"fanPercent\":" + String(actualFanPercent);
  payload += ",\"servoAngle\":" + String(servoAngle);
  payload += ",\"autoMode\":" + String(autoMode);
  payload += ",\"alertFlags\":" + String(alertFlags);
  payload += ",\"temperature\":" + String(unpackFloat10(remoteTempCx10));
  payload += ",\"humidity\":" + String(remoteHumidity);
  payload += ",\"rfid\":\"" + String(remoteRFID) + "\"";
  payload += ",\"remoteKnown\":" + String(remoteDataKnown);
  payload += "}";
  
  mqttClient.beginMessage("v1/devices/me/telemetry");
  mqttClient.print(payload);
  mqttClient.endMessage();
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  ledcAttach(MOTOR_PIN, 1000, 8); 
  applyFan(0);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  feedServo.setPeriodHertz(50);
  feedServo.attach(SERVO_PIN, 500, 2400);
  feedServo.write(FEED_SERVO_CLOSED);
  scale.begin(HX_DT, HX_SCK);

  Wire.begin(OLED_SDA, OLED_SCL);
  u8g2.begin();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  mqttClient.setUsernamePassword(TB_TOKEN, "");

  if(esp_now_init() != ESP_OK) return;
  addBroadcastPeer();
  esp_now_register_recv_cb(onDataRecv);
}

void loop() {
  mqttClient.poll(); // Keep MQTT connections alive in a non-blocking execution cycle

  if(millis() - lastPacketMillis > 10000) {
      commOk = false;
      remoteDataKnown = false;
  }

  static unsigned long lastSample = 0;
  if(millis() - lastSample >= 1000) {
    lastSample = millis();
    sampleSensors();
    runAutomation();
    updateDisplay();
    sendTelemetry();
  }

  static unsigned long lastTB = 0;
  if(millis() - lastTB >= 5000) {
    lastTB = millis();
    if(!mqttClient.connected()) {
      Serial.println("Attempting TB Connect...");
      mqttClient.connect(TB_SERVER, TB_PORT);
    }
    if(mqttClient.connected()) {
      sendToThingsBoard();
    }
  }
}