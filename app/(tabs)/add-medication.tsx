
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
  Platform,
  Modal,
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

  React.useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Notification Permission',
        'Please enable notifications to receive medication reminders.',
        [{ text: 'OK' }]
      );
    }
  };

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

  const formatTime = (hours: number, minutes: number) => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [tempHour, setTempHour] = useState(8);
  const [tempMinute, setTempMinute] = useState(0);
  const [tempPeriod, setTempPeriod] = useState('AM');

  const showTimePicker = (index: number) => {
    setSelectedTimeIndex(index);
    const currentTime = formData.times[index];
    if (currentTime) {
      const [timePart, period] = currentTime.split(' ');
      const [hours, minutes] = timePart.split(':').map(Number);
      setTempHour(hours);
      setTempMinute(minutes);
      setTempPeriod(period);
    }
    setTimePickerVisible(true);
  };

  const confirmTime = () => {
    const time = `${tempHour}:${tempMinute.toString().padStart(2, '0')} ${tempPeriod}`;
    updateTime(selectedTimeIndex, time);
    setTimePickerVisible(false);
  };

  const TimePickerModal = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 5-minute intervals
    const periods = ['AM', 'PM'];

    return (
      <Modal
        visible={timePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>Select Time</Text>
            
            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        tempHour === hour && styles.selectedPickerItem
                      ]}
                      onPress={() => setTempHour(hour)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        tempHour === hour && styles.selectedPickerItemText
                      ]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        tempMinute === minute && styles.selectedPickerItem
                      ]}
                      onPress={() => setTempMinute(minute)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        tempMinute === minute && styles.selectedPickerItemText
                      ]}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Period</Text>
                <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
                  {periods.map((period) => (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.pickerItem,
                        tempPeriod === period && styles.selectedPickerItem
                      ]}
                      onPress={() => setTempPeriod(period)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        tempPeriod === period && styles.selectedPickerItemText
                      ]}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmTime}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const scheduleNotifications = async (medication: Medication) => {
    const { name, dose, scheduledTimes, duration } = medication;

    for (let day = 0; day < duration; day++) {
      for (const time of scheduledTimes) {
        const [timePart, period] = time.split(' ');
        const [hours, minutes] = timePart.split(':').map(Number);
        
        // Convert to 24-hour format
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) {
          hour24 = hours + 12;
        } else if (period === 'AM' && hours === 12) {
          hour24 = 0;
        }

        const notificationDate = new Date();
        notificationDate.setDate(notificationDate.getDate() + day);
        notificationDate.setHours(hour24, minutes, 0, 0);

        // Only schedule future notifications
        if (notificationDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Medication Reminder',
              body: `Time to take ${name} - ${dose}`,
              sound: true,
            },
            trigger: {
              type: 'date',
              date: notificationDate,
            },
          });
        }
      }
    }
  };

  const addMedication = async () => {
    if (!formData.name || !formData.dose || formData.times.some(t => !t)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate time format
    const timePattern = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;
    for (const time of formData.times) {
      if (!timePattern.test(time)) {
        Alert.alert('Error', 'Please enter time in format: HH:MM AM/PM (e.g., 8:30 AM, 2:15 PM)');
        return;
      }
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
      <TimePickerModal />
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
          <View key={index} style={styles.timeInputContainer}>
            <TouchableOpacity 
              style={[styles.input, styles.timeDisplayButton]}
              onPress={() => showTimePicker(index)}
            >
              <Text style={[styles.timeDisplayText, !time && styles.placeholderText]}>
                {time || 'Tap to select time'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => showTimePicker(index)}
            >
              <Text style={styles.timePickerText}>🕐</Text>
            </TouchableOpacity>
          </View>
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
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timeInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  timePickerButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  timePickerText: {
    fontSize: 20,
  },
  timeDisplayButton: {
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderColor: '#007AFF',
  },
  timeDisplayText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 200,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    maxHeight: 160,
  },
  pickerItem: {
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedPickerItem: {
    backgroundColor: '#007AFF',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPickerItemText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
