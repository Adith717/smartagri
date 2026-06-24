/*
 * Zone 2B - Cattle Resources Node
 * ESP32 with Ultrasonic Level, LDR, HX711 Load Cell, Fan Control, Lighting Servo
 * GPIO Pins: Ultrasonic_TRIG=5, Ultrasonic_ECHO=18, LDR=34, HX711_DT=32, HX711_SCK=4
 * Fan=27, Light LED=23, Feed Servo=19
 */

#include <WiFi.h>
#include <MQTT.h>
#include <ESP32Servo.h>
#include <HX711.h>

// WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// ThingsBoard MQTT broker
const char* mqtt_broker = "YOUR_THINGSBOARD_HOST";
const int mqtt_port = 1883;
const char* mqtt_username = "YOUR_DEVICE_TOKEN";

// GPIO Pins
#define ULTRASONIC_TRIG 5
#define ULTRASONIC_ECHO 18
#define LDR_PIN 34
#define HX711_DT 32
#define HX711_SCK 4
#define FAN_PWM_PIN 27
#define LIGHT_LED_PIN 23
#define SERVO_PIN 19

// Servo for feed dispenser
Servo feedServo;

// Load cell (HX711)
HX711 scale;

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// Thresholds
const int TEMP_THRESHOLD = 28;
const int LUX_THRESHOLD = 300;

// State tracking
int waterTroughLevel = 32;
float feedWeight = 28.0;
int lux = 720;
int fanSpeed = 30;
bool autoLightingActive = false;
int feedServoAngle = 45;
bool feedDispensed = false;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  pinMode(LIGHT_LED_PIN, OUTPUT);
  
  // Set PWM for fan
  ledcSetup(0, 5000, 8);
  ledcAttachPin(FAN_PWM_PIN, 0);
  
  // Initialize servo
  feedServo.setPeriodHertz(50);
  feedServo.attach(SERVO_PIN, 1000, 2000);
  feedServo.write(feedServoAngle);
  
  // Initialize HX711 load cell
  scale.begin(HX711_DT, HX711_SCK);
  scale.set_scale(2280.0); // Calibration factor (adjust based on your sensor)
  scale.tare();
  
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
    
    // Read ultrasonic distance
    int distance = readUltrasonic();
    waterTroughLevel = map(distance, 30, 2, 50, 10); // Convert distance to level %
    waterTroughLevel = constrain(waterTroughLevel, 10, 50);
    
    // Read load cell weight
    if (scale.is_ready()) {
      feedWeight = scale.get_units(10) / 1000.0; // Convert to kg
    }
    
    // Read LDR light level (0-4095 ADC, convert to 0-1000 lux approx)
    int luxADC = analogRead(LDR_PIN);
    lux = map(luxADC, 4095, 0, 100, 1000); // Inverted: bright=high ADC, dark=low ADC
    
    // Auto-control logic: Turn on lights if lux < 300
    autoLightingActive = lux < LUX_THRESHOLD;
    digitalWrite(LIGHT_LED_PIN, autoLightingActive ? HIGH : LOW);
    
    // Fan speed varies with temperature (simulated here at 30% base)
    fanSpeed = 30;
    ledcWrite(0, (fanSpeed * 255) / 100);
    
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
  Serial.print("Connecting to MQTT as Zone2B...");
  
  if (client.connect("Zone2B", mqtt_username, "")) {
    Serial.println("connected!");
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

int readUltrasonic() {
  // Send pulse
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  
  // Measure pulse duration
  long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);
  
  // Convert to distance (cm)
  int distance = duration * 0.034 / 2;
  
  return distance > 0 ? distance : 50;
}

void publishTelemetry() {
  String payload = "{";
  payload += "\"waterTroughLevel\":" + String(waterTroughLevel);
  payload += ",\"feedWeight\":" + String(feedWeight, 1);
  payload += ",\"lux\":" + String(lux);
  payload += ",\"fanSpeed\":" + String(fanSpeed);
  payload += ",\"autoLightingActive\":" + String(autoLightingActive ? "true" : "false");
  payload += ",\"feedServoAngle\":" + String(feedServoAngle);
  payload += ",\"feedDispensed\":" + String(feedDispensed ? "true" : "false");
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setFan") != -1) {
      fanSpeed = payload.indexOf("true") != -1 ? 75 : 30;
      ledcWrite(0, (fanSpeed * 255) / 100);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
    
    if (payload.indexOf("setLighting") != -1) {
      autoLightingActive = payload.indexOf("true") != -1;
      digitalWrite(LIGHT_LED_PIN, autoLightingActive ? HIGH : LOW);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
    
    if (payload.indexOf("setServo") != -1) {
      // Parse angle (simple parsing)
      int angle = 45;
      if (payload.indexOf("90") != -1) {
        angle = 90;
        feedDispensed = true;
      } else {
        angle = 0;
        feedDispensed = false;
      }
      feedServoAngle = angle;
      feedServo.write(feedServoAngle);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}
