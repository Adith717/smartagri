#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <DHT.h>

#define DHTPIN    4
#define DHTTYPE   DHT11
#define SOIL_PIN  34
#define PUMP_PIN  23
#define LED_R_PIN 25
#define LED_G_PIN 26
#define LED_B_PIN 27

const char* ROUTER_SSID = "Rohith";
// Target MAC Address of Master 1B gateway
uint8_t masterMac[] = {0xE0, 0x8C, 0xFE, 0x34, 0x33, 0x1C};

DHT dht(DHTPIN, DHTTYPE);

typedef struct {
  uint8_t zone_id = 1;
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

Telemetry1A myData;
Command1A incomingCmds = {false, false, false, false};
unsigned long lastRead = 0;

// Scan local Wi-Fi networks to find the network channel used by the master router
int32_t getRouterChannel() {
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == ROUTER_SSID) return WiFi.channel(i);
  }
  return 1; // Default back to Channel 1 if network not found
}

// Callback invoked when execution messages are received from Master 1B
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  memcpy(&incomingCmds, data, sizeof(incomingCmds));
  digitalWrite(LED_R_PIN, incomingCmds.led_r);
  digitalWrite(LED_G_PIN, incomingCmds.led_g);
  digitalWrite(LED_B_PIN, incomingCmds.led_b);
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(PUMP_PIN, OUTPUT); 
  pinMode(LED_R_PIN, OUTPUT); pinMode(LED_G_PIN, OUTPUT); pinMode(LED_B_PIN, OUTPUT);
  
  WiFi.mode(WIFI_STA);
  int32_t ch = getRouterChannel();
  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE); // Force radio channel synchronization

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Initialization Failed");
    return;
  }
  esp_now_register_recv_cb(OnDataRecv);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, masterMac, 6);
  peerInfo.channel = ch;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}

void loop() {
  // Read and transmit telemetry data every 3000ms
  if (millis() - lastRead >= 3000) {
    lastRead = millis();
    myData.temp = dht.readTemperature();
    myData.hum = dht.readHumidity();
    
    // Map soil moisture sensor values from analog scale to percentage bounds
    myData.soil_percent = constrain(map(analogRead(SOIL_PIN), 4095, 1500, 0, 100), 0, 100);
    
    // Automation Logic: Manual override takes priority, else uses automated soil-moisture checks
    if (incomingCmds.manual_pump) {
      digitalWrite(PUMP_PIN, HIGH); 
      myData.pump_status = true;
    } else {
      if (myData.soil_percent < 30) { 
        digitalWrite(PUMP_PIN, HIGH); 
        myData.pump_status = true; // Turn pump ON if soil is too dry
      } 
      else if (myData.soil_percent > 42) { 
        digitalWrite(PUMP_PIN, LOW); 
        myData.pump_status = false; // Turn pump OFF if soil is well watered
      }
    }
    
    // Ship telemetry package upstream to Master Gateway
    esp_now_send(masterMac, (uint8_t *) &myData, sizeof(myData));
  }
}