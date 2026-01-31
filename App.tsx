import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from './src/navigation/NavigationContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AlertProvider } from './src/context/AlertContext';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AlertProvider>
        <NavigationProvider>
          <StatusBar barStyle="light-content" backgroundColor="#040714" />
          <AppNavigator />
        </NavigationProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}

export default App;
