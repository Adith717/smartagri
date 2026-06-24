/*
 * Zone 1A - Crop Health Monitoring Node
 * ESP32 with DHT11, Soil Moisture Sensor, Pump Control
 * GPIO Pins: DHT11=4, SoilMoisture=34, Pump=23, Red LED=25, Green LED=26, Blue LED=27
 */

#include <WiFi.h>
#include <DHT.h>
#include <MQTT.h>

// WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// ThingsBoard MQTT broker
const char* mqtt_broker = "YOUR_THINGSBOARD_HOST";
const int mqtt_port = 1883;
const char* mqtt_username = "YOUR_DEVICE_TOKEN";

// GPIO Pins
#define DHT_PIN 4
#define SOIL_MOISTURE_PIN 34
#define PUMP_PWM_PIN 23
#define RED_LED_PIN 25
#define GREEN_LED_PIN 26
#define BLUE_LED_PIN 27

// DHT11 sensor
DHT dht(DHT_PIN, DHT11);

// MQTT Client
WiFiClient espClient;
MQTTClient client;

// Thresholds
const int SOIL_MOISTURE_THRESHOLD = 30;
const int TEMP_THRESHOLD = 28;

// State tracking
bool pumpActive = false;
int lastMoistureLevel = 50;
int lastTemperature = 25;
int lastHumidity = 60;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Initialize pins
  pinMode(PUMP_PWM_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN, OUTPUT);
  
  // Set PWM frequency
  ledcSetup(0, 5000, 8);
  ledcAttachPin(PUMP_PWM_PIN, 0);
  
  // Initialize DHT
  dht.begin();
  
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
    
    // Read soil moisture (0-4095 ADC, convert to 0-100%)
    int moistureADC = analogRead(SOIL_MOISTURE_PIN);
    int soilMoisture = map(moistureADC, 4095, 0, 0, 100); // Inverted: dry=high ADC, wet=low ADC
    
    lastTemperature = (int)temperature;
    lastHumidity = (int)humidity;
    lastMoistureLevel = soilMoisture;
    
    // Auto-control logic: Activate pump if soil moisture < 30%
    if (soilMoisture < SOIL_MOISTURE_THRESHOLD) {
      pumpActive = true;
      ledcWrite(0, 200); // PWM 80% (255 * 0.8 = 204)
      setLeds(true, false, true); // Red + Blue for alert + irrigation
    } else if (soilMoisture > SOIL_MOISTURE_THRESHOLD + 5) {
      pumpActive = false;
      ledcWrite(0, 0); // Stop pump
      setLeds(false, true, false); // Green for idle
    }
    
    // Publish telemetry to ThingsBoard
    publishTelemetry(temperature, humidity, soilMoisture);
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
  Serial.print("Connecting to MQTT as Zone1A...");
  
  // ClientID = deviceName
  if (client.connect("Zone1A", mqtt_username, "")) {
    Serial.println("connected!");
    
    // Subscribe to RPC methods for pump control
    client.subscribe("v1/devices/me/rpc/request/+");
  } else {
    Serial.println("failed");
  }
}

void publishTelemetry(float temp, float humidity, int moisture) {
  String payload = "{";
  payload += "\"temperature\":" + String(temp, 1);
  payload += ",\"humidity\":" + String(humidity, 0);
  payload += ",\"soilMoisture\":" + String(moisture);
  payload += ",\"pumpActive\":" + String(pumpActive ? "true" : "false");
  payload += ",\"pumpSpeed\":" + String(pumpActive ? 80 : 0);
  payload += ",\"redAlert\":" + String(pumpActive ? "true" : "false");
  payload += ",\"greenIdleActive\":" + String(!pumpActive ? "true" : "false");
  payload += ",\"blueIrrigationActive\":" + String(pumpActive ? "true" : "false");
  payload += "}";
  
  client.publish("v1/devices/me/telemetry", payload);
}

void messageReceived(String &topic, String &payload) {
  Serial.print("Incoming MQTT message: ");
  Serial.println(payload);
  
  // Handle RPC requests for manual pump control
  if (topic.indexOf("rpc/request") != -1) {
    if (payload.indexOf("setPump") != -1) {
      bool shouldActivate = payload.indexOf("true") != -1;
      pumpActive = shouldActivate;
      if (shouldActivate) {
        ledcWrite(0, 200);
        setLeds(true, false, true);
      } else {
        ledcWrite(0, 0);
        setLeds(false, true, false);
      }
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
    
    if (payload.indexOf("setLeds") != -1) {
      bool red = payload.indexOf("red") != -1;
      bool green = payload.indexOf("green") != -1;
      bool blue = payload.indexOf("blue") != -1;
      setLeds(red, green, blue);
      
      String response = "{\"result\":true}";
      client.publish("v1/devices/me/rpc/response/1", response);
    }
  }
}

void setLeds(bool red, bool green, bool blue) {
  digitalWrite(RED_LED_PIN, red ? HIGH : LOW);
  digitalWrite(GREEN_LED_PIN, green ? HIGH : LOW);
  digitalWrite(BLUE_LED_PIN, blue ? HIGH : LOW);
}
