#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// Transparent Protocol Structure matching both nodes
#ifndef __SMART_AGRI_PROTOCOL_H__
#define CMD_SET_AUTO          1
#define CMD_SET_MOTOR_PERCENT 2
struct SlaveDataPacket {
    float temperature;
    float humidity;
    int soilRaw;
    uint8_t soilPct;
    uint8_t fruitColor;
    uint8_t actualMotorPercent;
    bool autoMode;
};
#endif

// ==================== CONFIGURATION TARGETS ====================
const char* WIFI_SSID   = "YOUR_WIFI_SSID";         
const char* WIFI_PASS   = "YOUR_WIFI_PASSWORD";     
const char* TB_SERVER   = "thingsboard.cloud";      
const int   TB_PORT     = 1883;
const char* TB_TOKEN    = "YOUR_MASTER_TOKEN"; 

// Logic direction parameterization flags
#define INVERT_TOUCH_LOGIC   false  
#define INVERT_PIR_LOGIC     false  

// Pin Mappings
#define TOUCH_PIN     4
#define PIR_PIN       18
#define RAIN_PIN      34
#define BUZZER_PIN    15
#define SERVO_PIN     23
// Soil sensor and motor PWM (adjust pins as needed)
#define SOIL_PIN      35
#define MOTOR_PWM_PIN 19

const int RAIN_THRESHOLD = 2000; 
const int ROOF_OPEN      = 0;
const int ROOF_CLOSED    = 90;

WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo roofServo;

SlaveDataPacket slaveData;
volatile unsigned long lastSlaveUpdate = 0;
unsigned long lastTelemetryTx = 0;
unsigned long lastConnCheck = 0;

int rainRaw = 4095;
bool isIntrusion = false;
bool isTouchActive = false;
int currentRoofAngle = ROOF_OPEN;
bool masterAutoMode = true;
uint8_t currentWiFiChannel = 1;
volatile bool needPeerUpdate = false; 
volatile bool forceImmediateTx = false;

uint8_t broadcastMac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void sendTelemetry();

void updateSlavePeerChannel(uint8_t channel) {
    if (esp_now_is_peer_exist(broadcastMac)) {
        esp_now_del_peer(broadcastMac);
    }
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastMac, 6);
    peerInfo.channel = channel;
    peerInfo.encrypt = false;
    
    esp_now_add_peer(&peerInfo);
}

void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
    // If master sent a full slave data packet (rare), copy it
    if (len == sizeof(SlaveDataPacket)) {
        memcpy(&slaveData, incomingData, sizeof(slaveData));
        lastSlaveUpdate = millis();
        return;
    }

    // Command messages are 2 bytes: [CMD, PARAM]
    if (len == 2) {
        uint8_t cmd = incomingData[0];
        uint8_t param = incomingData[1];
        if (cmd == CMD_SET_AUTO) {
            slaveData.autoMode = (param != 0);
        } else if (cmd == CMD_SET_MOTOR_PERCENT) {
            slaveData.actualMotorPercent = param;
            // apply PWM to motor driver (8-bit resolution)
            uint32_t duty = map(param, 0, 100, 0, 255);
            ledcWrite(0, duty);
        }
        lastSlaveUpdate = millis();
    }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length) != DeserializationError::Ok) return;

    String topicStr = String(topic);
    String requestId = topicStr.substring(topicStr.lastIndexOf("/") + 1);
    String methodName = doc["method"].as<String>();
    
    Serial.printf("[RPC Incoming] Method: %s\n", methodName.c_str());

    if (methodName == "setSlaveAuto") {
        bool mode = doc["params"].as<bool>();
        slaveData.autoMode = mode;
        uint8_t buf[2] = { CMD_SET_AUTO, (uint8_t)(mode ? 1 : 0) };
        esp_now_send(broadcastMac, buf, 2); 
    } 
    else if (methodName == "setSlaveMotor") {
        uint8_t val = doc["params"].as<uint8_t>();
        slaveData.actualMotorPercent = val;
        uint8_t buf[2] = { CMD_SET_MOTOR_PERCENT, val };
        esp_now_send(broadcastMac, buf, 2);
    }
    else if (methodName == "setMasterAuto") {
        masterAutoMode = doc["params"].as<bool>();
    }
    else if (methodName == "setMasterRoof") {
        masterAutoMode = false; 
        int angle = doc["params"].as<int>();
        currentRoofAngle = constrain(angle, ROOF_OPEN, ROOF_CLOSED);
        roofServo.write(currentRoofAngle);
    }

    // Explicit RPC Response transmission to clear ThingsBoard UI blocking spinner loops
    String responseTopic = "v1/devices/me/rpc/response/" + requestId;
    String responsePayload = "{\"status\":\"done\"}";
    mqttClient.publish(responseTopic.c_str(), responsePayload.c_str());
    
    forceImmediateTx = true; 
}

