import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Papa from 'papaparse';
import { API_URL } from '../config/api'; // Import your local server IP

export default function BuilderScreen({ navigation }) {
  const [eventName, setEventName] = useState('');
  const [venueID, setVenueID] = useState(''); 
  const [csvText, setCsvText] = useState('');

  const handleCreate = async () => {
    if(!eventName || !venueID || !csvText) {
      Alert.alert("Error", "Please fill in all fields (Name, Gate ID, CSV)");
      return;
    }

    // 1. Parse CSV
    const parsed = Papa.parse(csvText, { header: true });
    
    // 2. Normalize data for backend (Ensure uid and name exist)
    const students = parsed.data
      .filter(row => row.uid && row.name)
      .map(row => ({ uid: row.uid, name: row.name }));

    if(students.length === 0) {
        Alert.alert("Error", "CSV Invalid. Needs 'uid' and 'name' columns.");
        return;
    }

    // 3. Send to MongoDB (Server)
   try {
        console.log(`Sending to: ${API_URL}/api/exams`); // DEBUG LOG 1

        const response = await fetch(`${API_URL}/api/exams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: eventName,
                venueBSSID: venueID,
                students: students
            })
        });

        // --- NEW DEBUGGING BLOCK ---
        const text = await response.text(); // Get raw text first
        console.log("SERVER RESPONSE:", text); // Print it to your terminal
        
        // Try to parse it only if it looks like JSON
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error(`Server sent HTML instead of JSON. Check Terminal logs.`);
        }
        // ---------------------------

        if(response.ok) {
            Alert.alert("Success", `Exam Created!`);
            navigation.goBack();
        } else {
            throw new Error(result.error || "Server rejected request");
        }
    } catch (err) {
        console.error(err); // Look at this log!
        Alert.alert("Connection Error", err.message);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <Text style={styles.label}>EXAM TITLE</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Math Finals" 
        placeholderTextColor="#64748B" 
        value={eventName} 
        onChangeText={setEventName} 
      />

      <Text style={styles.label}>GATE / READER ID</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. ESP32_GATE_01" 
        placeholderTextColor="#64748B" 
        value={venueID} 
        onChangeText={setVenueID} 
      />

      <Text style={styles.label}>STUDENT CSV</Text>
      <Text style={styles.helper}>Format: uid,name</Text>
      <TextInput 
        style={[styles.input, styles.textArea]} 
        placeholder={`uid,name\nA1B2,Ali\nC3D4,Abu`} 
        placeholderTextColor="#64748B" 
        multiline 
        value={csvText} 
        onChangeText={setCsvText} 
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>CREATE EXAM</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  label: { color: '#2DD4BF', fontWeight: 'bold', marginBottom: 8, marginTop: 20, letterSpacing: 1 },
  helper: { color: '#64748B', fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: '#1E293B', color: 'white', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
  textArea: { height: 150, textAlignVertical: 'top' },
  button: { backgroundColor: '#2DD4BF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  buttonText: { color: '#0F172A', fontWeight: '900', fontSize: 16 }
});