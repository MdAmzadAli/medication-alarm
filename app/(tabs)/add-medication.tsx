
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

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

export default function AddMedication() {
  const [formData, setFormData] = useState({
    name: '',
    dose: '',
    timesPerDay: 1,
    times: [''],
    duration: 7,
    imageUri: '',
  });

  const pickImage = async () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add the medicine image',
      [
        {
          text: 'Camera',
          onPress: openCamera,
        },
        {
          text: 'Gallery',
          onPress: openGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, imageUri: result.assets[0].uri });
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, imageUri: result.assets[0].uri });
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
      imageUri: formData.imageUri,
    };

    try {
      const stored = await AsyncStorage.getItem('medications');
      const medications = stored ? JSON.parse(stored) : [];
      const updatedMedications = [...medications, newMedication];
      await AsyncStorage.setItem('medications', JSON.stringify(updatedMedications));
      await scheduleNotifications(newMedication);

      Alert.alert('Success', 'Medication reminder added successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Medication</Text>
      
      <View style={styles.form}>
        <Text style={styles.label}>Medicine Image</Text>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          {formData.imageUri ? (
            <Image source={{ uri: formData.imageUri }} style={styles.medicineImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>📷 Add Photo</Text>
              <Text style={styles.imagePlaceholderSubtext}>Tap to take photo or select from gallery</Text>
            </View>
          )}
        </TouchableOpacity>

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
  imageButton: {
    marginBottom: 15,
  },
  medicineImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  imagePlaceholderText: {
    fontSize: 24,
    marginBottom: 5,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
});
