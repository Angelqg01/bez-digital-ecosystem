import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import PushNotification from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import WalletScreen from './src/screens/WalletScreen';
import NFTScreen from './src/screens/NFTScreen';
import StakingScreen from './src/screens/StakingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import CameraScreen from './src/screens/CameraScreen';
import ChatScreen from './src/screens/ChatScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';

// Services
import WalletService from './src/services/WalletService';
import NotificationService from './src/services/NotificationService';
import BiometricService from './src/services/BiometricService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Wallet') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'NFTs') {
            iconName = 'collections';
          } else if (route.name === 'Staking') {
            iconName = 'trending-up';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          height: Platform.OS === 'ios' ? 85 : 60,
        },
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="NFTs" component={NFTScreen} />
      <Tab.Screen name="Staking" component={StakingScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkConnected, setNetworkConnected] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      setNetworkConnected(netInfo.isConnected);

      // Setup network listener
      const unsubscribe = NetInfo.addEventListener(state => {
        setNetworkConnected(state.isConnected);
        if (!state.isConnected) {
          Toast.show({
            type: 'error',
            text1: 'No Internet Connection',
            text2: 'Please check your network settings',
          });
        }
      });

      // Request permissions
      await requestPermissions();

      // Initialize push notifications
      await initializePushNotifications();

      // Check for saved authentication
      await checkSavedAuth();

      // Initialize wallet service
      await WalletService.initialize();

      setIsLoading(false);

      return () => unsubscribe();
    } catch (error) {
      console.error('App initialization error:', error);
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        if (grants['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Camera permission granted');
        }
      } catch (err) {
        console.warn('Permission request error:', err);
      }
    }
  };

  const initializePushNotifications = async () => {
    try {
      // Request permission for iOS
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Push notification permission denied');
          return;
        }
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);

      // Store token for backend
      await AsyncStorage.setItem('fcmToken', fcmToken);

      // Configure push notifications
      PushNotification.configure({
        onRegister: function (token) {
          console.log('Push notification token:', token);
        },
        onNotification: function (notification) {
          console.log('Notification received:', notification);
          
          if (notification.userInteraction) {
            // Handle notification tap
            handleNotificationTap(notification);
          }
        },
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },
        popInitialNotification: true,
        requestPermissions: Platform.OS === 'ios',
      });

      // Handle background messages
      messaging().onMessage(async remoteMessage => {
        console.log('Foreground message:', remoteMessage);
        
        // Show local notification
        PushNotification.localNotification({
          title: remoteMessage.notification?.title || 'BeZhas',
          message: remoteMessage.notification?.body || 'New notification',
          playSound: true,
          soundName: 'default',
        });
      });

      // Handle notification opened app
      messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('Notification opened app:', remoteMessage);
        handleNotificationTap(remoteMessage);
      });

      // Check if app was opened from notification
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('App opened from notification:', initialNotification);
        handleNotificationTap(initialNotification);
      }

    } catch (error) {
      console.error('Push notification setup error:', error);
    }
  };

  const handleNotificationTap = (notification) => {
    // Navigate based on notification data
    const { type, data } = notification.data || {};
    
    switch (type) {
      case 'transaction':
        // Navigate to wallet screen
        break;
      case 'nft_sold':
        // Navigate to NFT screen
        break;
      case 'staking_reward':
        // Navigate to staking screen
        break;
      case 'message':
        // Navigate to chat screen
        break;
      default:
        // Navigate to home
        break;
    }
  };

  const checkSavedAuth = async () => {
    try {
      const savedAuth = await AsyncStorage.getItem('userAuth');
      const walletAddress = await AsyncStorage.getItem('walletAddress');
      
      if (savedAuth && walletAddress) {
        // Check if biometric authentication is enabled
        const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
        
        if (biometricEnabled === 'true') {
          const biometricResult = await BiometricService.authenticate();
          if (biometricResult.success) {
            setIsAuthenticated(true);
            setWalletConnected(true);
          }
        } else {
          setIsAuthenticated(true);
          setWalletConnected(true);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  const handleLogin = async (walletAddress) => {
    try {
      await AsyncStorage.setItem('userAuth', 'true');
      await AsyncStorage.setItem('walletAddress', walletAddress);
      
      setIsAuthenticated(true);
      setWalletConnected(true);
      
      Toast.show({
        type: 'success',
        text1: 'Welcome to BeZhas!',
        text2: 'Wallet connected successfully',
      });
    } catch (error) {
      console.error('Login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: 'Please try again',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['userAuth', 'walletAddress']);
      await WalletService.disconnect();
      
      setIsAuthenticated(false);
      setWalletConnected(false);
      
      Toast.show({
        type: 'info',
        text1: 'Logged Out',
        text2: 'See you soon!',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Add loading spinner component */}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen 
              name="Camera" 
              component={CameraScreen}
              options={{
                headerShown: true,
                title: 'Create NFT',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#ffffff',
              }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{
                headerShown: true,
                title: 'Messages',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#ffffff',
              }}
            />
            <Stack.Screen 
              name="Marketplace" 
              component={MarketplaceScreen}
              options={{
                headerShown: true,
                title: 'Marketplace',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#ffffff',
              }}
            />
          </>
        )}
      </Stack.Navigator>

      <Toast />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
});