void handleNetworkStatusAsync() {
    // Slave uses ESP-NOW only. Keep WiFi in STA mode and update peer channel when available.
    if (millis() - lastConnCheck < 5000) return;
    lastConnCheck = millis();

    uint8_t actualChan = WiFi.channel();
    if (actualChan != currentWiFiChannel && actualChan != 0) {
        currentWiFiChannel = actualChan;
        needPeerUpdate = true;
    }
}

void setup() {
    Serial.begin(115200);
    
    pinMode(TOUCH_PIN, INPUT_PULLDOWN);
    pinMode(PIR_PIN, INPUT_PULLDOWN);
    pinMode(RAIN_PIN, INPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    roofServo.attach(SERVO_PIN);
    roofServo.write(ROOF_OPEN);

    WiFi.mode(WIFI_STA);
    // Do NOT connect slave to the WiFi AP / ThingsBoard — slave communicates with master via ESP-NOW only

    if (esp_now_init() != ESP_OK) return;
    esp_now_register_recv_cb(onDataRecv);
    updateSlavePeerChannel(currentWiFiChannel);

    // Motor PWM setup (use LEDC channel 0)
    ledcSetup(0, 5000, 8);
    ledcAttachPin(MOTOR_PWM_PIN, 0);

    slaveData.temperature = 0.0; slaveData.humidity = 0.0; slaveData.soilPct = 0;
    slaveData.actualMotorPercent = 0; slaveData.fruitColor = 0; slaveData.autoMode = true;
}

void loop() {
    handleNetworkStatusAsync();
    
    if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
        mqttClient.loop();
    }

    if (needPeerUpdate) {
        needPeerUpdate = false;
        updateSlavePeerChannel(currentWiFiChannel);
    }

    int rawTouch = digitalRead(TOUCH_PIN);
    int rawPIR   = digitalRead(PIR_PIN);
    rainRaw      = analogRead(RAIN_PIN);

    isTouchActive = INVERT_TOUCH_LOGIC ? (rawTouch == LOW) : (rawTouch == HIGH);
    isIntrusion   = INVERT_PIR_LOGIC   ? (rawPIR == LOW)   : (rawPIR == HIGH);

    if (isTouchActive || isIntrusion) {
        digitalWrite(BUZZER_PIN, HIGH);
    } else {
        digitalWrite(BUZZER_PIN, LOW);
    }

    if (masterAutoMode) {
        if (rainRaw < RAIN_THRESHOLD) { 
            if (currentRoofAngle != ROOF_CLOSED) {
                currentRoofAngle = ROOF_CLOSED;
                roofServo.write(currentRoofAngle);
            }
        } else {
            if (currentRoofAngle != ROOF_OPEN) {
                currentRoofAngle = ROOF_OPEN;
                roofServo.write(currentRoofAngle);
            }
        }
    }

    if (millis() - lastTelemetryTx >= 1500 || forceImmediateTx) { 
        sendTelemetry();
    }
    delay(20); 
}

void sendTelemetry() {
    lastTelemetryTx = millis();
    forceImmediateTx = false;
    // Populate local readings (soil sensor used here; add real temp/humidity sensors as needed)
    slaveData.soilRaw = analogRead(SOIL_PIN);
    // crude mapping: higher raw -> drier (adjust according to sensor calibration)
    slaveData.soilPct = (uint8_t)constrain(map(slaveData.soilRaw, 4095, 0, 0, 100), 0, 100);

    // Build ESP-NOW packet and send to master
    esp_err_t res = esp_now_send(broadcastMac, (uint8_t*)&slaveData, sizeof(slaveData));
    if (res != ESP_OK) {
        Serial.printf("[ESP-NOW] send failed: %d\n", res);
    }

    // Optional: also print JSON locally for debugging
    StaticJsonDocument<256> jsonPayload;
    jsonPayload["soilRaw"] = slaveData.soilRaw;
    jsonPayload["soilPct"] = slaveData.soilPct;
    jsonPayload["pumpStatus"] = slaveData.actualMotorPercent;
    jsonPayload["slaveAutoMode"] = slaveData.autoMode;
    String buf;
    serializeJson(jsonPayload, buf);
    Serial.println(buf);
}