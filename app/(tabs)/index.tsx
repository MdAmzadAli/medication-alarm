import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
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

export default function Home() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);

  // Keep track of individual alarm sounds by notification ID
  const notificationAlarms = React.useRef<Map<string, Audio.Sound>>(new Map());
  
  // Keep track of all active sound instances
  const activeSounds = React.useRef<Set<Audio.Sound>>(new Set());

  useEffect(() => {
    loadMedications();
    setupNotificationCategories();

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
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
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

  const playAlarmSound = async () => {
    // Default alarm (for backwards compatibility)
    await playNotificationAlarm('default_alarm');
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

  const stopAllGlobalAlarms = () => {
    // IMMEDIATE stop - no async operations to prevent delays
    try {
      // Stop all tracked sound instances immediately
      activeSounds.current.forEach(sound => {
        try {
          // Immediate stop without checking status to avoid delays
          sound.stopAsync().catch(() => {});
          sound.unloadAsync().catch(() => {});
        } catch (e) {
          // Ignore errors for immediate response
        }
      });
      activeSounds.current.clear();
      notificationAlarms.current.clear();
      
      // Stop current component alarm immediately
      if (alarmSound) {
        try {
          alarmSound.stopAsync().catch(() => {});
          alarmSound.unloadAsync().catch(() => {});
        } catch (e) {
          // Ignore errors for immediate response  
        }
        setAlarmSound(null);
      }
      
      console.log('All alarms stopped immediately');
    } catch (error) {
      console.log('Error stopping all alarms:', error);
    }
  };

  const stopAlarmSoundImmediate = () => {
    // Immediate synchronous stop without await to prevent delays
    stopAllGlobalAlarms();
  };

  const stopAlarmSound = async () => {
    try {
      // Stop the current state alarm
      if (alarmSound) {
        const status = await alarmSound.getStatusAsync();
        if (status.isLoaded) {
          await alarmSound.stopAsync();
          await alarmSound.unloadAsync();
        }
        setAlarmSound(null);
      }
      
      // Stop the global reference alarm
      if (globalAlarmSound.current) {
        const status = await globalAlarmSound.current.getStatusAsync();
        if (status.isLoaded) {
          await globalAlarmSound.current.stopAsync();
          await globalAlarmSound.current.unloadAsync();
        }
        globalAlarmSound.current = null;
      }
    } catch (error) {
      console.log('Error stopping alarm sound:', error);
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