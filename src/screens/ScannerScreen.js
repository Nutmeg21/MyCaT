import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config/api';

export default function ScannerScreen({ route }) {
  const { event } = route.params;
  const [userData, setUserData] = useState(null);
  const [status, setStatus] = useState("WAITING FOR SCAN");
  const [statusColor, setStatusColor] = useState("#334155");

  useEffect(() => {
    // Check for new scans every 2 seconds
    const interval = setInterval(checkForScan, 2000);
    return () => clearInterval(interval);
  }, []);

  const checkForScan = async () => {
    try {
      // 1. Ask Server: "Who scanned recently?"
      const response = await fetch(`${API_URL}/api/attendance/latest`);
      
      // If server sends empty response (null), skip
      const text = await response.text();
      if(!text) return; 
      
      const data = JSON.parse(text);

      // 2. Check if data is "fresh" (scanned in last 5 seconds)
      if (data && data.timestamp) {
        const isFresh = (Date.now() - new Date(data.timestamp).getTime()) < 5000;
        
        if (isFresh) {
            setUserData(data);
            if(data.status === 'VERIFIED') {
                setStatus("MATCH CONFIRMED");
                setStatusColor("#2DD4BF");
            } else {
                setStatus("ACCESS DENIED");
                setStatusColor("#EF4444");
            }
        }
      }
    } catch (error) {
      console.log("Polling error:", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBox, { backgroundColor: statusColor }]}>
        <Ionicons 
          name={status.includes("MATCH") ? "checkmark-circle" : status.includes("DENIED") ? "alert-circle" : "scan-circle"} 
          size={40} 
          color={status.includes("WAITING") ? "#94A3B8" : "#0F172A"} 
        />
        <Text style={[styles.statusText, { color: status.includes("WAITING") ? "#94A3B8" : "#0F172A" }]}>
          {status}
        </Text>
      </View>

      {userData ? (
        <ScrollView contentContainerStyle={styles.profileContainer}>
          <Image 
            source={{ uri: userData.photo_url || 'https://via.placeholder.com/150' }} 
            style={styles.profileImage} 
          />
          <Text style={styles.userName}>{userData.name}</Text>
          <Text style={styles.icNumber}>{userData.uid}</Text>
          <Text style={{color:'#ccc', marginTop: 10}}>{userData.exam_title}</Text>
        </ScrollView>
      ) : (
        <View style={styles.idleContainer}>
            <Text style={styles.idleText}>Listening to {event.venueBSSID}...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  statusBox: { borderRadius: 12, padding: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusText: { fontSize: 22, fontWeight: '900', marginTop: 10, letterSpacing: 2 },
  profileContainer: { alignItems: 'center' },
  profileImage: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: '#2DD4BF', marginBottom: 20 },
  userName: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  icNumber: { color: '#94A3B8', fontSize: 18, marginTop: 5, letterSpacing: 1 },
  idleContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  idleText: { color: '#334155', fontSize: 16, letterSpacing: 1 }
});