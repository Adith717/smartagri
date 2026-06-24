/*
 * Zone 1B - Dashboard & Protection Node
 * ESP32 with Touch Sensor, PIR, Rain Detector, Roof Servo
 * GPIO Pins: Touch=4, PIR=18, Rain=34, Servo=23
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
#define TOUCH_PIN 4
#define PIR_PIN 18
#define RAIN_ADC_PIN 34
#define SERVO_PIN 23

// Servo for roof control
Servo roofServo;

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// Thresholds
const int RAIN_THRESHOLD = 70;

// State tracking
bool touchDetected = false;
bool pirMotionDetected = false;
int rainLevel = 0;
int roofServoAngle = 0;
bool roofOpen = false;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(TOUCH_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);
  
  // Initialize servo
  roofServo.setPeriodHertz(50);
  roofServo.attach(SERVO_PIN, 1000, 2000);
  roofServo.write(0);
  
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
    
    // Read touch sensor
    touchDetected = digitalRead(TOUCH_PIN) == HIGH;
    
    // Read PIR motion sensor
    pirMotionDetected = digitalRead(PIR_PIN) == HIGH;
    
    // Read rain level (0-4095 ADC, convert to 0-100%)
    int rainADC = analogRead(RAIN_ADC_PIN);
    rainLevel = map(rainADC, 0, 4095, 0, 100);
    
    // Auto-control logic: Open roof if rain > 70%
    if (rainLevel > RAIN_THRESHOLD) {
      roofOpen = true;
      roofServoAngle = 90;
      roofServo.write(roofServoAngle);
    } else if (rainLevel < RAIN_THRESHOLD - 10) {
      roofOpen = false;
      roofServoAngle = 0;
      roofServo.write(roofServoAngle);
    }
    
    // Publish telemetry to ThingsBoard
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
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi");
  }
}

void connectToMQTT() {
  Serial.print("Connecting to MQTT as Zone1B...");
  
  if (client.connect("Zone1B", mqtt_username, "")) {
    Serial.println("connected!");
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

void publishTelemetry() {
  String payload = "{";
  payload += "\"touchDetected\":" + String(touchDetected ? "true" : "false");
  payload += ",\"pirMotionDetected\":" + String(pirMotionDetected ? "true" : "false");
  payload += ",\"rainLevel\":" + String(rainLevel);
  payload += ",\"roofServoAngle\":" + String(roofServoAngle);
  payload += ",\"roofOpen\":" + String(roofOpen ? "true" : "false");
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  // Handle RPC requests for manual roof control
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setRoof") != -1) {
      // Parse angle from payload
      int angle = 0;
      if (payload.indexOf("90") != -1) {
        angle = 90;
        roofOpen = true;
      } else {
        angle = 0;
        roofOpen = false;
      }
      roofServoAngle = angle;
      roofServo.write(roofServoAngle);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}
