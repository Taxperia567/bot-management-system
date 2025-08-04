import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import BotsScreen from './src/screens/BotsScreen';
import BotDetailScreen from './src/screens/BotDetailScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';

// Services
import { NotificationService } from './src/services/NotificationService';
import { AuthService } from './src/services/AuthService';
import { SocketService } from './src/services/SocketService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#03DAC6',
    accent: '#FF9800',
    error: '#F44336',
    success: '#4CAF50',
    warning: '#FF9800',
  },
};

function BotsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="BotsList" 
        component={BotsScreen} 
        options={{ title: 'Botlarım' }}
      />
      <Stack.Screen 
        name="BotDetail" 
        component={BotDetailScreen}
        options={({ route }) => ({ title: route.params?.botName || 'Bot Detayı' })}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          } else if (route.name === 'Bots') {
            iconName = focused ? 'robot' : 'robot-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'bell' : 'bell-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Ana Sayfa' }}
      />
      <Tab.Screen 
        name="Bots" 
        component={BotsStack} 
        options={{ title: 'Botlar' }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ title: 'Bildirimler' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Ayarlar' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Initialize services
    initializeApp();

    // Notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      handleNotificationResponse(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      
      // Check existing authentication
      const authData = await AuthService.getStoredAuth();
      if (authData && authData.accessKey) {
        const isValid = await AuthService.verifyAccessKey(authData.accessKey);
        if (isValid) {
          setIsAuthenticated(true);
          
          // Initialize push notifications
          await NotificationService.initializePushNotifications();
          
          // Connect to socket
          SocketService.connect(authData.accessKey);
        }
      }
    } catch (error) {
      console.error('App initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationResponse = (response) => {
    const data = response.notification.request.content.data;
    
    if (data.type === 'bot_status' && data.botId) {
      // Navigate to bot detail screen
      // Navigation logic here
    }
  };

  const handleLogin = async (accessKey) => {
    try {
      const isValid = await AuthService.verifyAccessKey(accessKey);
      if (isValid) {
        await AuthService.storeAuth(accessKey);
        await NotificationService.initializePushNotifications();
        SocketService.connect(accessKey);
        setIsAuthenticated(true);
      }
      return isValid;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const handleLogout = async () => {
    await AuthService.clearAuth();
    SocketService.disconnect();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return null; // Loading screen component
  }

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isAuthenticated ? (
          <MainTabs />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
        <Toast />
      </NavigationContainer>
    </PaperProvider>
  );
}