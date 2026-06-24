/*
 * Zone 2A - Cattle Monitor Node
 * ESP32 with DHT11, RFID MFRC522, RTC DS1302, OLED SSD1306, Buzzer
 * GPIO Pins: DHT11=4, RFID_SDA=5, RFID_SCK=18, RFID_MOSI=23, RFID_MISO=19, Buzzer PWM=32, LED1=12, LED2=2
 * I2C: SDA=21, SCL=22 (for OLED and RTC)
 */

#include <WiFi.h>
#include <DHT.h>
#include <MQTT.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <SPI.h>
#include <MFRC522.h>

// WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// ThingsBoard MQTT broker
const char* mqtt_broker = "YOUR_THINGSBOARD_HOST";
const int mqtt_port = 1883;
const char* mqtt_username = "YOUR_DEVICE_TOKEN";

// GPIO Pins
#define DHT_PIN 4
#define RFID_SS_PIN 5
#define RFID_RST_PIN 17
#define BUZZER_PIN 32
#define LED1_PIN 12
#define LED2_PIN 2

// I2C pins (standard for ESP32)
#define SDA_PIN 21
#define SCL_PIN 22

// DHT11 sensor
DHT dht(DHT_PIN, DHT11);

// RFID Reader
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

// OLED Display
Adafruit_SSD1306 display(128, 64, &Wire, -1);

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// State tracking
float lastTemperature = 24;
float lastHumidity = 58;
bool buzzerActive = false;
bool led1Alert = false;
bool led2Alert = false;
String lastRFIDScan = "";
unsigned long lastRFIDTime = 0;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  
  // Set PWM frequency for buzzer
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
  display.println("Zone 2A Starting...");
  display.display();
  
  // Initialize DHT
  dht.begin();
  
  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  
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
    
    // Read DHT11
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    lastTemperature = temperature;
    lastHumidity = humidity;
    
    // Update OLED
    updateOLED();
    
    // Publish telemetry
    publishTelemetry();
  }
  
  // Check RFID continuously
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String rfidUID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      rfidUID += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      rfidUID += String(rfid.uid.uidByte[i], HEX);
    }
    rfidUID.toUpperCase();
    lastRFIDScan = rfidUID;
    lastRFIDTime = millis();
    
    // Trigger alert
    led1Alert = true;
    buzzerActive = true;
    ledcWrite(0, 100); // Buzzer on
    
    Serial.print("RFID Scan: ");
    Serial.println(rfidUID);
    
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
  
  // Turn off alert after 3 seconds
  if (led1Alert && (millis() - lastRFIDTime > 3000)) {
    led1Alert = false;
    buzzerActive = false;
    ledcWrite(0, 0);
  }
  
  // Update LED states
  digitalWrite(LED1_PIN, led1Alert ? HIGH : LOW);
  digitalWrite(LED2_PIN, led2Alert ? HIGH : LOW);
  
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
  }
}

void connectToMQTT() {
  Serial.print("Connecting to MQTT as Zone2A...");
  
  if (client.connect("Zone2A", mqtt_username, "")) {
    Serial.println("connected!");
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

void publishTelemetry() {
  String payload = "{";
  payload += "\"temperature\":" + String(lastTemperature, 1);
  payload += ",\"humidity\":" + String(lastHumidity, 0);
  payload += ",\"buzzerActive\":" + String(buzzerActive ? "true" : "false");
  payload += ",\"led1Alert\":" + String(led1Alert ? "true" : "false");
  payload += ",\"led2Alert\":" + String(led2Alert ? "true" : "false");
  payload += ",\"rtcTime\":\"" + String(getTimeString()) + "\"";
  if (!lastRFIDScan.isEmpty()) {
    payload += ",\"lastRFID\":\"" + lastRFIDScan + "\"";
  }
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Zone 2A - Cattle Monitor");
  display.print("Temp: ");
  display.print(lastTemperature, 1);
  display.println("C");
  display.print("Humidity: ");
  display.print(lastHumidity, 0);
  display.println("%");
  display.print("Time: ");
  display.println(getTimeString());
  display.print("Last RFID: ");
  display.println(lastRFIDScan.isEmpty() ? "None" : lastRFIDScan);
  display.display();
}

String getTimeString() {
  unsigned long currentSeconds = millis() / 1000;
  int hours = (currentSeconds / 3600) % 24;
  int minutes = (currentSeconds / 60) % 60;
  int seconds = currentSeconds % 60;
  
  String timeStr = "";
  if (hours < 10) timeStr += "0";
  timeStr += hours;
  timeStr += ":";
  if (minutes < 10) timeStr += "0";
  timeStr += minutes;
  timeStr += ":";
  if (seconds < 10) timeStr += "0";
  timeStr += seconds;
  
  return timeStr;
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setBuzzer") != -1) {
      buzzerActive = payload.indexOf("true") != -1;
      ledcWrite(0, buzzerActive ? 100 : 0);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}

#define SSD1306_I2C_ADDRESS 0x3C
