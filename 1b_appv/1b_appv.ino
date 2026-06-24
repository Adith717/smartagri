#include <esp_now.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define WIFI_SSID     "Rohith"
#define WIFI_PASSWORD "12345678"
#define TOKEN         "afgjhUldy5tYPol2mA1O" 
#define TB_SERVER     "thingsboard.cloud"

#define TOUCH_PIN  4
#define PIR_PIN    18
#define RAIN_PIN   34
#define SERVO_PIN  23

typedef struct {
  uint8_t zone_id;
  float temp;
  float hum;
  int soil_percent;
  bool pump_status;
} Telemetry1A;

typedef struct {
  bool manual_pump;
  bool led_r;
  bool led_g;
  bool led_b;
} Command1A;

Telemetry1A slaveData;
Command1A cmds = {false, false, false, false};
uint8_t slaveMac[6];
bool slaveFound = false;

WiFiClient espClient;
PubSubClient tb(espClient);
unsigned long lastSend = 0;

// Callback function executed when 1A drops an ESP-NOW telemetry frame
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (data[0] == 1) { // Validate incoming zone identifier matches Zone 1
    memcpy(&slaveData, data, sizeof(slaveData));
    if (!slaveFound) {
      memcpy(slaveMac, info->src_addr, 6);
      esp_now_peer_info_t peer = {}; 
      memcpy(peer.peer_addr, slaveMac, 6);
      esp_now_add_peer(&peer);
      slaveFound = true;
    }
  }
}

// Callback processing incoming RPC adjustments downstream from ThingsBoard widgets
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc; 
  deserializeJson(doc, payload, length);
  
  if (String(topic) == "v1/devices/me/attributes") {
    if (doc.containsKey("z1_pump")) cmds.manual_pump = doc["z1_pump"];
    if (doc.containsKey("z1_led_r")) cmds.led_r = doc["z1_led_r"];
    if (doc.containsKey("z1_led_g")) cmds.led_g = doc["z1_led_g"];
    if (doc.containsKey("z1_led_b")) cmds.led_b = doc["z1_led_b"];
    
    // Re-route dashboard state updates instantly down to Slave 1A
    if (slaveFound) esp_now_send(slaveMac, (uint8_t *) &cmds, sizeof(cmds));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TOUCH_PIN, INPUT); pinMode(PIR_PIN, INPUT);
  ledcAttach(SERVO_PIN, 50, 14); // Core PWM setup for high-torque roof servo

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(OnDataRecv);
  
  tb.setServer(TB_SERVER, 1883); 
  tb.setCallback(mqttCallback);
}

void loop() {
  // Maintain active link status with ThingsBoard Server
  if (WiFi.status() == WL_CONNECTED && !tb.connected()) {
    if(tb.connect("Zone1B_Master", TOKEN, NULL)) {
       tb.subscribe("v1/devices/me/attributes");
    }
  }
  tb.loop();

  // Primary execution and cloud update tracking loop running every 4000ms
  if (millis() - lastSend > 4000) {
    lastSend = millis();
    int rainRaw = analogRead(RAIN_PIN);
    
    // Automation Logic: Local rain sensor triggers automatic servo roof adjustments
    bool isRaining = (rainRaw < 2000); 
    ledcWrite(SERVO_PIN, isRaining ? 1600 : 400); // Close protective roof structure if rain is detected

    if (tb.connected()) {
      StaticJsonDocument<256> doc;
      doc["z1b_touch"] = digitalRead(TOUCH_PIN);
      doc["z1b_pir"] = digitalRead(PIR_PIN);
      doc["z1b_rain"] = rainRaw;
      doc["z1b_roof_closed"] = isRaining;
      doc["z1a_temp"] = slaveData.temp;
      doc["z1a_hum"] = slaveData.hum;
      doc["z1a_soil"] = slaveData.soil_percent;
      doc["z1a_pump"] = slaveData.pump_status;
      
      char out[256]; 
      serializeJson(doc, out);
      tb.publish("v1/devices/me/telemetry", out);
    }
  }
}