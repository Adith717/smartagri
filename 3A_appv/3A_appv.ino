#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <ESP32Servo.h>

#define LDR1_PIN  35
#define LDR2_PIN  34
#define TDS_PIN   32
#define SERVO_PIN 23
#define MOTOR_PIN 15

const char* ROUTER_SSID = "Rohith";

typedef struct {
  uint8_t zone_id = 3;
  uint16_t tds_ppm;
  uint8_t solar_angle;
  uint16_t ldr1_val; 
  uint16_t ldr2_val; 
} Telemetry3A;

typedef struct {
  bool force_pump;
} Command3A;

Telemetry3A myData;
Command3A incomingCmds = {false};
// Target MAC address of Master 3B base station
uint8_t broadcastMac[] = {0x28, 0x05, 0xA5, 0x23, 0xB2, 0x08};
Servo solarServo;

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 2000;

unsigned long lastServoTime = 0;
const unsigned long SERVO_INTERVAL = 50; // Scan LDR tracking array every 50ms

unsigned long lastCommandReceived = 0;
const unsigned long PUMP_FAILSAFE_MS = 5000;

int32_t getRouterChannel() {
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == ROUTER_SSID) return WiFi.channel(i);
  }
  return 1;
}

void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len == sizeof(Command3A)) {
    memcpy(&incomingCmds, data, sizeof(incomingCmds));
    lastCommandReceived = millis(); // Refresh timeout tracker to avoid failsafe cutoff
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(MOTOR_PIN, OUTPUT);
  ESP32PWM::allocateTimer(2);
  solarServo.attach(SERVO_PIN, 500, 2400);
  myData.solar_angle = 90;
  solarServo.write(myData.solar_angle);
  
  WiFi.mode(WIFI_STA);
  int32_t ch = getRouterChannel();
  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(OnDataRecv);
  
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastMac, 6);
  peerInfo.channel = ch;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}

void loop() {
  unsigned long currentMillis = millis();

  // Automation Logic: Throttled LDR Differential Solar Tracker Loop
  if (currentMillis - lastServoTime >= SERVO_INTERVAL) {
    lastServoTime = currentMillis;
    uint16_t ldr1 = analogRead(LDR1_PIN);
    uint16_t ldr2 = analogRead(LDR2_PIN);
    myData.ldr1_val = ldr1;
    myData.ldr2_val = ldr2;

    int deadzone = 150; // Compensate for small reading variances
    if (ldr1 > (ldr2 + deadzone)) {
      myData.solar_angle = constrain(myData.solar_angle + 2, 0, 180);
      solarServo.write(myData.solar_angle);
    } 
    else if (ldr2 > (ldr1 + deadzone)) {
      myData.solar_angle = constrain(myData.solar_angle - 2, 0, 180);
      solarServo.write(myData.solar_angle);
    }
  }

  // Actuator Safety Interlock: Cut power to pump if master node goes offline
  if (currentMillis - lastCommandReceived > PUMP_FAILSAFE_MS) {
    incomingCmds.force_pump = false;
  }
  digitalWrite(MOTOR_PIN, incomingCmds.force_pump ? HIGH : LOW);

  // Ship performance parameters to master station
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = currentMillis;
    int tdsRaw = analogRead(TDS_PIN);
    // Convert analog voltage spectrum mapping to estimated standard water quality PPM index values
    myData.tds_ppm = (uint16_t)((tdsRaw * 3.3f / 4095.0f) * 500.0f);
    
    esp_now_send(broadcastMac, (uint8_t *) &myData, sizeof(myData));
  }
}