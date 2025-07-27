import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import * as Notifications from 'expo-notifications';
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

export default function MedicationList() {
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

  const saveMedications = async (meds: Medication[]) => {
    try {
      await AsyncStorage.setItem('medications', JSON.stringify(meds));
    } catch (error) {
      console.error('Error saving medications:', error);
    }
  };

  const deleteMedication = async (id: string) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication reminder?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedMedications = medications.filter(med => med.id !== id);
            setMedications(updatedMedications);
            await saveMedications(updatedMedications);

            // Cancel related notifications
            const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
            const medicationToDelete = medications.find(med => med.id === id);

            if (medicationToDelete) {
              allNotifications.forEach(async (notification) => {
                if (notification.content.body?.includes(medicationToDelete.name)) {
                  await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                }
              });
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Medications</Text>

      {medications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No medications added yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap the + button below to add your first medication reminder</Text>
        </View>
      ) : (
        <View style={styles.medicationsSection}>
          {medications.map((med) => (
            <View key={med.id} style={styles.medicationCard}>
              {med.imageUri && (
                <Image source={{ uri: med.imageUri }} style={styles.medicationImage} />
              )}
              <View style={styles.medicationInfo}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <Text style={styles.medicationDetail}>Dose: {med.dose}</Text>
                <Text style={styles.medicationDetail}>
                  Times: {med.scheduledTimes.join(', ')}
                </Text>
                <Text style={styles.medicationDetail}>Duration: {med.duration} days</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteMedication(med.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
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
    marginTop: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  medicationsSection: {
    marginTop: 20,
  },
  medicationCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  medicationImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  medicationInfo: {
    padding: 15,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  medicationDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});