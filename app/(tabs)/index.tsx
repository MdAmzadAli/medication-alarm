import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface Medication {
  id: string;
  name: string;
  dose: string;
  timesPerDay: number;
  scheduledTimes: string[];
  duration: number;
  startDate: string;
  imageUri?: string;
  isLiked?: boolean;
}

export default function Home() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [customRingtone, setCustomRingtone] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Form data for adding new medication
  const [formData, setFormData] = useState({
    name: '',
    dose: '',
    timesPerDay: 1,
    times: ['12:00 PM'],
    duration: 7,
    imageUri: '',
  });

  // Keep track of individual alarm sounds by notification ID
  const notificationAlarms = React.useRef<Map<string, Audio.Sound>>(new Map());

  // Keep track of all active sound instances
  const activeSounds = React.useRef<Set<Audio.Sound>>(new Set());

  useEffect(() => {
    loadMedications();
    setupNotificationCategories();
    loadSettings();

    // Listen for notifications when app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      if (notification.request.content.data?.shouldPlayAlarm) {
        const notificationId = notification.request.identifier;
        playNotificationAlarm(notificationId);
      }
    });

    // Listen for notification dismissals (when user swipes away notification)
    const dismissalListener = Notifications.addNotificationReceivedListener(notification => {
      // Check if this is a medication reminder that might have alarm
      if (notification.request.content.data?.shouldPlayAlarm || notification.request.content.data?.type === 'medication_reminder') {
        const notificationId = notification.request.identifier;
        console.log(`Medication notification received: ${notificationId}, setting up dismissal detection`);

        // Use a single, more frequent check with immediate response
        let isCheckingDismissal = true;
        const dismissalCheckInterval = setInterval(() => {
          if (!isCheckingDismissal) {
            clearInterval(dismissalCheckInterval);
            return;
          }

          Notifications.getPresentedNotificationsAsync().then(presentedNotifications => {
            const isStillPresented = presentedNotifications.some(
              presented => presented.request.identifier === notificationId
            );

            if (!isStillPresented) {
              console.log(`Notification ${notificationId} dismissed by swipe - stopping alarm IMMEDIATELY`);
              isCheckingDismissal = false;
              clearInterval(dismissalCheckInterval);
              // IMMEDIATE stop without any delays
              stopSpecificNotificationAlarm(notificationId);
            }
          }).catch(() => {});
        }, 300); // Check every 300ms for faster response

        // Stop checking after 30 seconds to prevent memory leaks
        setTimeout(() => {
          isCheckingDismissal = false;
          clearInterval(dismissalCheckInterval);
        }, 30000);
      }
    });

    // Listen for notification interactions
    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const notificationData = notification.request.content.data;

      if (notificationData?.type === 'medication_reminder') {
        if (actionIdentifier === 'STOP_ACTION') {
          // STOP only this specific notification's alarm
          const notificationId = notification.request.identifier;
          console.log(`STOP ACTION: Stopping alarm for notification ${notificationId}`);
          stopSpecificNotificationAlarm(notificationId);
          // Stop alarm and dismiss notification completely
          await Notifications.dismissNotificationAsync(notification.request.identifier);

          // Cancel any pending snooze alarms for this medication
          if (notificationData.snoozeId) {
            const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
            for (const scheduledNotif of allNotifications) {
              if (scheduledNotif.content.data?.snoozeId === notificationData.snoozeId) {
                await Notifications.cancelScheduledNotificationAsync(scheduledNotif.identifier);
              }
            }
          }

          Alert.alert(
            '✅ Alarm Stopped',
            `Medication reminder for ${notificationData.medicationName} has been stopped completely.`,
            [{ text: 'OK' }]
          );

        } else if (actionIdentifier === 'SNOOZE_ACTION') {
          // IMMEDIATELY stop this specific alarm
          const notificationId = notification.request.identifier;
          console.log(`SNOOZE ACTION: Stopping alarm for notification ${notificationId}`);
          stopSpecificNotificationAlarm(notificationId);

          // Don't dismiss here - let scheduleSnoozeNotification handle it
          await scheduleSnoozeNotification(notificationData, notificationId);

        } else if (actionIdentifier === 'DISMISS_ACTION') {
          // IMMEDIATELY stop this specific alarm
          const notificationId = notification.request.identifier;
          console.log(`DISMISS ACTION: Stopping alarm for notification ${notificationId}`);
          stopSpecificNotificationAlarm(notificationId);
          // Dismiss snoozed notification permanently
          await Notifications.dismissNotificationAsync(notification.request.identifier);

          // Cancel any pending snooze alarms for this medication
          if (notificationData.snoozeId) {
            const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
            for (const scheduledNotif of allNotifications) {
              if (scheduledNotif.content.data?.snoozeId === notificationData.snoozeId) {
                await Notifications.cancelScheduledNotificationAsync(scheduledNotif.identifier);
              }
            }
          }

          Alert.alert(
            '✅ Reminder Dismissed',
            `Snoozed reminder for ${notificationData.medicationName} has been dismissed permanently.`,
            [{ text: 'OK' }]
          );

        } else {
          // Default tap action - IMMEDIATELY stop this specific alarm
          const notificationId = notification.request.identifier;
          console.log(`TAP ACTION: Stopping alarm for notification ${notificationId}`);
          stopSpecificNotificationAlarm(notificationId);

          if (notificationData.isSnoozeWaiting) {
            // If it's a waiting snooze notification, show info
            Alert.alert(
              'Snoozed Reminder',
              `This reminder is snoozed. It will ring again in a moment.\n\nUse "Dismiss Alarm" to stop it permanently.`,
              [{ text: 'OK' }]
            );
          } else {
            // Regular medication reminder tap
            Alert.alert(
              'Medication Reminder',
              `Time to take your ${notificationData.medicationName}!\nDose: ${notificationData.dose}`,
              [{ text: 'Taken', onPress: () => {} }]
            );
          }
        }
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      dismissalListener.remove();
    };
  }, []);

  const playNotificationAlarm = async (notificationId: string) => {
    try {
      // Stop any existing alarm for this specific notification first
      stopSpecificNotificationAlarm(notificationId);

      const alarmUri = customRingtone || 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
      const { sound } = await Audio.Sound.createAsync(
        { uri: alarmUri },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );

      // Track this sound instance by notification ID
      notificationAlarms.current.set(notificationId, sound);
      activeSounds.current.add(sound);
      setAlarmSound(sound);

      console.log(`Started alarm for notification: ${notificationId}`);

      // Auto-stop after 60 seconds only
      setTimeout(() => {
        stopSpecificNotificationAlarm(notificationId);
      }, 60000);
    } catch (error) {
      console.log('Error playing alarm sound:', error);
    }
  };

  const stopSpecificNotificationAlarm = (notificationId: string) => {
    try {
      const sound = notificationAlarms.current.get(notificationId);
      if (sound) {
        // IMMEDIATE synchronous stop operations
        try {
          sound.stopAsync();
          sound.unloadAsync();
        } catch (e) {
          // Ignore errors for immediate response
        }

        // Remove from tracking maps immediately
        notificationAlarms.current.delete(notificationId);
        activeSounds.current.delete(sound);

        // If this was the current alarmSound, clear it immediately
        if (alarmSound === sound) {
          setAlarmSound(null);
        }

        console.log(`Stopped alarm for notification: ${notificationId}`);
      } else {
        console.log(`No alarm found for notification: ${notificationId}`);
      }
    } catch (error) {
      console.log(`Error stopping alarm for notification ${notificationId}:`, error);
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

      // Create ONE snoozed notification using the same ID
      await Notifications.scheduleNotificationAsync({
        identifier: currentNotificationId, // Reuse same ID to prevent duplicates
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

      // After 2 minutes, update the same notification to alarm state with FULL functionality
      setTimeout(async () => {
        try {
          await Notifications.dismissNotificationAsync(currentNotificationId);

          // Restore full notification with ALL original buttons
          await Notifications.scheduleNotificationAsync({
            identifier: currentNotificationId, // Same ID to replace existing
            content: {
              title: `🚨 MEDICATION ALARM! (Snooze ${newSnoozeCount}/7)`,
              body: `💊 ${originalData.medicationName}\n📋 Dose: ${originalData.dose}\n⏰ Original Time: ${originalData.scheduledTime}\n\n🔔 Time to take your medication!\n\nThis is snooze #${newSnoozeCount} of 7.`,
              sound: true,
              priority: 'max',
              vibrate: [0, 250, 250, 250],
              categoryIdentifier: 'MEDICATION_REMINDER', // Use original category for full buttons
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

          await playNotificationAlarm(currentNotificationId);
        } catch (error) {
          console.log('Error updating notification after snooze:', error);
        }
      }, 2 * 60 * 1000);

    } catch (error) {
      console.log('Error in snooze notification process:', error);
    }
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

  const toggleLike = async (id: string) => {
    const updatedMedications = medications.map(med => 
      med.id === id ? { ...med, isLiked: !med.isLiked } : med
    );
    setMedications(updatedMedications);
    await saveMedications(updatedMedications);
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

  const openEditModal = (medication: Medication) => {
    setEditingMedication(medication);
    setShowEditModal(true);
  };

  const updateMedication = async () => {
    if (!editingMedication) return;

    const updatedMedications = medications.map(med => 
      med.id === editingMedication.id ? editingMedication : med
    );
    setMedications(updatedMedications);
    await saveMedications(updatedMedications);
    setShowEditModal(false);
    setEditingMedication(null);
    Alert.alert('Success', 'Medication updated successfully!');
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
          const notificationId = `medication_${medication.id}_${day}_${time}`; // Create unique ID

          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
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
                isSnooze: isSnooze,
                notificationId: notificationId, // Include ID
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
      isLiked: false,
    };

    try {
      const updatedMedications = [...medications, newMedication];
      setMedications(updatedMedications);
      await saveMedications(updatedMedications);
      await scheduleNotifications(newMedication);

      // Reset form and close modal
      setFormData({
        name: '',
        dose: '',
        timesPerDay: 1,
        times: ['12:00 PM'],
        duration: 7,
        imageUri: '',
      });
      setShowAddModal(false);

      Alert.alert('Success', 'Medication reminder added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication');
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

  const pickImageForEdit = async () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add the medicine image',
      [
        {
          text: 'Camera',
          onPress: openCameraForEdit,
        },
        {
          text: 'Gallery',
          onPress: openGalleryForEdit,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCameraForEdit = async () => {
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

    if (!result.canceled && editingMedication) {
      setEditingMedication({ ...editingMedication, imageUri: result.assets[0].uri });
    }
  };

  const openGalleryForEdit = async () => {
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

    if (!result.canceled && editingMedication) {
      setEditingMedication({ ...editingMedication, imageUri: result.assets[0].uri });
    }
  };

  const pickCustomRingtone = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const audioFile = result.assets[0];
        setCustomRingtone(audioFile.uri);
        await AsyncStorage.setItem('customRingtone', audioFile.uri);
        Alert.alert('Success', 'Custom ringtone selected successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
      console.log('Error picking ringtone:', error);
    }
  };

  const testCustomRingtone = async () => {
    if (!customRingtone) {
      Alert.alert('No Ringtone', 'Please select a custom ringtone first.');
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: customRingtone },
        { shouldPlay: true, volume: 1.0 }
      );

      // Stop after 3 seconds
      setTimeout(async () => {
        await sound.stopAsync();
        await sound.unloadAsync();
      }, 3000);

    } catch (error) {
      Alert.alert('Error', 'Failed to play custom ringtone. The file might be corrupted or unsupported.');
      console.log('Error testing ringtone:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedRingtone = await AsyncStorage.getItem('customRingtone');
      const savedDarkMode = await AsyncStorage.getItem('isDarkMode');

      if (savedRingtone) {
        setCustomRingtone(savedRingtone);
      }
      if (savedDarkMode) {
        setIsDarkMode(JSON.parse(savedDarkMode));
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
      if (customRingtone) {
        await AsyncStorage.setItem('customRingtone', customRingtone);
      }
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Medications</Text>

        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No medications added yet</Text>
            <Text style={styles.emptyStateSubtext}>Tap the + button below to add your first medication reminder</Text>
          </View>
        ) : (
          <View style={styles.medicationsSection}>
            {medications.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.medicationCard}
                onPress={() => {
                  setSelectedMedication(med);
                  setShowDetailModal(true);
                }}
              >
                {med.imageUri && (
                  <Image source={{ uri: med.imageUri }} style={styles.medicationImage} />
                )}
                <View style={styles.medicationInfo}>
                  <View style={styles.medicationHeader}>
                    <Text style={styles.medicationName}>{med.name}</Text>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openEditModal(med)}
                      >
                        <Text style={styles.editIcon}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => toggleLike(med.id)}
                      >
                        <Text style={styles.likeIcon}>
                          {med.isLiked ? '❤️' : '🤍'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.medicationDetail}>Dose: {med.dose}</Text>
                  <Text style={styles.medicationDetail}>
                    Times: {med.scheduledTimes.join(', ')}
                  </Text>
                  <Text style={styles.medicationDetail}>Duration: {med.duration} days</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* Add Medication Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Medication</Text>
            <View style={styles.placeholder} />
          </View>

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
                onChangeText={(text) => {
                  const newTimes = [...formData.times];
                  newTimes[index] = text;
                  setFormData({ ...formData, times: newTimes });
                }}
                placeholder="12:00 PM"
              />
            ))}

            <TouchableOpacity
              style={styles.addTimeButton}
              onPress={() => {
                setFormData({
                  ...formData,
                  timesPerDay: formData.timesPerDay + 1,
                  times: [...formData.times, '12:00 PM'],
                });
              }}
            >
              <Text style={styles.addTimeText}>+ Add Another Time</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={addMedication}>
              <Text style={styles.submitText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Edit Medication Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        {editingMedication && (
          <ScrollView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Medication</Text>
              <TouchableOpacity onPress={() => deleteMedication(editingMedication.id)}>
                <Text style={styles.deleteButton}>🗑️</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Medicine Image</Text>
              <TouchableOpacity style={styles.imageButton} onPress={pickImageForEdit}>
                {editingMedication.imageUri ? (
                  <Image source={{ uri: editingMedication.imageUri }} style={styles.medicineImage} />
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
                value={editingMedication.name}
                onChangeText={(text) => setEditingMedication({ ...editingMedication, name: text })}
                placeholder="Enter medicine name"
              />

              <Text style={styles.label}>Dose Amount</Text>
              <TextInput
                style={styles.input}
```text
                value={editingMedication.dose}
                onChangeText={(text) => setEditingMedication({ ...editingMedication, dose: text })}
                placeholder="e.g., 1 tablet, 2 spoons"
              />

              <Text style={styles.label}>Duration (days)</Text>
              <TextInput
                style={styles.input}
                value={editingMedication.duration.toString()}
                onChangeText={(text) => setEditingMedication({ ...editingMedication, duration: parseInt(text) || 7 })}
                placeholder="Number of days"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Scheduled Times</Text>
              {editingMedication.scheduledTimes.map((time, index) => (
                <TextInput
                  key={index}
                  style={styles.input}
                  value={time}
                  onChangeText={(text) => {
                    const newTimes = [...editingMedication.scheduledTimes];
                    newTimes[index] = text;
                    setEditingMedication({ ...editingMedication, scheduledTimes: newTimes });
                  }}
                  placeholder="12:00 PM"
                />
              ))}

              <TouchableOpacity style={styles.submitButton} onPress={updateMedication}>
                <Text style={styles.submitText}>Update Medication</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* Medication Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedMedication && (
          <ScrollView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Medication Details</Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.detailContainer}>
              {selectedMedication.imageUri && (
                <Image source={{ uri: selectedMedication.imageUri }} style={styles.detailImage} />
              )}

              <View style={styles.detailInfo}>
                <Text style={styles.detailName}>{selectedMedication.name}</Text>
                <Text style={styles.detailText}>💊 Dose: {selectedMedication.dose}</Text>
                <Text style={styles.detailText}>⏰ Times: {selectedMedication.scheduledTimes.join(', ')}</Text>
                <Text style={styles.detailText}>📅 Duration: {selectedMedication.duration} days</Text>
                <Text style={styles.detailText}>🗓️ Started: {new Date(selectedMedication.startDate).toLocaleDateString()}</Text>
                <Text style={styles.detailText}>📈 Times per day: {selectedMedication.timesPerDay}</Text>

                <View style={styles.statusContainer}>
                  <Text style={styles.statusText}>
                    Status: {new Date() > new Date(new Date(selectedMedication.startDate).getTime() + selectedMedication.duration * 24 * 60 * 60 * 1000) ? '✅ Completed' : '🔄 Active'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
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
    paddingBottom: 100,
  },
  medicationCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  medicationImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  medicationInfo: {
    padding: 20,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  editIcon: {
    fontSize: 16,
  },
  likeIcon: {
    fontSize: 16,
  },
  medicationDetail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 30,
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    fontSize: 24,
  },
  placeholder: {
    width: 24,
  },
  form: {
    padding: 20,
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
    backgroundColor: 'white',
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
  detailContainer: {
    padding: 20,
  },
  detailImage: {
    width: '100%',
    height: 250,
    borderRadius: 15,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  detailInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    lineHeight: 24,
  },
  statusContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});