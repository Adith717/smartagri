#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <U8g2lib.h>

#define WIFI_SSID     "Rohith"
#define WIFI_PASSWORD "12345678"
#define TOKEN         "kpvk9Xj08sch99ENv3I4"
#define TB_SERVER     "thingsboard.cloud"

#define DS18B20_PIN 4
#define OPTICAL_PIN 34 

OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

WiFiClient espClient;
PubSubClient tb(espClient);

typedef struct {
  uint8_t zone_id;
  uint16_t tds_ppm;
  uint8_t solar_angle;
  uint16_t ldr1_val;
  uint16_t ldr2_val;
} Telemetry3A;

typedef struct {
  bool force_pump;
} Command3A;

Telemetry3A slaveData;
Command3A cmds = {false};
uint8_t slaveMac[6];
bool slaveFound = false;

unsigned long lastLoopTime = 0;
const unsigned long LOOP_INTERVAL = 1000;
unsigned long lastMqttReconnect = 0;

void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len == sizeof(Telemetry3A) && data[0] == 3) { 
    memcpy(&slaveData, data, sizeof(slaveData));
    if (!slaveFound) {
      memcpy(slaveMac, info->src_addr, 6);
      esp_now_peer_info_t peer = {}; 
      memcpy(peer.peer_addr, slaveMac, 6);
      peer.channel = 0;
      peer.encrypt = false;
      esp_now_add_peer(&peer); 
      slaveFound = true;
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  u8g2.setCursor(0, 20); u8g2.print("Booting System...");
  u8g2.sendBuffer();

  sensors.begin();
  sensors.setWaitForConversion(false); 
  sensors.requestTemperatures();
  pinMode(OPTICAL_PIN, INPUT);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  u8g2.setCursor(0, 35); u8g2.print("Connecting Wi-Fi...");
  u8g2.sendBuffer();
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(OnDataRecv);
  tb.setServer(TB_SERVER, 1883);
}

void loop() {
  unsigned long currentMillis = millis();

  if (WiFi.status() == WL_CONNECTED) {
    if (!tb.connected() && (currentMillis - lastMqttReconnect > 5000)) {
      lastMqttReconnect = currentMillis;
      tb.connect("Zone3B_Master", TOKEN, NULL);
    }
    tb.loop();
  }

  if (currentMillis - lastLoopTime >= LOOP_INTERVAL) {
    lastLoopTime = currentMillis;
    float tempC = sensors.getTempCByIndex(0);
    sensors.requestTemperatures(); // non-blocking conversion request
    
    bool waterPresent = (digitalRead(OPTICAL_PIN) == HIGH);
    
    // Automation Logic: Master runs safety calculations before unlocking 3A pump hardware
    bool isSafe = (slaveData.tds_ppm < 600) && (tempC < 35.0) && waterPresent;
    cmds.force_pump = isSafe;
    
    if (slaveFound) {
      esp_now_send(slaveMac, (uint8_t *) &cmds, sizeof(cmds));
    }

    if (tb.connected()) {
      StaticJsonDocument<256> doc;
      doc["temp"] = tempC;
      doc["tds"] = slaveData.tds_ppm;
      doc["water_ok"] = waterPresent;
      doc["pump_running"] = isSafe;
      doc["solar_angle"] = slaveData.solar_angle;
      doc["ldr1"] = slaveData.ldr1_val;
      doc["ldr2"] = slaveData.ldr2_val;
      
      char out[256];
      serializeJson(doc, out);
      tb.publish("v1/devices/me/telemetry", out);
    }

    // OLED System Interface Processing
    u8g2.clearBuffer();
    if (WiFi.status() != WL_CONNECTED) {
      u8g2.setCursor(0, 10); u8g2.print("ERR: NO WIFI");
    } else if (!tb.connected()) {
      u8g2.setCursor(0, 10); u8g2.print("ERR: NO CLOUD");
    } else {
      u8g2.setCursor(0, 10); u8g2.print(isSafe ? "PUMP: RUNNING" : "PUMP: STOPPED");
    }

    u8g2.setCursor(0, 25); u8g2.print("Temp: "); u8g2.print(tempC);
    u8g2.setCursor(0, 40); u8g2.print("TDS: "); u8g2.print(slaveData.tds_ppm);
    u8g2.setCursor(0, 55); u8g2.print("Ang: "); u8g2.print(slaveData.solar_angle);
    u8g2.print(" | Wtr: "); u8g2.print(waterPresent ? "OK" : "LO");
    u8g2.sendBuffer();
  }
}