import React, { useState, useEffect, useRef } from 'react';
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
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Navbar } from '../../components/Navbar';
import { SearchModal } from '../../components/SearchModal';
import { SettingsModal } from '../../components/SettingsModal';

// Set up notification handler
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
  dosage: string;
  frequency: string;
  times: string[];
  image?: string;
  isLiked: boolean;
}

export default function HomeScreen() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [expandedMedication, setExpandedMedication] = useState<string | null>(null);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Active alarms tracking
  const [activeAlarms, setActiveAlarms] = useState<{[key: string]: any}>({});

  // Add medication form state
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    times: [] as string[],
    image: '',
  });

  useFocusEffect(
    React.useCallback(() => {
      loadMedications();
      loadDarkModePreference();
      checkForNotificationResponse();
    }, [])
  );

  const loadDarkModePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newMode));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const checkForNotificationResponse = async () => {
    const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastNotificationResponse) {
      const { notification } = lastNotificationResponse;
      const notificationId = notification.request.identifier;
      await stopSpecificAlarm(notificationId);
    }
  };

  const loadMedications = async () => {
    try {
      const medicationsData = await AsyncStorage.getItem('medications');
      if (medicationsData) {
        const parsedMedications = JSON.parse(medicationsData);
        // Ensure all medications have times array
        const medicationsWithTimes = parsedMedications.map((med: Medication) => ({
          ...med,
          times: med.times || [],
          isLiked: med.isLiked !== undefined ? med.isLiked : false
        }));
        setMedications(medicationsWithTimes);
      }
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };

  const stopSpecificAlarm = async (notificationId: string) => {
    try {
      if (activeAlarms[notificationId]) {
        await activeAlarms[notificationId].stopAsync();
        await activeAlarms[notificationId].unloadAsync();

        setActiveAlarms(prev => {
          const newAlarms = { ...prev };
          delete newAlarms[notificationId];
          return newAlarms;
        });
      }

      await Notifications.dismissNotificationAsync(notificationId);
      await AsyncStorage.removeItem(`alarmPlaying_${notificationId}`);
    } catch (error) {
      console.error('Error stopping specific alarm:', error);
    }
  };

  const toggleLike = async (medicationId: string) => {
    const updatedMedications = medications.map(med =>
      med.id === medicationId ? { ...med, isLiked: !med.isLiked } : med
    );
    setMedications(updatedMedications);
    await AsyncStorage.setItem('medications', JSON.stringify(updatedMedications));
  };

  const startEdit = (medication: Medication) => {
    setEditingMedication({ ...medication });
  };

  const saveEdit = async () => {
    if (!editingMedication) return;

    const updatedMedications = medications.map(med =>
      med.id === editingMedication.id ? editingMedication : med
    );
    setMedications(updatedMedications);
    await AsyncStorage.setItem('medications', JSON.stringify(updatedMedications));
    setEditingMedication(null);
    Alert.alert('Success', 'Medication updated successfully!');
  };

  const cancelEdit = () => {
    setEditingMedication(null);
  };

  const selectImageForEdit = async () => {
    if (!editingMedication) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setEditingMedication({
        ...editingMedication,
        image: result.assets[0].uri
      });
    }
  };

  const deleteMedication = async (medicationId: string) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedMedications = medications.filter(med => med.id !== medicationId);
            setMedications(updatedMedications);
            await AsyncStorage.setItem('medications', JSON.stringify(updatedMedications));
          }
        }
      ]
    );
  };

  // Add medication functions
  const addTime = () => {
    setNewMedication({
      ...newMedication,
      times: [...newMedication.times, '']
    });
  };

  const updateTime = (index: number, time: string) => {
    const updatedTimes = [...newMedication.times];
    updatedTimes[index] = time;
    setNewMedication({
      ...newMedication,
      times: updatedTimes
    });
  };

  const removeTime = (index: number) => {
    const updatedTimes = newMedication.times.filter((_, i) => i !== index);
    setNewMedication({
      ...newMedication,
      times: updatedTimes
    });
  };

  const selectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setNewMedication({
        ...newMedication,
        image: result.assets[0].uri
      });
    }
  };

  const addMedication = async () => {
    if (!newMedication.name || !newMedication.dosage || !newMedication.frequency || newMedication.times.length === 0) {
      Alert.alert('Error', 'Please fill in all fields and add at least one time.');
      return;
    }

    const medication: Medication = {
      id: Date.now().toString(),
      name: newMedication.name,
      dosage: newMedication.dosage,
      frequency: newMedication.frequency,
      times: newMedication.times.filter(time => time.trim() !== '') || [],
      image: newMedication.image,
      isLiked: false,
    };

    const updatedMedications = [...medications, medication];
    setMedications(updatedMedications);
    await AsyncStorage.setItem('medications', JSON.stringify(updatedMedications));

    // Schedule notifications for this medication
    await scheduleNotificationsForMedication(medication);

    // Reset form
    setNewMedication({
      name: '',
      dosage: '',
      frequency: '',
      times: [],
      image: '',
    });

    setShowAddModal(false);

    // Scroll to top to show the new medication
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);

    Alert.alert('Success', 'Medication added successfully!');
  };

  const scheduleNotificationsForMedication = async (medication: Medication) => {
    try {
      for (const time of medication.times) {
        const [hours, minutes] = time.split(':').map(Number);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time for ${medication.name}`,
            body: `Take ${medication.dosage} - ${medication.frequency}`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            sticky: true,
            data: { medicationId: medication.id, medicationName: medication.name },
          },
          trigger: {
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  const handleMedicationPress = (medication: Medication) => {
    setExpandedMedication(expandedMedication === medication.id ? null : medication.id);
  };

  const containerStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
  };

  const cardStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
  };

  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#333333',
  };

  const subTextStyle = {
    color: isDarkMode ? '#cccccc' : '#666666',
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Navbar
        title="My Medications"
        onSearchPress={() => setShowSearchModal(true)}
        onSettingsPress={() => setShowSettingsModal(true)}
        isDarkMode={isDarkMode}
      />

      <ScrollView ref={scrollViewRef} style={styles.scrollView}>
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, subTextStyle]}>
              No medications added yet.{'\n'}Tap the + button to add your first medication.
            </Text>
          </View>
        ) : (
          medications.map((medication) => (
            <TouchableOpacity
              key={medication.id}
              style={[styles.medicationCard, cardStyle]}
              onPress={() => handleMedicationPress(medication)}
            >
              <View style={styles.medicationHeader}>
                {medication.image && (
                  <Image source={{ uri: medication.image }} style={styles.medicationImage} />
                )}
                <View style={styles.medicationInfo}>
                  <Text style={[styles.medicationName, textStyle]}>{medication.name}</Text>
                  <Text style={[styles.medicationDetail, subTextStyle]}>{medication.dosage}</Text>
                  <Text style={[styles.medicationDetail, subTextStyle]}>{medication.frequency}</Text>
                </View>
                <View style={styles.medicationActions}>
                  <TouchableOpacity
                    onPress={() => startEdit(medication)}
                    style={styles.actionButton}
                  >
                    <IconSymbol name="pencil" size={20} color={isDarkMode ? '#ffffff' : '#333333'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleLike(medication.id)}
                    style={styles.actionButton}
                  >
                    <IconSymbol 
                      name={medication.isLiked ? "heart.fill" : "heart"} 
                      size={20} 
                      color={medication.isLiked ? "#FF3B30" : (isDarkMode ? '#ffffff' : '#333333')} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {expandedMedication === medication.id && (
                <View style={styles.expandedContent}>
                  <Text style={[styles.timesTitle, textStyle]}>Scheduled Times:</Text>
                  {medication.times.map((time, index) => (
                    <Text key={index} style={[styles.timeText, subTextStyle]}>
                      • {time}
                    </Text>
                  ))}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteMedication(medication.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete Medication</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => setShowAddModal(true)}
      >
        <IconSymbol name="plus" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Add Medication Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDarkMode ? '#333' : '#eee' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#333' }]}>Add Medication</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={isDarkMode ? '#ffffff' : '#333333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.form}>
              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Medication Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#333' : '#fff',
                    color: isDarkMode ? '#fff' : '#333',
                    borderColor: isDarkMode ? '#555' : '#ddd',
                  }
                ]}
                value={newMedication.name}
                onChangeText={(text) => setNewMedication({ ...newMedication, name: text })}
                placeholder="Enter medication name"
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
              />

              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Dosage</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#333' : '#fff',
                    color: isDarkMode ? '#fff' : '#333',
                    borderColor: isDarkMode ? '#555' : '#ddd',
                  }
                ]}
                value={newMedication.dosage}
                onChangeText={(text) => setNewMedication({ ...newMedication, dosage: text })}
                placeholder="e.g., 500mg"
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
              />

              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Frequency</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#333' : '#fff',
                    color: isDarkMode ? '#fff' : '#333',
                    borderColor: isDarkMode ? '#555' : '#ddd',
                  }
                ]}
                value={newMedication.frequency}
                onChangeText={(text) => setNewMedication({ ...newMedication, frequency: text })}
                placeholder="e.g., Twice daily"
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
              />

              <TouchableOpacity style={styles.imageButton} onPress={selectImage}>
                {newMedication.image ? (
                  <Image source={{ uri: newMedication.image }} style={styles.medicineImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>📷</Text>
                    <Text style={styles.imagePlaceholderSubtext}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Times</Text>
              {newMedication.times.map((time, index) => (
                <View key={index} style={styles.timeInputContainer}>
                  <TextInput
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor: isDarkMode ? '#333' : '#fff',
                        color: isDarkMode ? '#fff' : '#333',
                        borderColor: isDarkMode ? '#555' : '#ddd',
                      }
                    ]}
                    value={time}
                    onChangeText={(text) => updateTime(index, text)}
                    placeholder="HH:MM (e.g., 08:00)"
                    placeholderTextColor={isDarkMode ? '#999' : '#666'}
                  />
                  <TouchableOpacity
                    style={styles.removeTimeButton}
                    onPress={() => removeTime(index)}
                  >
                    <Text style={styles.removeTimeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addTimeButton} onPress={addTime}>
                <Text style={styles.addTimeButtonText}>+ Add Time</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitButton} onPress={addMedication}>
                <Text style={styles.submitButtonText}>Add Medication</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Medication Modal */}
      <Modal
        visible={editingMedication !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDarkMode ? '#333' : '#eee' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#333' }]}>Edit Medication</Text>
            <TouchableOpacity onPress={cancelEdit} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={isDarkMode ? '#ffffff' : '#333333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {editingMedication && (
              <View style={styles.form}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Medication Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDarkMode ? '#333' : '#fff',
                      color: isDarkMode ? '#fff' : '#333',
                      borderColor: isDarkMode ? '#555' : '#ddd',
                    }
                  ]}
                  value={editingMedication.name}
                  onChangeText={(text) => setEditingMedication({ ...editingMedication, name: text })}
                  placeholder="Enter medication name"
                  placeholderTextColor={isDarkMode ? '#999' : '#666'}
                />

                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Dosage</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDarkMode ? '#333' : '#fff',
                      color: isDarkMode ? '#fff' : '#333',
                      borderColor: isDarkMode ? '#555' : '#ddd',
                    }
                  ]}
                  value={editingMedication.dosage}
                  onChangeText={(text) => setEditingMedication({ ...editingMedication, dosage: text })}
                  placeholder="e.g., 500mg"
                  placeholderTextColor={isDarkMode ? '#999' : '#666'}
                />

                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#333' }]}>Frequency</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDarkMode ? '#333' : '#fff',
                      color: isDarkMode ? '#fff' : '#333',
                      borderColor: isDarkMode ? '#555' : '#ddd',
                    }
                  ]}
                  value={editingMedication.frequency}
                  onChangeText={(text) => setEditingMedication({ ...editingMedication, frequency: text })}
                  placeholder="e.g., Twice daily"
                  placeholderTextColor={isDarkMode ? '#999' : '#666'}
                />

                <TouchableOpacity style={styles.imageButton} onPress={selectImageForEdit}>
                  {editingMedication.image ? (
                    <Image source={{ uri: editingMedication.image }} style={styles.medicineImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>📷</Text>
                      <Text style={styles.imagePlaceholderSubtext}>Tap to add image</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Search Modal */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        medications={medications}
        onMedicationPress={handleMedicationPress}
        isDarkMode={isDarkMode}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  medicationCard: {
    borderRadius: 15,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  medicationDetail: {
    fontSize: 14,
    marginBottom: 2,
  },
  medicationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  timesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingVertical: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  imageButton: {
    marginVertical: 15,
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
    fontSize: 40,
    marginBottom: 5,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 10,
  },
  removeTimeButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  removeTimeText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  addTimeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  addTimeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});