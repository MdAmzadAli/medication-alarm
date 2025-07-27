
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Medication {
  id: string;
  name: string;
  dose: string;
  timesPerDay: number;
  scheduledTimes: string[];
  duration: number; // days
  startDate: string;
}

export default function MedicationReminder() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    dose: '',
    timesPerDay: 1,
    times: [''],
    duration: 7,
  });

  useEffect(() => {
    registerForPushNotificationsAsync();
    loadMedications();
  }, []);

  const registerForPushNotificationsAsync = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  };

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

  const saveMedications = async (meds: Medication[]) => {
    try {
      await AsyncStorage.setItem('medications', JSON.stringify(meds));
    } catch (error) {
      console.error('Error saving medications:', error);
    }
  };

  const addTimeSlot = () => {
    setFormData({
      ...formData,
      timesPerDay: formData.timesPerDay + 1,
      times: [...formData.times, ''],
    });
  };

  const updateTime = (index: number, time: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = time;
    setFormData({ ...formData, times: newTimes });
  };

  const scheduleNotifications = async (medication: Medication) => {
    const { name, dose, scheduledTimes, duration, startDate } = medication;

    for (let day = 0; day < duration; day++) {
      for (const time of scheduledTimes) {
        const [hours, minutes] = time.split(':').map(Number);
        const notificationDate = new Date(startDate);
        notificationDate.setDate(notificationDate.getDate() + day);
        notificationDate.setHours(hours, minutes, 0, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Medication Reminder',
            body: `Time to take ${name} - ${dose}`,
            sound: true,
          },
          trigger: notificationDate,
        });
      }
    }
  };

  const addMedication = async () => {
    if (!formData.name || !formData.dose || formData.times.some(t => !t)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const newMedication: Medication = {
      id: Date.now().toString(),
      name: formData.name,
      dose: formData.dose,
      timesPerDay: formData.timesPerDay,
      scheduledTimes: formData.times.filter(t => t),
      duration: formData.duration,
      startDate: new Date().toISOString(),
    };

    const updatedMedications = [...medications, newMedication];
    setMedications(updatedMedications);
    await saveMedications(updatedMedications);
    await scheduleNotifications(newMedication);

    // Reset form
    setFormData({
      name: '',
      dose: '',
      timesPerDay: 1,
      times: [''],
      duration: 7,
    });

    Alert.alert('Success', 'Medication reminder added successfully!');
  };

  const deleteMedication = async (id: string) => {
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
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Medication Reminder</Text>
      
      <View style={styles.form}>
        <Text style={styles.label}>Medicine Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Enter medicine name"
        />

        <Text style={styles.label}>Dose Amount</Text>
        <TextInput
          style={styles.input}
          value={formData.dose}
          onChangeText={(text) => setFormData({ ...formData, dose: text })}
          placeholder="e.g., 1 tablet, 2 spoons"
        />

        <Text style={styles.label}>Duration (days)</Text>
        <TextInput
          style={styles.input}
          value={formData.duration.toString()}
          onChangeText={(text) => setFormData({ ...formData, duration: parseInt(text) || 7 })}
          placeholder="Number of days"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Scheduled Times</Text>
        {formData.times.map((time, index) => (
          <TextInput
            key={index}
            style={styles.input}
            value={time}
            onChangeText={(text) => updateTime(index, text)}
            placeholder="HH:MM (e.g., 08:00, 14:30)"
          />
        ))}

        <TouchableOpacity style={styles.addTimeButton} onPress={addTimeSlot}>
          <Text style={styles.addTimeText}>+ Add Another Time</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={addMedication}>
          <Text style={styles.submitText}>Add Medication</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.medicationsSection}>
        <Text style={styles.sectionTitle}>Current Medications</Text>
        {medications.map((med) => (
          <View key={med.id} style={styles.medicationCard}>
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
        ))}
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
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  addTimeButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  addTimeText: {
    color: 'white',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  medicationsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  medicationCard: {
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
