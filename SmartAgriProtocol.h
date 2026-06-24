#ifndef SMART_AGRI_PROTOCOL_H
#define SMART_AGRI_PROTOCOL_H

#include <Arduino.h>

// Node Identifiers
#define NODE_BROADCAST                 0
#define NODE_ZONE2A_CATTLE_MONITOR     1
#define NODE_ZONE2B_CATTLE_RESOURCES   2

// Water Quality Enumerations
#define WATER_GOOD                     0
#define WATER_MODERATE                 1
#define WATER_POOR                     2

// Alert Bitmask Flags
#define ALERT_NONE                     0x00
#define ALERT_SENSOR_FAULT             0x01
#define ALERT_HIGH_TEMP                0x02
#define ALERT_POOR_WATER               0x04
#define ALERT_LOW_WATER                0x08
#define ALERT_LOW_FEED                 0x10
#define ALERT_MANUAL_MODE              0x20

// Command Identifiers
#define CMD_ALL_OFF                    10
#define CMD_BUZZER_PULSE               11
#define CMD_LOCAL_LED1                 12
#define CMD_LOCAL_LED2                 13
#define CMD_SET_WATER_QUALITY          14
#define CMD_SET_AUTO                   15
#define CMD_SET_MOTOR_PERCENT          16
#define CMD_SET_FAN_PERCENT            17
#define CMD_SET_SERVO_ANGLE            18
#define CMD_SET_LED_MODE               19
#define CMD_SYNC_TEMPERATURE_X10       20
#define CMD_SET_FEED_THRESHOLD         21

// Structure for Telemetry Packets (Fixed size for safe serialization over air)
struct __attribute__((packed)) TelemetryPacket {
  uint8_t nodeId;
  uint32_t sequence;
  int16_t temperatureCx10; // Temp in C multiplied by 10
  uint16_t humidityx10;     // Hum multiplied by 10
  uint8_t waterQuality;
  uint32_t alertFlags;
  bool ledState;
  char rfid[18];
  int16_t distanceCm;
  uint16_t ldr1;
  int32_t weightRaw;
  uint8_t servoAngle;
  uint8_t motorPercent;
  bool autoMode;
};

// Structure for Command Packets
struct __attribute__((packed)) CommandPacket {
  uint8_t targetNode;
  uint8_t commandId;
  int32_t value;
};

// Protocol Verification Helpers
inline void initTelemetry(TelemetryPacket &p, uint8_t id, uint32_t seq) {
  memset(&p, 0, sizeof(TelemetryPacket));
  p.nodeId = id;
  p.sequence = seq;
}

inline int16_t packFloat10(float val) {
  if (isnan(val)) return INT16_MIN;
  return (int16_t)(val * 10.0f);
}

inline float unpackFloat10(int16_t val) {
  if (val == INT16_MIN) return NAN;
  return val / 10.0f;
}

inline bool isValidTelemetry(const uint8_t *data, int len) {
  return (len == sizeof(TelemetryPacket));
}

inline bool isValidCommand(const uint8_t *data, int len) {
  return (len == sizeof(CommandPacket));
}

#endif