/*
 * Zone 3B - Water Safety Node
 * ESP32 with DS18B20 Temp, Optical Level Sensor, I2C OLED, LED Alert, Buzzer
 * GPIO Pins: DS18B20=4, Optical Level=34, LED Alert=15, Buzzer=2
 * I2C: SDA=21, SCL=22 (for OLED)
 */

#include <WiFi.h>
#include <MQTT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

// WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// ThingsBoard MQTT broker
const char* mqtt_broker = "YOUR_THINGSBOARD_HOST";
const int mqtt_port = 1883;
const char* mqtt_username = "YOUR_DEVICE_TOKEN";

// GPIO Pins
#define ONE_WIRE_BUS 4
#define OPTICAL_LEVEL_PIN 34
#define LED_ALERT_PIN 15
#define BUZZER_PIN 2

// I2C pins
#define SDA_PIN 21
#define SCL_PIN 22

// OneWire and Dallas Temperature
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// OLED Display
Adafruit_SSD1306 display(128, 64, &Wire, -1);

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// Thresholds
const int TDS_ALERT_THRESHOLD = 130;
const int LOW_WATER_THRESHOLD = 30;

// State tracking
float waterTemperature = 22.0;
bool waterPresent = true;
bool alertLed = false;
bool buzzerActive = false;
unsigned long lastAlertTime = 0;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(LED_ALERT_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Set PWM for buzzer
  ledcSetup(0, 2000, 8);
  ledcAttachPin(BUZZER_PIN, 0);
  
  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize OLED
  if (!display.begin(SSD1306_I2C_ADDRESS, 0x3C)) {
    Serial.println("OLED initialization failed");
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Zone 3B Starting...");
  display.display();
  
  // Initialize DS18B20
  sensors.begin();
  
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
    
    // Read DS18B20 temperature
    sensors.requestTemperatures();
    waterTemperature = sensors.getTempCByIndex(0);
    
    // Read optical level sensor (0-4095 ADC)
    int opticalADC = analogRead(OPTICAL_LEVEL_PIN);
    waterPresent = opticalADC > 1500; // Threshold for water presence
    
    // Update OLED
    updateOLED();
    
    // Publish telemetry
    publishTelemetry();
  }
  
  // Handle alert timing (buzzer and LED blink)
  if (alertLed) {
    // Blink alert LED and buzzer
    unsigned long timeSinceAlert = millis() - lastAlertTime;
    if (timeSinceAlert < 5000) { // Alert for 5 seconds
      if ((timeSinceAlert / 200) % 2 == 0) { // Toggle every 200ms
        digitalWrite(LED_ALERT_PIN, HIGH);
        ledcWrite(0, 150); // Buzzer on
      } else {
        digitalWrite(LED_ALERT_PIN, LOW);
        ledcWrite(0, 0); // Buzzer off
      }
    } else {
      // Clear alert after 5 seconds
      alertLed = false;
      buzzerActive = false;
      digitalWrite(LED_ALERT_PIN, LOW);
      ledcWrite(0, 0);
    }
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
  Serial.print("Connecting to MQTT as Zone3B...");
  
  if (client.connect("Zone3B", mqtt_username, "")) {
    Serial.println("connected!");
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

void publishTelemetry() {
  String payload = "{";
  payload += "\"waterTemperature\":" + String(waterTemperature, 1);
  payload += ",\"waterPresent\":" + String(waterPresent ? "true" : "false");
  payload += ",\"alertLed\":" + String(alertLed ? "true" : "false");
  payload += ",\"buzzerActive\":" + String(buzzerActive ? "true" : "false");
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Zone 3B - Water Safety");
  display.print("Water Temp: ");
  display.print(waterTemperature, 1);
  display.println("C");
  display.print("Water Present: ");
  display.println(waterPresent ? "Yes" : "No");
  display.print("Alert Status: ");
  display.println(alertLed ? "ACTIVE" : "OK");
  display.display();
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setAlert") != -1) {
      alertLed = payload.indexOf("true") != -1;
      buzzerActive = alertLed;
      if (alertLed) {
        lastAlertTime = millis();
      } else {
        digitalWrite(LED_ALERT_PIN, LOW);
        ledcWrite(0, 0);
      }
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}

#define SSD1306_I2C_ADDRESS 0x3C
