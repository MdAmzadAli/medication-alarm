
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MedicationHistory {
  id: string;
  name: string;
  dose: string;
  takenAt: string;
  scheduledTime: string;
}

export default function MedicationHistory() {
  const [history, setHistory] = useState<MedicationHistory[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('medicationHistory');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Medication History</Text>
      
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No medication history yet</Text>
          <Text style={styles.emptySubtext}>
            Your medication intake history will appear here
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {history.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.medicationName}>{item.name}</Text>
              <Text style={styles.dose}>Dose: {item.dose}</Text>
              <Text style={styles.scheduledTime}>
                Scheduled: {item.scheduledTime}
              </Text>
              <Text style={styles.takenTime}>
                Taken: {formatDate(item.takenAt)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  historyList: {
    marginTop: 20,
  },
  historyCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  dose: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  scheduledTime: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 3,
  },
  takenTime: {
    fontSize: 14,
    color: '#34C759',
  },
});
