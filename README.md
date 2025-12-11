# MyCaT aka Malaysian Card Tracker
# IoT-Enabled Biometric Attendance & Verification System

## Description: A full-stack security solution designed to modernize entry management. The system consists of three interconnected layers:

1. Hardware Edge Node: An ESP32 microcontroller with an RC522 RFID module that captures physical ID tokens and transmits UID data via WiFi.

2. Centralized Backend: A Node.js and Express REST API backed by MongoDB, handling real-time event logic, anti-cheat timestamp validation, and role-based access control.

3. Mobile Client: A React Native (Expo) application that acts as a secure admin terminal. It utilizes a high-frequency polling architecture to receive real-time scans, displaying user biodata and simulated AI face verification for secondary authentication.

Key Tech Stack: C++ (Embedded), JavaScript (Node.js), React Native, MongoDB.
