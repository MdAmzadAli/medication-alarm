
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface NavbarProps {
  title: string;
  onSearchPress: () => void;
  onSettingsPress: () => void;
  isDarkMode: boolean;
}

export function Navbar({ title, onSearchPress, onSettingsPress, isDarkMode }: NavbarProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.navbar}>
        <Text style={[styles.title, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
          {title}
        </Text>
        <View style={styles.rightButtons}>
          <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
            <IconSymbol 
              name="magnifying-glass" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333333'} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton}>
            <IconSymbol 
              name="gear" 
              size={24} 
              color={isDarkMode ? '#ffffff' : '#333333'} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 15,
    padding: 8,
  },
});
