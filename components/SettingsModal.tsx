
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { IconSymbol } from './ui/IconSymbol';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function SettingsModal({ 
  visible, 
  onClose, 
  isDarkMode, 
  onToggleDarkMode 
}: SettingsModalProps) {
  const [currentRingtone, setCurrentRingtone] = useState<string>('Default');
  const [customRingtones, setCustomRingtones] = useState<{ name: string; uri: string }[]>([]);

  useEffect(() => {
    loadRingtoneSettings();
  }, []);

  const loadRingtoneSettings = async () => {
    try {
      const savedRingtone = await AsyncStorage.getItem('selectedRingtone');
      const savedCustomRingtones = await AsyncStorage.getItem('customRingtones');
      
      if (savedRingtone) {
        setCurrentRingtone(savedRingtone);
      }
      
      if (savedCustomRingtones) {
        setCustomRingtones(JSON.parse(savedCustomRingtones));
      }
    } catch (error) {
      console.error('Error loading ringtone settings:', error);
    }
  };

  const selectCustomRingtone = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Test if the audio file can be played
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: asset.uri },
            { shouldPlay: false }
          );
          await sound.unloadAsync();
          
          const newRingtone = {
            name: asset.name || 'Custom Ringtone',
            uri: asset.uri,
          };
          
          const updatedRingtones = [...customRingtones, newRingtone];
          setCustomRingtones(updatedRingtones);
          
          // Save to AsyncStorage
          await AsyncStorage.setItem('customRingtones', JSON.stringify(updatedRingtones));
          await AsyncStorage.setItem('selectedRingtone', newRingtone.name);
          await AsyncStorage.setItem('selectedRingtoneUri', newRingtone.uri);
          
          setCurrentRingtone(newRingtone.name);
          
          Alert.alert('Success', 'Custom ringtone added successfully!');
        } catch (audioError) {
          Alert.alert('Error', 'The selected file is not a valid audio format.');
        }
      }
    } catch (error) {
      console.error('Error selecting ringtone:', error);
      Alert.alert('Error', 'Failed to select ringtone. Please try again.');
    }
  };

  const selectRingtone = async (ringtoneName: string, ringtoneUri?: string) => {
    try {
      setCurrentRingtone(ringtoneName);
      await AsyncStorage.setItem('selectedRingtone', ringtoneName);
      
      if (ringtoneUri) {
        await AsyncStorage.setItem('selectedRingtoneUri', ringtoneUri);
      } else {
        await AsyncStorage.removeItem('selectedRingtoneUri');
      }
      
      Alert.alert('Success', `Ringtone changed to: ${ringtoneName}`);
    } catch (error) {
      console.error('Error saving ringtone:', error);
    }
  };

  const previewRingtone = async (uri?: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        uri ? { uri } : require('../../assets/notification-sound.mp3'),
        { shouldPlay: true, isLooping: false }
      );
      
      // Stop after 3 seconds
      setTimeout(async () => {
        await sound.stopAsync();
        await sound.unloadAsync();
      }, 3000);
    } catch (error) {
      console.error('Error previewing ringtone:', error);
      Alert.alert('Error', 'Could not preview this ringtone.');
    }
  };

  const deleteCustomRingtone = async (ringtoneToDelete: { name: string; uri: string }) => {
    Alert.alert(
      'Delete Ringtone',
      `Are you sure you want to delete "${ringtoneToDelete.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRingtones = customRingtones.filter(r => r.uri !== ringtoneToDelete.uri);
            setCustomRingtones(updatedRingtones);
            await AsyncStorage.setItem('customRingtones', JSON.stringify(updatedRingtones));
            
            if (currentRingtone === ringtoneToDelete.name) {
              setCurrentRingtone('Default');
              await AsyncStorage.setItem('selectedRingtone', 'Default');
              await AsyncStorage.removeItem('selectedRingtoneUri');
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
        <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#eee' }]}>
          <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#333' }]}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol 
              name="xmark" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333333'} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Dark Mode Setting */}
          <View style={[styles.settingItem, { borderBottomColor: isDarkMode ? '#333' : '#eee' }]}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, { color: isDarkMode ? '#fff' : '#333' }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#ccc' : '#666' }]}>
                Enable dark theme
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={onToggleDarkMode}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Ringtone Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#333' }]}>
              Ringtones
            </Text>
            
            {/* Default Ringtone */}
            <TouchableOpacity
              style={[
                styles.ringtoneItem,
                { backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' },
                currentRingtone === 'Default' && styles.selectedRingtone
              ]}
              onPress={() => selectRingtone('Default')}
            >
              <View style={styles.ringtoneLeft}>
                <Text style={[styles.ringtoneName, { color: isDarkMode ? '#fff' : '#333' }]}>
                  Default
                </Text>
                {currentRingtone === 'Default' && (
                  <Text style={styles.selectedText}>Selected</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => previewRingtone()}
                style={styles.previewButton}
              >
                <Text style={styles.previewText}>Preview</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Custom Ringtones */}
            {customRingtones.map((ringtone, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.ringtoneItem,
                  { backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' },
                  currentRingtone === ringtone.name && styles.selectedRingtone
                ]}
                onPress={() => selectRingtone(ringtone.name, ringtone.uri)}
              >
                <View style={styles.ringtoneLeft}>
                  <Text style={[styles.ringtoneName, { color: isDarkMode ? '#fff' : '#333' }]}>
                    {ringtone.name}
                  </Text>
                  {currentRingtone === ringtone.name && (
                    <Text style={styles.selectedText}>Selected</Text>
                  )}
                </View>
                <View style={styles.ringtoneActions}>
                  <TouchableOpacity
                    onPress={() => previewRingtone(ringtone.uri)}
                    style={styles.previewButton}
                  >
                    <Text style={styles.previewText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteCustomRingtone(ringtone)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Custom Ringtone Button */}
            <TouchableOpacity
              style={[styles.addRingtoneButton, { backgroundColor: isDarkMode ? '#007AFF' : '#007AFF' }]}
              onPress={selectCustomRingtone}
            >
              <IconSymbol name="plus" size={20} color="#ffffff" />
              <Text style={styles.addRingtoneText}>Add Custom Ringtone</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    paddingTop: 50,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  ringtoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  selectedRingtone: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  ringtoneLeft: {
    flex: 1,
  },
  ringtoneName: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  ringtoneActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    marginRight: 8,
  },
  previewText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  addRingtoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  addRingtoneText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
