import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../config/api';

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = async () => {
    try {
      const response = await fetch(`${API_URL}/api/exams`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.log("Connection Error (Is server running?)");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExams();
    }, [])
  );

  const renderEventCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('Scanner', { event: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Ionicons name="chevron-forward" size={24} color="#2DD4BF" />
      </View>
      <View style={styles.badgeContainer}>
        <Text style={styles.statusText}>• {item.venueBSSID}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.logo}>MyCaT</Text>
        <Text style={styles.subLogo}>Malaysian Card Tracker</Text>
      </View>

      <Text style={styles.sectionTitle}>SELECT ACTIVE EXAM</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2DD4BF" />
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item._id || item.examId}
          renderItem={renderEventCard}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchExams} />}
          ListEmptyComponent={
            <Text style={{color: '#64748B', textAlign: 'center', marginTop: 20}}>
                No exams found. Tap + to create.
            </Text>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('Builder')}
      >
        <Ionicons name="add" size={30} color="#0F172A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F172A', 
    padding: 20 
  },
  headerContainer: { 
    marginBottom: 30, 
    marginTop: 10 
  },
  logo: { 
    fontSize: 40, 
    fontWeight: 'bold', // SAFE
    color: '#F8FAFC', 
    // letterSpacing removed
  },
  subLogo: { 
    color: '#94A3B8', 
    fontSize: 12, 
    marginTop: 5
    // letterSpacing removed
  },
  sectionTitle: { 
    color: '#2DD4BF', 
    fontSize: 14, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    // letterSpacing removed
  },
  card: { 
    backgroundColor: '#1E293B', 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 15, 
    borderLeftWidth: 4, 
    borderLeftColor: '#2DD4BF',
    // elevation removed
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  cardTitle: { 
    color: '#F8FAFC', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  badgeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  statusText: { 
    color: '#2DD4BF', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    backgroundColor: '#2DD4BF', 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    // elevation removed
  }
});