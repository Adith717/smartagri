#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <SPI.h>
#include <Wire.h>
#include <DHT.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <MFRC522.h>
#include <U8g2lib.h>
#include "SmartAgriProtocol.h" // Protocol Dependency

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define BUZZER_PIN 32

#define RTC_IO_PIN 25
#define RTC_RST_PIN 14
#define RTC_CLK_PIN 26

#define RFID_SDA_PIN 21 
#define RFID_RST_PIN 27
#define RFID_SCK 18
#define RFID_MISO 19
#define RFID_MOSI 23

#define LED_PIN_1 12
#define LED_PIN_2 2

#define OLED_SDA 13
#define OLED_SCL 22

// Destination Target: Master Node 2B MAC Address Configuration
static const uint8_t NODE2B_MAC[6] = { 0xE0, 0x8C, 0xFE, 0x34, 0x76, 0x18 };
const char* ROUTER_SSID = "Poyi Recharge Cheyyada";
int32_t syncedChannel = 1;
static const float HIGH_TEMP_C = 33.0f;

DHT dht(DHT_PIN, DHT_TYPE);
ThreeWire rtcWire(RTC_IO_PIN, RTC_CLK_PIN, RTC_RST_PIN);
RtcDS1302<ThreeWire> rtc(rtcWire);
MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

float temperatureC = NAN;
float humidityPct = NAN;
char lastUid[18] = "NO CARD";
char timeText[22] = "--/--/---- --:--";
uint8_t waterQualityState = WATER_GOOD;
uint32_t alertFlags = 0;
uint32_t seqNo = 0;
unsigned long buzzerUntil = 0;
unsigned long lastPacketMillis = 0;
bool commOk = false;

int32_t getRouterChannel() {
  Serial.println("Scanning airwaves for Master's Router...");
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == ROUTER_SSID) {
      int32_t ch = WiFi.channel(i);
      Serial.printf("Found Router '%s' on Channel %d\n", ROUTER_SSID, ch);
      return ch;
    }
  }
  Serial.println("Router not found. Defaulting to Channel 1.");
  return 1;
}

void addBroadcastPeer() {
  if(esp_now_is_peer_exist(NODE2B_MAC)) return;
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, NODE2B_MAC, 6);
  peer.channel = syncedChannel; 
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

const char* getWaterText(uint8_t state) {
  switch(state) {
    case WATER_GOOD: return "GOOD";
    case WATER_MODERATE: return "MODERATE";
    case WATER_POOR: return "POOR";
    default: return "UNKNOWN";
  }
}

void startBuzzer(unsigned long durationMs) {
  buzzerUntil = millis() + durationMs;
  ledcWrite(BUZZER_PIN, 128); 
}

void serviceBuzzer() {
  if(buzzerUntil && millis() > buzzerUntil) {
    buzzerUntil = 0;
    ledcWrite(BUZZER_PIN, 0);
  }
}

void updateDisplay() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  char line[32];
  u8g2.drawStr(0, 10, "ZONE 2A CATTLE");

  if(isnan(temperatureC)) sprintf(line, "TEMP : NO DATA");
  else sprintf(line, "TEMP : %.1f C", temperatureC);
  u8g2.drawStr(0, 22, line);

  if(isnan(humidityPct)) sprintf(line, "HUM  : NO DATA");
  else sprintf(line, "HUM  : %.1f %%", humidityPct);
  u8g2.drawStr(0, 34, line);

  sprintf(line, "RFID : %s", lastUid);
  u8g2.drawStr(0, 46, line);
  
  sprintf(line, "WATER: %s", getWaterText(waterQualityState));
  u8g2.drawStr(0, 58, line);

  if(commOk) u8g2.drawStr(90, 10, "OK");
  else u8g2.drawStr(72, 10, "LOST");
  u8g2.sendBuffer();
}

