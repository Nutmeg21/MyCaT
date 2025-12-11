#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h> // Search for "ArduinoJson" in Library Manager and install

// ==========================================
// CONFIGURATION (CHANGE THESE!)
// ==========================================
const char* ssid = "";          // <--- Your WiFi Name
const char* password = "";  // <--- Your WiFi Password
String serverIp = "";             // <--- Your Laptop's Local IP
int serverPort = 3000;

// This ID must match the "Gate ID" you type in the Mobile App
const char* gate_id = "ESP32_HALL_A"; 

// ==========================================
// PIN MAPPING (NodeMCU ESP32 Style)
// ==========================================
#define SS_PIN  5   // D5
#define RST_PIN 22  // D22
#define SCK_PIN 18  // D18
#define MOSI_PIN 23 // D23
#define MISO_PIN 19 // D19

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize Hardware
  SPI.begin(); 
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max); // Fix for Clone Chips (0xB2)

  // 2. Connect to WiFi
  Serial.println();
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\n-------------------------------------");
  Serial.println("✅ WiFi Connected!");
  Serial.println("IP Address: " + WiFi.localIP().toString());
  Serial.println("Gate ID: " + String(gate_id));
  Serial.println("Target Server: http://" + serverIp + ":" + String(serverPort));
  Serial.println("-------------------------------------");
  Serial.println("READY TO SCAN...");
  
  // Setup LED for feedback (Built-in LED is usually Pin 2)
  pinMode(2, OUTPUT);
}

void loop() {
  // --- CLONE CHIP STABILITY FIX ---
  // Re-initialize the reader every loop. This prevents "freezing" 
  // which is common with 0xB2/Clone chips.
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);

  // 1. Look for new card
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // 2. Card Found! Flash LED
  digitalWrite(2, HIGH);

  // 3. Read UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase(); // Format: "A1B2C3D4"

  Serial.print("🔹 Card Detected: ");
  Serial.println(uid);

  // 4. Send to Node.js Server
  sendToServer(uid);

  // 5. Cleanup & Cooldown
  digitalWrite(2, LOW);
  
  // Halt the card so we don't read it 50 times in one second
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  // Small delay to prevent spamming
  delay(1000); 
}

void sendToServer(String cardUid) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://" + serverIp + ":" + String(serverPort) + "/api/gate_detection";
    
    Serial.print("Uploading to " + url + "... ");
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    // Construct JSON Payload
    // { "uid": "A1B2C3D4", "gate_id": "ESP32_HALL_A" }
    StaticJsonDocument<200> doc;
    doc["uid"] = cardUid;
    doc["gate_id"] = gate_id;

    String requestBody;
    serializeJson(doc, requestBody);

    // Send POST Request
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      Serial.println("✅ Success! (Code: " + String(httpResponseCode) + ")");
      // String response = http.getString(); // Uncomment to see server reply
      // Serial.println(response);
    } else {
      Serial.println("❌ Failed. (Error: " + http.errorToString(httpResponseCode) + ")");
    }
    
    http.end(); // Close connection
  } else {
    Serial.println("⚠️ WiFi Disconnected");
  }
}