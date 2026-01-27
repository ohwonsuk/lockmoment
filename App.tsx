import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from './src/navigation/NavigationContext';
import { AppNavigator } from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationProvider>
        <StatusBar barStyle="light-content" backgroundColor="#040714" />
        <AppNavigator />
      </NavigationProvider>
    </SafeAreaProvider>
  );
}

export default App;
