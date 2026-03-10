import React, { useEffect, useState } from 'react';
import { StatusBar, Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';
import { ThemeProvider } from './src/theme/ThemeProvider';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { NotificationProvider } from './src/context/NotificationContext';
import Toast from 'react-native-toast-message';
import SplashScreen from 'react-native-splash-screen';

// Ignore specific warnings for now
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Setting a timer',
  'Warning: Each child in a list should have a unique "key" prop',
]);

const App = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Hide splash screen
        if (SplashScreen) {
          SplashScreen.hide();
        }

        // Set status bar
        if (Platform.OS === 'android') {
          StatusBar.setBackgroundColor('#FF6B35', true);
        }
        StatusBar.setBarStyle('light-content', true);

        setIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  const theme = {
    colors: {
      primary: '#FF6B35',
      accent: '#FF8E53',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#333333',
      textSecondary: '#666666',
      border: '#E0E0E0',
      error: '#FF5252',
      success: '#4CAF50',
      warning: '#FF9800',
      info: '#2196F3',
    },
    fonts: {
      regular: 'System',
      medium: 'System',
      light: 'System',
      bold: 'System',
    },
    sizes: {
      small: 12,
      medium: 14,
      large: 16,
      xlarge: 18,
      xxlarge: 20,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
  };

  if (!isReady) {
    return null;
  }

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider theme={theme}>
          <PaperProvider>
            <AuthProvider>
              <LocationProvider>
                <NotificationProvider>
                  <NavigationContainer>
                    <StatusBar
                      barStyle="light-content"
                      backgroundColor="#FF6B35"
                      translucent={false}
                    />
                    <AppNavigator />
                    <Toast />
                  </NavigationContainer>
                </NotificationProvider>
              </LocationProvider>
            </AuthProvider>
          </PaperProvider>
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
};

export default App;
