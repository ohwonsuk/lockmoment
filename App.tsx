/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from 'react-native';
import { NativeLockControl } from './src/services/NativeLockControl';

function App(): React.JSX.Element {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (Platform.OS === 'android') {
      const perm = await NativeLockControl.checkAccessibilityPermission();
      setHasPermission(perm);
      const locked = await NativeLockControl.isLocked();
      setIsLocked(locked);
    } else {
      // iOS check
      const authStatus = await NativeLockControl.checkAuthorization();
      setHasPermission(authStatus === 2); // 2 = approved (indiv) - simplified check
    }
  };

  const handleStartLock = async () => {
    if (Platform.OS === 'android') {
      if (!hasPermission) {
        Alert.alert("Permission Required", "Please enable Accessibility Service for LockMoment in Settings");
        return;
      }
      await NativeLockControl.startLock(60000); // 1 minute
      setIsLocked(true);
      Alert.alert("Locked", "App is locked for 1 minute. Try opening other apps.");
    } else {
      if (!hasPermission) {
        Alert.alert("Permission Required", "Please tap Request Authorization first.");
        return;
      }
      // iOS: Start lock (Apply shield)
      await NativeLockControl.startLock(60000);
      setIsLocked(true);
      Alert.alert("Locked", "Shields applied. Selected apps are unrestricted.");
    }
  };

  const handleSelectApps = async () => {
    if (Platform.OS === 'ios') {
      try {
        await NativeLockControl.presentFamilyActivityPicker();
      } catch (e: any) {
        Alert.alert("Error", "Could not present picker: " + e.message);
      }
    } else {
      Alert.alert("Android", "Not available");
    }
  };

  const handleStopLock = async () => {
    await NativeLockControl.stopLock();
    setIsLocked(false);
    Alert.alert("Unlocked", "Lock released.");
  };

  const handleRequestPermission = async () => {
    if (Platform.OS === 'ios') {
      try {
        await NativeLockControl.requestAuthorization();
      } catch (e: any) {
        Alert.alert("Error", e.message);
      }
    } else {
      Alert.alert("Android", "Go to Settings > Accessibility to enable manually.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.title}>LockMoment Dev</Text>

        <View style={styles.statusContainer}>
          <Text>Permission: {hasPermission ? "GRANTED" : "DENIED"}</Text>
          <Text>Lock Status: {isLocked ? "LOCKED" : "UNLOCKED"}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRequestPermission}>
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity style={[styles.button, { backgroundColor: '#5856D6' }]} onPress={handleSelectApps}>
            <Text style={styles.buttonText}>Select Apps to Block</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.button, styles.lockButton]} onPress={handleStartLock}>
          <Text style={styles.buttonText}>Start Lock (1 Min)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.unlockButton]} onPress={handleStopLock}>
          <Text style={styles.buttonText}>Force Stop Lock</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  statusContainer: {
    marginBottom: 40,
    alignItems: 'center',
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
  },
  lockButton: {
    backgroundColor: '#FF3B30',
  },
  unlockButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
