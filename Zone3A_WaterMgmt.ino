/*
 * Zone 3A - Water Management Node
 * ESP32 with LDR Level Sensors, TDS Sensor, Pump Control, Valve Servo
 * GPIO Pins: LDR1=35, LDR2=34, TDS=32, Pump=15, Valve Servo=23, Status LED=2
 */

#include <WiFi.h>
#include <MQTT.h>
#include <ESP32Servo.h>

// WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// ThingsBoard MQTT broker
const char* mqtt_broker = "YOUR_THINGSBOARD_HOST";
const int mqtt_port = 1883;
const char* mqtt_username = "YOUR_DEVICE_TOKEN";

// GPIO Pins
#define LDR1_PIN 35
#define LDR2_PIN 34
#define TDS_PIN 32
#define PUMP_PWM_PIN 15
#define VALVE_SERVO_PIN 23
#define STATUS_LED_PIN 2

// Servo for valve control
Servo valveServo;

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// Thresholds
const int WATER_LEVEL_THRESHOLD = 40;
const int TDS_ALERT_THRESHOLD = 130;

// State tracking
int waterLevel = 65;
int waterLevelSecondary = 60;
int tds = 110;
int pumpSpeed = 0;
bool pumpActive = false;
int valveServoAngle = 0;
bool valveOpen = false;
bool statusLed = false;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  
  // Set PWM for pump
  ledcSetup(0, 5000, 8);
  ledcAttachPin(PUMP_PWM_PIN, 0);
  
  // Initialize servo
  valveServo.setPeriodHertz(50);
  valveServo.attach(VALVE_SERVO_PIN, 1000, 2000);
  valveServo.write(0);
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  client.begin(mqtt_broker, mqtt_port, espClient);
  client.onMessage(messageReceived);
}

void loop() {
  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  
  // Maintain MQTT connection
  if (!client.connected()) {
    connectToMQTT();
  }
  client.loop();
  
  // Read sensors every 2.5 seconds
  static unsigned long lastReadTime = 0;
  if (millis() - lastReadTime >= 2500) {
    lastReadTime = millis();
    
    // Read LDR1 and LDR2 (0-4095 ADC, convert to 0-100%)
    int ldr1ADC = analogRead(LDR1_PIN);
    int ldr2ADC = analogRead(LDR2_PIN);
    waterLevel = map(ldr1ADC, 0, 4095, 0, 100);
    waterLevelSecondary = map(ldr2ADC, 0, 4095, 0, 100);
    
    // Read TDS (0-4095 ADC, convert to 0-1000 ppm approx)
    int tdsADC = analogRead(TDS_PIN);
    tds = map(tdsADC, 0, 4095, 0, 1000);
    
    // Auto-control logic: Activate pump and open valve if water level < 40%
    if (waterLevel < WATER_LEVEL_THRESHOLD) {
      pumpActive = true;
      pumpSpeed = 90;
      ledcWrite(0, (pumpSpeed * 255) / 100);
      valveOpen = true;
      valveServoAngle = 90;
      valveServo.write(valveServoAngle);
      statusLed = true;
    } else if (waterLevel > WATER_LEVEL_THRESHOLD + 5) {
      pumpActive = false;
      pumpSpeed = 0;
      ledcWrite(0, 0);
      valveOpen = false;
      valveServoAngle = 0;
      valveServo.write(valveServoAngle);
      statusLed = false;
    }
    
    // Alert if TDS is too high
    if (tds > TDS_ALERT_THRESHOLD) {
      statusLed = true;
    }
    
    // Update status LED
    digitalWrite(STATUS_LED_PIN, statusLed ? HIGH : LOW);
    
    // Publish telemetry
    publishTelemetry();
  }
  
  delay(100);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
  }
}

void connectToMQTT() {
  Serial.print("Connecting to MQTT as Zone3A...");
  
  if (client.connect("Zone3A", mqtt_username, "")) {
    Serial.println("connected!");
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

void publishTelemetry() {
  String payload = "{";
  payload += "\"waterLevel\":" + String(waterLevel);
  payload += ",\"waterLevelSecondary\":" + String(waterLevelSecondary);
  payload += ",\"tds\":" + String(tds);
  payload += ",\"pumpSpeed\":" + String(pumpSpeed);
  payload += ",\"pumpActive\":" + String(pumpActive ? "true" : "false");
  payload += ",\"valveServoAngle\":" + String(valveServoAngle);
  payload += ",\"valveOpen\":" + String(valveOpen ? "true" : "false");
  payload += ",\"statusLed\":" + String(statusLed ? "true" : "false");
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setPump") != -1) {
      pumpActive = payload.indexOf("true") != -1;
      pumpSpeed = pumpActive ? 90 : 0;
      ledcWrite(0, (pumpSpeed * 255) / 100);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
    
    if (payload.indexOf("setValve") != -1) {
      valveOpen = payload.indexOf("true") != -1;
      valveServoAngle = valveOpen ? 90 : 0;
      valveServo.write(valveServoAngle);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}
