
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  image?: string;
  times: string[];
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  medications: Medication[];
  onMedicationPress: (medication: Medication) => void;
  isDarkMode: boolean;
}

export function SearchModal({ 
  visible, 
  onClose, 
  medications, 
  onMedicationPress, 
  isDarkMode 
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMedications, setFilteredMedications] = useState<Medication[]>([]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMedications(medications);
    } else {
      const filtered = medications.filter(medication =>
        medication.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        medication.dosage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        medication.frequency.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMedications(filtered);
    }
  }, [searchQuery, medications]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
        <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#eee' }]}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
                color: isDarkMode ? '#fff' : '#333',
              }
            ]}
            placeholder="Search medications..."
            placeholderTextColor={isDarkMode ? '#999' : '#666'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <IconSymbol 
              name="xmark" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333333'} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultsList}>
          {filteredMedications.length === 0 ? (
            <Text style={[styles.noResults, { color: isDarkMode ? '#999' : '#666' }]}>
              {searchQuery.trim() === '' ? 'Start typing to search...' : 'No medications found'}
            </Text>
          ) : (
            filteredMedications.map((medication) => (
              <TouchableOpacity
                key={medication.id}
                style={[
                  styles.medicationItem,
                  { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }
                ]}
                onPress={() => {
                  onMedicationPress(medication);
                  handleClose();
                }}
              >
                {medication.image && (
                  <Image source={{ uri: medication.image }} style={styles.medicationImage} />
                )}
                <View style={styles.medicationInfo}>
                  <Text style={[styles.medicationName, { color: isDarkMode ? '#fff' : '#333' }]}>
                    {medication.name}
                  </Text>
                  <Text style={[styles.medicationDetail, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    {medication.dosage} • {medication.frequency}
                  </Text>
                  <Text style={[styles.medicationDetail, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    Times: {medication.times.join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    paddingTop: 50,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 15,
  },
  closeButton: {
    padding: 8,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noResults: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
  },
  medicationItem: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  medicationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  medicationName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  medicationDetail: {
    fontSize: 14,
    marginBottom: 2,
  },
});
