#include <AltSoftSerial.h>
#include <WiFiEsp.h>
#include <PubSubClient.h>
#include "DHT.h"

#define DHTPIN 12 
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

AltSoftSerial esp;  // RX=8, TX=9

// ===== WiFi =====
const char* WIFI_SSID = "MIWIFI_QDGY_2G";
const char* WIFI_PASS = "xGST6s7C";
                                                   
// ---------- MQTT (broker externo) ----------
const char* MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_TOPIC = "juanjo/sensores/distancia";

WiFiEspClient net;
PubSubClient mqtt(net);

// ===== HC-SR04 =====
const int trigPin = 5;
const int echoPin = 4;
float distEMA = NAN;
const float DIST_ALPHA = 0.3f;

// ===== Envío =====
const unsigned long SEND_INTERVAL_MS = 2000;  // 20 ms -> ~50 Hz
unsigned long lastSendAt = 0;

// ---------------- Medición HC-SR04 ----------------
float measureDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  for (int k = 0; k < 3; ++k) {
    unsigned long dur = pulseIn(echoPin, HIGH, 30000UL);
    if (dur) return (dur * 0.034f) / 2.0f;
  }
  return NAN;
}

//==== Conexion WIFI =============
void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  // Intenta conectar (reintentos simples)
  for (int i = 0; i < 5 && WiFi.status() != WL_CONNECTED; ++i) {
    Serial.print(F("[WiFi] Intento #"));
    Serial.println(i + 1);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long t0 = millis();
    while (millis() - t0 < 10000 && WiFi.status() != WL_CONNECTED) {
      delay(250);
      Serial.print('.');
    }
    Serial.println();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[WiFi] OK  IP="));
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(F("[WiFi] NO CONECTADO"));
  }
}


void ensureMqtt() {
  if (mqtt.connected()) return;

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);  // importante para NATs/routers

  // ClientID sencillo y casi-único
  char clientId[32];
  // usa algo de "ruido" de A0 si está flotante
  snprintf(clientId, sizeof(clientId), "uno-%lu", millis() ^ analogRead(A0));

  Serial.print(F("[MQTT] Conectando a "));
  Serial.print(MQTT_HOST);
  Serial.print(':');
  Serial.println(MQTT_PORT);
  // sin usuario/clave (broker público)
  if (mqtt.connect(clientId)) {
    Serial.println(F("[MQTT] Conectado"));
    // (Opcional) mqtt.subscribe("juanjo/control/#");
  } else {
    Serial.print(F("[MQTT] FALLO rc="));
    Serial.println(mqtt.state());
  }
}


// ---------------- Setup y loop ----------------
void setup() {
  Serial.begin(115200);
  esp.begin(57600);
  WiFi.init(&esp);
  dht.begin();
  delay(800);

  if (WiFi.status() == WL_NO_SHIELD) {
    Serial.println(F("[WiFi] ERROR: ESP no detectado (WL_NO_SHIELD)"));
  } else {
    Serial.println(F("[WiFi] ESP detectado"));
  }

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  ensureWifi();
  ensureMqtt();
}



void loop() {
  // Mantener sesiones vivas
  ensureWifi();
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) ensureMqtt();
    mqtt.loop();  // MUY IMPORTANTE: procesa keep-alive/acks
  }

  // Sensor de humedad
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  float indiceCalor = dht.computeHeatIndex(temperature, humidity, false); // false = °C

  // Nueva petición cada 20ms
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED && mqtt.connected() && now - lastSendAt >= SEND_INTERVAL_MS) {

    lastSendAt = now;

    float distancia = measureDistanceCm();
    
    if (!isnan(distancia)) {
      if (isnan(distEMA)) distEMA = distancia;
      else distEMA = DIST_ALPHA * distancia + (1.0f - DIST_ALPHA) * distEMA;
    }
    // ===== Construcción segura del JSON =====
    char payload[128];          
    char distStr[16];
    char humStr[16];
    char tempStr[16];
    char indStr[16];

    // Prepara strings (o "null" si NaN)
    const char* distField;
    const char* humField;
    const char* tempField;
    const char* indField;

    if (isnan(distEMA))  distField = "null";
    else { dtostrf(distEMA, 0, 1, distStr); distField = distStr; }

    if (isnan(humidity)) humField  = "null";
    else { dtostrf(humidity, 0, 2, humStr); humField = humStr; }

    if (isnan(temperature)) tempField = "null";
    else { dtostrf(temperature, 0, 2, tempStr); tempField = tempStr; }

    if (isnan(indiceCalor)) indField = "null";
    else { dtostrf(indiceCalor, 0, 2, indStr); indField = indStr; }


    snprintf(payload, sizeof(payload),
             "{\"time\":%lu,\"distancia\":%s,\"humidity\":%s,\"temperature\":%s,\"indHeat\":%s}",
             now, distField, humField, tempField, indField);

    bool ok = mqtt.publish(MQTT_TOPIC, payload); 
    Serial.print(F("[PUB] "));
    Serial.print(MQTT_TOPIC);
    Serial.print(F(" -> "));
    if (ok) {
      Serial.println(payload);
    } else {
      Serial.println(F("ERROR "));
    }
  }
}
