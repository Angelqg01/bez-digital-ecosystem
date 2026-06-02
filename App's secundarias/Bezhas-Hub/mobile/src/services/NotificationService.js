import PushNotification from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.fcmToken = null;
    this.notificationTypes = {
      TRANSACTION: 'transaction',
      NFT_SOLD: 'nft_sold',
      STAKING_REWARD: 'staking_reward',
      MESSAGE: 'message',
      SECURITY_ALERT: 'security_alert',
      PRICE_ALERT: 'price_alert',
      SYSTEM: 'system'
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Request permission
      await this.requestPermission();

      // Get FCM token
      this.fcmToken = await messaging().getToken();
      await AsyncStorage.setItem('fcmToken', this.fcmToken);

      // Configure local notifications
      this.configureLocalNotifications();

      // Setup message handlers
      this.setupMessageHandlers();

      // Create notification channels (Android)
      if (Platform.OS === 'android') {
        this.createNotificationChannels();
      }

      this.isInitialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Notification service initialization error:', error);
    }
  }

  async requestPermission() {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          throw new Error('Push notification permission denied');
        }
      }

      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      throw error;
    }
  }

  configureLocalNotifications() {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
      },

      onNotification: (notification) => {
        console.log('Local notification:', notification);
        
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
      },

      onAction: (notification) => {
        console.log('Notification action:', notification);
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (err) => {
        console.error('Registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  setupMessageHandlers() {
    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage);
      
      // Show local notification for foreground messages
      this.showLocalNotification({
        title: remoteMessage.notification?.title || 'BeZhas',
        message: remoteMessage.notification?.body || 'New notification',
        data: remoteMessage.data,
        type: remoteMessage.data?.type || this.notificationTypes.SYSTEM
      });
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Check if app was opened from notification
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
        this.handleNotificationTap(remoteMessage);
      }
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
      
      // Process background message
      await this.processBackgroundMessage(remoteMessage);
    });
  }

  createNotificationChannels() {
    const channels = [
      {
        channelId: 'transactions',
        channelName: 'Transactions',
        channelDescription: 'Transaction notifications',
        importance: 4,
        vibrate: true,
      },
      {
        channelId: 'nft',
        channelName: 'NFT Updates',
        channelDescription: 'NFT sale and marketplace notifications',
        importance: 4,
        vibrate: true,
      },
      {
        channelId: 'staking',
        channelName: 'Staking Rewards',
        channelDescription: 'Staking and reward notifications',
        importance: 3,
        vibrate: false,
      },
      {
        channelId: 'messages',
        channelName: 'Messages',
        channelDescription: 'Chat and communication notifications',
        importance: 4,
        vibrate: true,
      },
      {
        channelId: 'security',
        channelName: 'Security Alerts',
        channelDescription: 'Security and account alerts',
        importance: 5,
        vibrate: true,
      },
      {
        channelId: 'price_alerts',
        channelName: 'Price Alerts',
        channelDescription: 'Cryptocurrency price notifications',
        importance: 3,
        vibrate: false,
      },
      {
        channelId: 'system',
        channelName: 'System',
        channelDescription: 'System and general notifications',
        importance: 3,
        vibrate: false,
      }
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(channel, (created) => {
        console.log(`Channel ${channel.channelId} created:`, created);
      });
    });
  }

  showLocalNotification(options) {
    const {
      title,
      message,
      data = {},
      type = this.notificationTypes.SYSTEM,
      actions = [],
      bigText = null,
      subText = null,
      largeIcon = null,
      bigPictureUrl = null
    } = options;

    const channelId = this.getChannelIdForType(type);
    
    const notificationConfig = {
      title,
      message,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      channelId,
      userInfo: data,
      actions,
      invokeApp: true,
      autoCancel: true,
      vibrate: true,
      vibration: 300,
      ongoing: false,
      ignoreInForeground: false,
    };

    // Add Android-specific options
    if (Platform.OS === 'android') {
      if (bigText) notificationConfig.bigText = bigText;
      if (subText) notificationConfig.subText = subText;
      if (largeIcon) notificationConfig.largeIcon = largeIcon;
      if (bigPictureUrl) notificationConfig.bigPictureUrl = bigPictureUrl;
    }

    PushNotification.localNotification(notificationConfig);
  }

  getChannelIdForType(type) {
    const channelMap = {
      [this.notificationTypes.TRANSACTION]: 'transactions',
      [this.notificationTypes.NFT_SOLD]: 'nft',
      [this.notificationTypes.STAKING_REWARD]: 'staking',
      [this.notificationTypes.MESSAGE]: 'messages',
      [this.notificationTypes.SECURITY_ALERT]: 'security',
      [this.notificationTypes.PRICE_ALERT]: 'price_alerts',
      [this.notificationTypes.SYSTEM]: 'system'
    };

    return channelMap[type] || 'system';
  }

  handleNotificationTap(notification) {
    const { data } = notification;
    const type = data?.type;

    // Emit navigation event based on notification type
    switch (type) {
      case this.notificationTypes.TRANSACTION:
        this.navigateToScreen('Wallet', { transactionId: data.transactionId });
        break;
      case this.notificationTypes.NFT_SOLD:
        this.navigateToScreen('NFTs', { nftId: data.nftId });
        break;
      case this.notificationTypes.STAKING_REWARD:
        this.navigateToScreen('Staking', { rewardId: data.rewardId });
        break;
      case this.notificationTypes.MESSAGE:
        this.navigateToScreen('Chat', { chatId: data.chatId });
        break;
      case this.notificationTypes.SECURITY_ALERT:
        this.navigateToScreen('Profile', { tab: 'security' });
        break;
      case this.notificationTypes.PRICE_ALERT:
        this.navigateToScreen('Home', { symbol: data.symbol });
        break;
      default:
        this.navigateToScreen('Home');
        break;
    }
  }

  handleNotificationAction(notification) {
    const { action, data } = notification;

    switch (action) {
      case 'reply':
        // Handle quick reply
        this.handleQuickReply(data);
        break;
      case 'view':
        // Handle view action
        this.handleNotificationTap(notification);
        break;
      case 'dismiss':
        // Handle dismiss action
        console.log('Notification dismissed');
        break;
      default:
        console.log('Unknown notification action:', action);
        break;
    }
  }

  navigateToScreen(screenName, params = {}) {
    // This would be handled by the navigation service
    // For now, just log the navigation intent
    console.log(`Navigate to ${screenName} with params:`, params);
    
    // In a real implementation, you would use React Navigation
    // NavigationService.navigate(screenName, params);
  }

  async processBackgroundMessage(remoteMessage) {
    try {
      // Process the message and update local storage if needed
      const { data } = remoteMessage;
      
      switch (data?.type) {
        case this.notificationTypes.TRANSACTION:
          await this.processTransactionNotification(data);
          break;
        case this.notificationTypes.MESSAGE:
          await this.processMessageNotification(data);
          break;
        case this.notificationTypes.STAKING_REWARD:
          await this.processStakingNotification(data);
          break;
        default:
          console.log('Background message processed');
          break;
      }
    } catch (error) {
      console.error('Background message processing error:', error);
    }
  }

  async processTransactionNotification(data) {
    // Update transaction cache
    const transactions = await AsyncStorage.getItem('pendingTransactions');
    if (transactions) {
      const txList = JSON.parse(transactions);
      const updatedTx = txList.find(tx => tx.hash === data.transactionHash);
      if (updatedTx) {
        updatedTx.status = data.status;
        await AsyncStorage.setItem('pendingTransactions', JSON.stringify(txList));
      }
    }
  }

  async processMessageNotification(data) {
    // Update unread message count
    const currentCount = await AsyncStorage.getItem('unreadMessages');
    const count = parseInt(currentCount || '0') + 1;
    await AsyncStorage.setItem('unreadMessages', count.toString());
  }

  async processStakingNotification(data) {
    // Update staking rewards cache
    const rewards = await AsyncStorage.getItem('pendingRewards');
    if (rewards) {
      const rewardList = JSON.parse(rewards);
      rewardList.push({
        id: data.rewardId,
        amount: data.amount,
        timestamp: Date.now()
      });
      await AsyncStorage.setItem('pendingRewards', JSON.stringify(rewardList));
    }
  }

  handleQuickReply(data) {
    // Handle quick reply functionality
    console.log('Quick reply:', data);
    // This would send a message through the chat service
  }

  // Notification creation methods
  async sendTransactionNotification(transactionData) {
    const { hash, amount, type, status } = transactionData;
    
    this.showLocalNotification({
      title: 'Transaction Update',
      message: `${type} transaction ${status}: ${amount} ETH`,
      type: this.notificationTypes.TRANSACTION,
      data: {
        type: this.notificationTypes.TRANSACTION,
        transactionHash: hash,
        amount,
        status
      },
      actions: [
        { id: 'view', title: 'View Details' },
        { id: 'dismiss', title: 'Dismiss' }
      ]
    });
  }

  async sendNFTSoldNotification(nftData) {
    const { id, name, price, buyer } = nftData;
    
    this.showLocalNotification({
      title: 'NFT Sold! 🎉',
      message: `${name} sold for ${price} ETH`,
      type: this.notificationTypes.NFT_SOLD,
      data: {
        type: this.notificationTypes.NFT_SOLD,
        nftId: id,
        price,
        buyer
      },
      actions: [
        { id: 'view', title: 'View NFT' },
        { id: 'dismiss', title: 'Dismiss' }
      ]
    });
  }

  async sendStakingRewardNotification(rewardData) {
    const { amount, period } = rewardData;
    
    this.showLocalNotification({
      title: 'Staking Rewards Available! 💰',
      message: `You earned ${amount} BEZ tokens`,
      type: this.notificationTypes.STAKING_REWARD,
      data: {
        type: this.notificationTypes.STAKING_REWARD,
        amount,
        period
      },
      actions: [
        { id: 'view', title: 'Claim Rewards' },
        { id: 'dismiss', title: 'Later' }
      ]
    });
  }

  async sendMessageNotification(messageData) {
    const { sender, message, chatId } = messageData;
    
    this.showLocalNotification({
      title: `Message from ${sender}`,
      message: message,
      type: this.notificationTypes.MESSAGE,
      data: {
        type: this.notificationTypes.MESSAGE,
        chatId,
        sender
      },
      actions: [
        { id: 'reply', title: 'Reply', input: true },
        { id: 'view', title: 'Open Chat' }
      ]
    });
  }

  async sendSecurityAlert(alertData) {
    const { type, details } = alertData;
    
    this.showLocalNotification({
      title: 'Security Alert ⚠️',
      message: `${type}: ${details}`,
      type: this.notificationTypes.SECURITY_ALERT,
      data: {
        type: this.notificationTypes.SECURITY_ALERT,
        alertType: type,
        details
      },
      actions: [
        { id: 'view', title: 'Review Security' },
        { id: 'dismiss', title: 'Dismiss' }
      ]
    });
  }

  async sendPriceAlert(priceData) {
    const { symbol, price, change, threshold } = priceData;
    
    this.showLocalNotification({
      title: `Price Alert: ${symbol}`,
      message: `${symbol} is now $${price} (${change}%)`,
      type: this.notificationTypes.PRICE_ALERT,
      data: {
        type: this.notificationTypes.PRICE_ALERT,
        symbol,
        price,
        change,
        threshold
      },
      actions: [
        { id: 'view', title: 'View Chart' },
        { id: 'dismiss', title: 'Dismiss' }
      ]
    });
  }

  // Utility methods
  async getFCMToken() {
    return this.fcmToken || await AsyncStorage.getItem('fcmToken');
  }

  async clearAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  async clearNotificationById(id) {
    PushNotification.cancelLocalNotifications({ id });
  }

  async getDeliveredNotifications() {
    return new Promise((resolve) => {
      PushNotification.getDeliveredNotifications((notifications) => {
        resolve(notifications);
      });
    });
  }

  async setBadgeCount(count) {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  async clearBadge() {
    PushNotification.setApplicationIconBadgeNumber(0);
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
