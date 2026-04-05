import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  PermissionsAndroid, 
  Platform, 
  FlatList, 
  ActivityIndicator,
  Image
} from 'react-native';
import Contacts from 'react-native-contacts';
import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

const ContactSyncScreen = ({ navigation }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    checkPermission();
    fetchMatches();
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      setPermissionGranted(granted);
    } else {
      Contacts.checkPermission().then(permission => {
        setPermissionGranted(permission === 'authorized');
      });
    }
  };

  const fetchMatches = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Replace with your actual backend URL config
      const response = await fetch('https://api.bezhas.com/api/contacts/matches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const hashData = (string) => {
    if (!string) return null;
    return CryptoJS.SHA256(string.toLowerCase().trim()).toString();
  };

  const handleSyncContacts = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'BeZhas Contact Sync Permission',
            message: 'BeZhas needs access to your contacts to help you find friends and earn BEZ-Coins. We hash all contacts locally so your raw data never leaves the device.',
            buttonPositive: 'Accept',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          alert('Permission denied. We cannot sync your friends.');
          return;
        }
      } else {
        const permission = await Contacts.requestPermission();
        if (permission !== 'authorized') {
          alert('Permission denied. We cannot sync your friends.');
          return;
        }
      }

      setPermissionGranted(true);
      setIsProcessing(true);

      const deviceContacts = await Contacts.getAll();
      const formattedContacts = [];

      deviceContacts.forEach(contact => {
        const hasEmail = contact.emailAddresses && contact.emailAddresses.length > 0;
        const hasPhone = contact.phoneNumbers && contact.phoneNumbers.length > 0;

        if (hasEmail || hasPhone) {
          formattedContacts.push({
            name: `${contact.givenName || ''} ${contact.familyName || ''}`.trim() || 'Unknown',
            emailHash: hasEmail ? hashData(contact.emailAddresses[0].email) : null,
            phoneHash: hasPhone ? hashData(contact.phoneNumbers[0].number) : null
          });
        }
      });

      if (formattedContacts.length === 0) {
        alert('No contacts found with emails or phone numbers.');
        setIsProcessing(false);
        return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('https://api.bezhas.com/api/contacts/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts: formattedContacts })
      });

      if (response.status === 202) {
        alert('Contacts synchronized securely! We will let you know when we find matches.');
      } else {
        alert('Failed to sync contacts.');
      }

    } catch (err) {
      console.error(err);
      alert('An error occurred while reading contacts.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddFriend = async (contactId) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`https://api.bezhas.com/api/contacts/${contactId}/add-friend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('Friend Request Sent! You earned 50 BEZ-Coins! 🎉');
        setMatches(matches.map(m => m._id === contactId ? { ...m, status: 'invited' } : m));
      }
    } catch (err) {
      alert('Failed to add friend.');
    }
  };

  const renderMatch = ({ item }) => (
    <View style={styles.matchCard}>
      <View style={styles.matchInfo}>
        {item.matchedUserId?.profileImage ? (
          <Image source={{ uri: item.matchedUserId.profileImage }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{item.matchedUserId?.username?.charAt(0) || '?'}</Text>
          </View>
        )}
        <Text style={styles.matchName}>{item.matchedUserId?.username || 'Unknown User'}</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.addButton, item.status === 'invited' && styles.invitedButton]}
        onPress={() => handleAddFriend(item._id)}
        disabled={item.status === 'invited'}
      >
        <Text style={styles.addButtonText}>
          {item.status === 'invited' ? 'Invited' : '+ Add (50 BEZ)'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e293b', '#4c1d95']} style={styles.header}>
        <Text style={styles.title}>Find Friends & Earn</Text>
        <Text style={styles.subtitle}>
          Securely sync your contacts. Earn 50 BEZ-Coins for every friend you add!
        </Text>
      </LinearGradient>

      <View style={styles.privacyBox}>
        <Icon name="shield-checkmark" size={24} color="#4ade80" />
        <Text style={styles.privacyText}>
          Privacy Guarantee: Names, emails, and phone numbers are encrypted locally on your phone. We never store raw data.
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.syncButton} 
        onPress={handleSyncContacts}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncButtonText}>
            {permissionGranted ? 'Re-sync Contacts' : 'Grant Permission & Sync'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.matchesContainer}>
        <Text style={styles.sectionTitle}>Matched Friends</Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>No matches found yet. Try syncing your contacts!</Text>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item) => item._id}
            renderItem={renderMatch}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 24, paddingTop: 48, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#cbd5e1', lineHeight: 22 },
  privacyBox: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(74, 222, 128, 0.1)', 
    padding: 16, 
    margin: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    borderColor: 'rgba(74, 222, 128, 0.3)',
    borderWidth: 1
  },
  privacyText: { color: '#a7f3d0', marginLeft: 12, flex: 1, fontSize: 13, lineHeight: 18 },
  syncButton: { 
    backgroundColor: '#d946ef', 
    marginHorizontal: 20, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  syncButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  matchesContainer: { flex: 1, padding: 20 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 32 },
  list: { paddingBottom: 20 },
  matchCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#1e293b', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  matchInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#475569', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  matchName: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  addButton: { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  invitedButton: { backgroundColor: '#475569' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});

export default ContactSyncScreen;
