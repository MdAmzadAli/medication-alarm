
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

interface Medication {
  id: string;
  name: string;
  dose: string;
  timesPerDay: number;
  scheduledTimes: string[];
  duration: number;
  startDate: string;
  imageUri?: string;
}

export default function MedicationHistory() {
  const [medications, setMedications] = useState<Medication[]>([]);

  const loadMedications = async () => {
    try {
      const stored = await AsyncStorage.getItem('medications');
      if (stored) {
        setMedications(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadMedications();
    }, [])
  );

  const isExpired = (medication: Medication) => {
    const startDate = new Date(medication.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + medication.duration);
    return new Date() > endDate;
  };

  const activeMedications = medications.filter(med => !isExpired(med));
  const expiredMedications = medications.filter(med => isExpired(med));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Medication History</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Medications ({activeMedications.length})</Text>
        {activeMedications.length === 0 ? (
          <Text style={styles.emptyText}>No active medications</Text>
        ) : (
          activeMedications.map((med) => (
            <View key={med.id} style={styles.medicationItem}>
              <Text style={styles.medicationName}>{med.name}</Text>
              <Text style={styles.medicationDetail}>
                Started: {new Date(med.startDate).toLocaleDateString()}
              </Text>
              <Text style={styles.medicationDetail}>
                Duration: {med.duration} days
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completed Medications ({expiredMedications.length})</Text>
        {expiredMedications.length === 0 ? (
          <Text style={styles.emptyText}>No completed medications</Text>
        ) : (
          expiredMedications.map((med) => (
            <View key={med.id} style={[styles.medicationItem, styles.expiredItem]}>
              <Text style={styles.medicationName}>{med.name}</Text>
              <Text style={styles.medicationDetail}>
                Started: {new Date(med.startDate).toLocaleDateString()}
              </Text>
              <Text style={styles.medicationDetail}>
                Completed: {new Date(new Date(med.startDate).getTime() + med.duration * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>
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
    marginTop: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  medicationItem: {
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
  expiredItem: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  medicationDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
});