void sendTelemetry() {
  TelemetryPacket p;
  initTelemetry(p, NODE_ZONE2A_CATTLE_MONITOR, ++seqNo);

  p.temperatureCx10 = packFloat10(temperatureC);
  p.humidityx10 = packFloat10(humidityPct);
  p.waterQuality = waterQualityState;
  p.alertFlags = alertFlags;
  p.ledState = digitalRead(LED_PIN_1) || digitalRead(LED_PIN_2);
  strncpy(p.rfid, lastUid, sizeof(p.rfid)-1);
  p.rfid[sizeof(p.rfid)-1] = '\0'; 

  esp_err_t result = esp_now_send(NODE2B_MAC, reinterpret_cast<uint8_t*>(&p), sizeof(p));
  if(result == ESP_OK) {
    Serial.println("ESPNOW TX: OK");
  } else {
    Serial.printf("ESPNOW TX FAIL: %d\n", result);
  }
}

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  lastPacketMillis = millis();
  commOk = true;

  if(!isValidCommand(data, len)) return;

  CommandPacket cmd;
  memcpy(&cmd, data, sizeof(cmd));

  if(cmd.targetNode != NODE_ZONE2A_CATTLE_MONITOR && cmd.targetNode != NODE_BROADCAST) return;
  
  // Process remote trigger routines from 2B Gateway
  if(cmd.commandId == CMD_BUZZER_PULSE) {
    startBuzzer(500);
  }
  else if(cmd.commandId == CMD_LOCAL_LED1) {
    digitalWrite(LED_PIN_1, HIGH);
    digitalWrite(LED_PIN_2, LOW);
  }
  else if(cmd.commandId == CMD_LOCAL_LED2) {
    digitalWrite(LED_PIN_1, LOW);
    digitalWrite(LED_PIN_2, HIGH);
  }
  else if(cmd.commandId == CMD_ALL_OFF) {
    digitalWrite(LED_PIN_1, LOW);
    digitalWrite(LED_PIN_2, LOW);
    ledcWrite(BUZZER_PIN, 0);
    buzzerUntil = 0;
  }
  else if(cmd.commandId == CMD_SET_WATER_QUALITY) {
    waterQualityState = constrain(cmd.value, 0, 2);
    if(waterQualityState == WATER_POOR) startBuzzer(1200);
  }
  updateDisplay();
}

void sampleDhtAndRtc() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if(!isnan(t) && !isnan(h)) {
    temperatureC = t;
    humidityPct = h;
  } else {
    temperatureC = NAN;
    humidityPct = NAN;
  }

  if(rtc.IsDateTimeValid()) {
    RtcDateTime now = rtc.GetDateTime();
    snprintf(timeText, sizeof(timeText), "%02u/%02u %02u:%02u", 
             now.Day(), now.Month(), now.Hour(), now.Minute());
  }
}

// Automation Logic: Parse incoming tag identifiers when livestock step up to the scanner
void readRfid() {
  if(!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  char uid[18] = {0};
  char *out = uid;

  for(byte i = 0; i < rfid.uid.size && i < 7; i++) {
    sprintf(out, "%02X", rfid.uid.uidByte[i]);
    out += 2;
    if(i + 1 < rfid.uid.size && i < 6) {
      *out++ = ':';
      *out = '\0';
    }
  }
  strncpy(lastUid, uid, sizeof(lastUid)-1);
  lastUid[sizeof(lastUid)-1] = '\0'; 

  startBuzzer(120); // Local auditory acknowledgment pulse
  rfid.PICC_HaltA();
  updateDisplay();
}

void updateAlerts() {
  alertFlags = 0;
  if(isnan(temperatureC) || isnan(humidityPct)) alertFlags |= ALERT_SENSOR_FAULT;
  if(!isnan(temperatureC) && temperatureC >= HIGH_TEMP_C) alertFlags |= ALERT_HIGH_TEMP;
  if(waterQualityState == WATER_POOR) alertFlags |= ALERT_POOR_WATER;
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nBOOTING ZONE 2A");

  pinMode(LED_PIN_1, OUTPUT);
  pinMode(LED_PIN_2, OUTPUT);
  digitalWrite(LED_PIN_1, LOW);
  digitalWrite(LED_PIN_2, LOW);

  ledcAttach(BUZZER_PIN, 2000, 8); 
  ledcWrite(BUZZER_PIN, 0);

  dht.begin();
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(100000);
  delay(300);

  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  u8g2.drawStr(10, 30, "ZONE 2A READY");
  u8g2.sendBuffer();
  delay(1500);

  SPI.begin(RFID_SCK, RFID_MISO, RFID_MOSI, RFID_SDA_PIN);
  rfid.PCD_Init();

  rtc.Begin();
  if(!rtc.IsDateTimeValid()) {
    rtc.SetDateTime(RtcDateTime(__DATE__, __TIME__));
  }
  if(rtc.GetIsWriteProtected()) rtc.SetIsWriteProtected(false);
  if(!rtc.GetIsRunning()) rtc.SetIsRunning(true);

  WiFi.mode(WIFI_STA);
  syncedChannel = getRouterChannel();
  esp_wifi_set_channel(syncedChannel, WIFI_SECOND_CHAN_NONE);

  if(esp_now_init() != ESP_OK) return;

  addBroadcastPeer();
  esp_now_register_recv_cb(onDataRecv);
  updateDisplay();
}

void loop() {
  serviceBuzzer();
  readRfid();

  if(millis() - lastPacketMillis > 10000) commOk = false;

  static unsigned long lastSample = 0;
  if(millis() - lastSample >= 2000) {
    lastSample = millis();
    sampleDhtAndRtc();
    updateAlerts();
    updateDisplay();
  }

  static unsigned long lastTx = 0;
  if(millis() - lastTx >= 1000) {
    lastTx = millis();
    sendTelemetry(); // Run background packet stream to 2B Resource Hub
  }
}