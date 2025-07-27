
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
import { Audio } from 'expo-av';
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
    times: ['12:00 AM'],
    duration: 7,
    imageUri: '',
  });

  React.useEffect(() => {
    requestNotificationPermissions();
    setupNotificationCategories();
    
    // Configure notification handler for continuous alarm
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // NOTE: Notification response listener is handled in index.tsx to avoid conflicts
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

  const setupNotificationCategories = async () => {
    await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
      {
        identifier: 'STOP_ACTION',
        buttonTitle: '🛑 Stop',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'SNOOZE_ACTION',
        buttonTitle: '😴 Snooze 2min',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    // Category for snoozed notifications with dismiss option
    await Notifications.setNotificationCategoryAsync('MEDICATION_SNOOZED', [
      {
        identifier: 'DISMISS_ACTION',
        buttonTitle: '✅ Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  };

  // This function is exported to be used by the main notification handler in index.tsx
  const scheduleSnoozeNotification = async (originalData: any, currentNotificationId: string) => {
    const currentSnoozeCount = originalData.snoozeCount || 0;
    
    // Check if maximum snoozes reached
    if (currentSnoozeCount >= 7) {
      Alert.alert(
        '⚠️ Maximum Snoozes Reached',
        'You have reached the maximum number of snoozes (7) for this medication reminder. Please take your medication now.',
        [{ text: 'OK' }]
      );
      return;
    }

    const newSnoozeCount = currentSnoozeCount + 1;
    const snoozeId = originalData.snoozeId || `snooze_${originalData.medicationName}_${Date.now()}`;
    
    try {
      // Clear any existing notifications with same identifier first
      await Notifications.dismissNotificationAsync(currentNotificationId);
      
      // Create ONE snoozed notification
      await Notifications.scheduleNotificationAsync({
        identifier: currentNotificationId, // Reuse same ID
        content: {
          title: `⏰ SNOOZED (${newSnoozeCount}/7) - ${originalData.medicationName}`,
          body: `💊 ${originalData.medicationName}\n📋 Dose: ${originalData.dose}\n⏰ Original Time: ${originalData.scheduledTime}\n\n😴 Snoozed for 2 minutes...\n\nUse "Dismiss" to stop this reminder permanently.`,
          sound: false,
          priority: 'max',
          vibrate: [0, 100, 100],
          categoryIdentifier: 'MEDICATION_SNOOZED',
          data: {
            ...originalData,
            type: 'medication_reminder',
            shouldPlayAlarm: false,
            isSnooze: true,
            snoozeCount: newSnoozeCount,
            snoozeId: snoozeId,
            isSnoozeWaiting: true,
            originalNotificationId: currentNotificationId
          },
        },
        trigger: { seconds: 1 },
      });

      // After 2 minutes, update the same notification to alarm state
      setTimeout(async () => {
        try {
          await Notifications.dismissNotificationAsync(currentNotificationId);
          
          await Notifications.scheduleNotificationAsync({
            identifier: currentNotificationId, // Same ID again
            content: {
              title: `🚨 MEDICATION ALARM! (Snooze ${newSnoozeCount}/7)`,
              body: `💊 ${originalData.medicationName}\n📋 Dose: ${originalData.dose}\n⏰ Original Time: ${originalData.scheduledTime}\n\n🔔 Time to take your medication!\n\nThis is snooze #${newSnoozeCount} of 7.`,
              sound: true,
              priority: 'max',
              vibrate: [0, 250, 250, 250],
              categoryIdentifier: 'MEDICATION_REMINDER',
              data: {
                ...originalData,
                type: 'medication_reminder',
                shouldPlayAlarm: true,
                isSnooze: true,
                snoozeCount: newSnoozeCount,
                snoozeId: snoozeId,
                isSnoozeWaiting: false,
                originalNotificationId: currentNotificationId
              },
            },
            trigger: { seconds: 1 },
          });
          
          await playAlarmSound();
        } catch (error) {
          console.log('Error updating notification after snooze:', error);
        }
      }, 2 * 60 * 1000);
      
    } catch (error) {
      console.log('Error in snooze notification process:', error);
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
      times: [...formData.times, '12:00 AM'],
    });
  };

  const updateTime = (index: number, time: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = time;
    setFormData(prevData => ({ 
      ...prevData, 
      times: newTimes 
    }));
  };

  const formatTime = (hours: number, minutes: number) => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  const TimePickerComponent = ({ index }: { index: number }) => {
    const [showHourPicker, setShowHourPicker] = useState(false);
    const [showMinutePicker, setShowMinutePicker] = useState(false);
    
    // Get current time from form data
    const currentTime = formData.times[index] || '12:00 AM';
    
    // Parse current time to get individual components
    const parseTime = (timeString: string) => {
      if (!timeString) return { hour: 12, minute: 0, period: 'AM' };
      
      const parts = timeString.split(' ');
      if (parts.length !== 2) return { hour: 12, minute: 0, period: 'AM' };
      
      const [timePart, period] = parts;
      const timeParts = timePart.split(':');
      if (timeParts.length !== 2) return { hour: 12, minute: 0, period: 'AM' };
      
      const [hourStr, minuteStr] = timeParts;
      return {
        hour: parseInt(hourStr) || 12,
        minute: parseInt(minuteStr) || 0,
        period: period || 'AM'
      };
    };
    
    const { hour: selectedHour, minute: selectedMinute, period: selectedPeriod } = parseTime(currentTime);

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const periods = ['AM', 'PM'];

    // Update time handlers
    const handleHourSelect = (hour: number) => {
      const newTime = `${hour}:${selectedMinute.toString().padStart(2, '0')} ${selectedPeriod}`;
      updateTime(index, newTime);
      setShowHourPicker(false);
    };

    const handleMinuteSelect = (minute: number) => {
      const newTime = `${selectedHour}:${minute.toString().padStart(2, '0')} ${selectedPeriod}`;
      updateTime(index, newTime);
      setShowMinutePicker(false);
    };

    const handlePeriodSelect = (period: string) => {
      const newTime = `${selectedHour}:${selectedMinute.toString().padStart(2, '0')} ${period}`;
      updateTime(index, newTime);
    };

    return (
      <View style={styles.newTimePickerContainer}>
        <Text style={styles.timePickerLabel}>Time {index + 1}</Text>
        
        <View style={styles.timeDisplayContainer}>
          {/* Hour Display */}
          <TouchableOpacity 
            style={styles.timeSegment}
            onPress={() => {
              setShowMinutePicker(false);
              setShowHourPicker(!showHourPicker);
            }}
          >
            <Text style={styles.timeDisplayText}>
              {selectedHour.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.timeDisplaySeparator}>:</Text>

          {/* Minute Display */}
          <TouchableOpacity 
            style={styles.timeSegment}
            onPress={() => {
              setShowHourPicker(false);
              setShowMinutePicker(!showMinutePicker);
            }}
          >
            <Text style={styles.timeDisplayText}>
              {selectedMinute.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>

          {/* Period Toggle */}
          <View style={styles.periodToggleContainer}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodToggle,
                  selectedPeriod === period && styles.selectedPeriodToggle
                ]}
                onPress={() => handlePeriodSelect(period)}
              >
                <Text style={[
                  styles.periodToggleText,
                  selectedPeriod === period && styles.selectedPeriodToggleText
                ]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hour Picker Modal */}
        <Modal
          visible={showHourPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHourPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowHourPicker(false)}
          >
            <View style={styles.pickerModalContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Hour</Text>
                <TouchableOpacity onPress={() => setShowHourPicker(false)}>
                  <Text style={styles.pickerCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.pickerScrollView} 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.pickerOption,
                      selectedHour === hour && styles.selectedPickerOption
                    ]}
                    onPress={() => handleHourSelect(hour)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      selectedHour === hour && styles.selectedPickerOptionText
                    ]}>
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Minute Picker Modal */}
        <Modal
          visible={showMinutePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMinutePicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowMinutePicker(false)}
          >
            <View style={styles.pickerModalContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Minute</Text>
                <TouchableOpacity onPress={() => setShowMinutePicker(false)}>
                  <Text style={styles.pickerCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.pickerScrollView} 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.pickerOption,
                      selectedMinute === minute && styles.selectedPickerOption
                    ]}
                    onPress={() => handleMinuteSelect(minute)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      selectedMinute === minute && styles.selectedPickerOptionText
                    ]}>
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const scheduleNotifications = async (medication: Medication, isSnooze = false, snoozeMinutes = 0) => {
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

        // Add snooze time if this is a snooze notification
        if (isSnooze) {
          notificationDate.setMinutes(notificationDate.getMinutes() + snoozeMinutes);
        }

        // Only schedule future notifications
        if (notificationDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: isSnooze ? '⏰ MEDICATION SNOOZE REMINDER!' : '🚨 MEDICATION ALARM! 🚨',
              body: `💊 ${name}\n📋 Dose: ${dose}\n⏰ Time: ${time}${isSnooze ? ' (Snoozed)' : ''}\n📅 Day ${day + 1} of ${duration}`,
              sound: true,
              priority: 'max',
              vibrate: [0, 250, 250, 250],
              categoryIdentifier: 'MEDICATION_REMINDER',
              data: {
                medicationName: name,
                dose: dose,
                scheduledTime: time,
                day: day + 1,
                duration: duration,
                type: 'medication_reminder',
                shouldPlayAlarm: true,
                isSnooze: isSnooze
              },
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

  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);

  // Global reference for alarm sound management
  React.useRef<Audio.Sound | null>(null);
  const globalAlarmSound = React.useRef<Audio.Sound | null>(null);

  const playAlarmSound = async () => {
    try {
      // Stop any existing alarm first
      await stopAlarmSound();
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setAlarmSound(sound);
      globalAlarmSound.current = sound;
    } catch (error) {
      console.log('Error playing alarm sound:', error);
    }
  };

  const stopAlarmSoundImmediate = () => {
    // Immediate synchronous stop without await to prevent delays
    try {
      if (alarmSound) {
        alarmSound.stopAsync().catch(() => {});
        alarmSound.unloadAsync().catch(() => {});
        setAlarmSound(null);
      }
      
      if (globalAlarmSound.current) {
        globalAlarmSound.current.stopAsync().catch(() => {});
        globalAlarmSound.current.unloadAsync().catch(() => {});
        globalAlarmSound.current = null;
      }
    } catch (error) {
      console.log('Error stopping alarm sound immediately:', error);
    }
  };

  const stopAlarmSound = async () => {
    try {
      // Stop the current state alarm
      if (alarmSound) {
        await alarmSound.stopAsync();
        await alarmSound.unloadAsync();
        setAlarmSound(null);
      }
      
      // Stop the global reference alarm
      if (globalAlarmSound.current) {
        await globalAlarmSound.current.stopAsync();
        await globalAlarmSound.current.unloadAsync();
        globalAlarmSound.current = null;
      }
    } catch (error) {
      console.log('Error stopping alarm sound:', error);
    }
  };

  const testNotification = async () => {
    // Show notification with action buttons first
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 MEDICATION ALARM TEST!',
        body: '💊 Test Medicine\n📋 Dose: 1 tablet\n⏰ Time: Now\n\nUse the buttons below to test Stop/Snooze',
        sound: true,
        priority: 'high',
        vibrate: [0, 250, 250, 250],
        categoryIdentifier: 'MEDICATION_REMINDER',
        data: {
          type: 'medication_reminder',
          medicationName: 'Test Medicine',
          dose: '1 tablet',
          scheduledTime: 'Now',
          day: 1,
          duration: 1,
          shouldPlayAlarm: true
        },
      },
      trigger: {
        seconds: 1,
      },
    });

    // Start alarm sound after a short delay to sync with notification
    setTimeout(async () => {
      await playAlarmSound();
    }, 1000);

    // Auto-stop after 30 seconds if not manually stopped
    setTimeout(() => {
      stopAlarmSound();
    }, 30000);
  };

  const addMedication = async () => {
    if (!formData.name || !formData.dose || formData.times.some(t => !t)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate time format
    const timePattern = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;
    for (const time of formData.times) {
      if (!time || !timePattern.test(time)) {
        Alert.alert('Error', 'Please set all medication times using the time pickers');
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
          <TimePickerComponent key={`${index}-${time}`} index={index} />
        ))}

        <TouchableOpacity style={styles.addTimeButton} onPress={addTimeSlot}>
          <Text style={styles.addTimeText}>+ Add Another Time</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testNotification}>
          <Text style={styles.testButtonText}>🔔 Test Medication Alarm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopAlarmButton} onPress={stopAlarmSoundImmediate}>
          <Text style={styles.stopAlarmButtonText}>🛑 Stop Test Alarm</Text>
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
  newTimePickerContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  timeSegment: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    minWidth: 40,
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timeDisplaySeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  periodToggleContainer: {
    marginLeft: 15,
    flexDirection: 'column',
  },
  periodToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    marginVertical: 1,
    borderRadius: 4,
    alignItems: 'center',
    minWidth: 32,
  },
  selectedPeriodToggle: {
    backgroundColor: '#007AFF',
  },
  periodToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  selectedPeriodToggleText: {
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pickerCloseButton: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 5,
  },
  pickerScrollView: {
    maxHeight: 300,
    flexGrow: 0,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedPickerOption: {
    backgroundColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  selectedPickerOptionText: {
    color: 'white',
  },
  testButton: {
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stopAlarmButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  stopAlarmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
