import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class BiometricService {
  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics();
    this.isAvailable = false;
    this.biometryType = null;
  }

  async initialize() {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      this.isAvailable = available;
      this.biometryType = biometryType;

      console.log('Biometric availability:', { available, biometryType });
      
      return {
        available: this.isAvailable,
        type: this.biometryType
      };
    } catch (error) {
      console.error('Biometric initialization error:', error);
      return { available: false, type: null };
    }
  }

  async isSupported() {
    if (!this.isAvailable) {
      await this.initialize();
    }
    return this.isAvailable;
  }

  getBiometryType() {
    return this.biometryType;
  }

  getBiometryDisplayName() {
    switch (this.biometryType) {
      case ReactNativeBiometrics.TouchID:
        return 'Touch ID';
      case ReactNativeBiometrics.FaceID:
        return 'Face ID';
      case ReactNativeBiometrics.Biometrics:
        return Platform.OS === 'android' ? 'Fingerprint' : 'Biometrics';
      default:
        return 'Biometric Authentication';
    }
  }

  async authenticate(reason = 'Authenticate to access your wallet') {
    try {
      if (!this.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication not available'
        };
      }

      const { success, error } = await this.rnBiometrics.simplePrompt({
        promptMessage: reason,
        cancelButtonText: 'Cancel'
      });

      if (success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication error'
      };
    }
  }

  async createKeys(keyAlias = 'bezhas_biometric_key') {
    try {
      const { available } = await this.rnBiometrics.isSensorAvailable();
      
      if (!available) {
        throw new Error('Biometric sensor not available');
      }

      const { keysExist } = await this.rnBiometrics.biometricKeysExist();
      
      if (!keysExist) {
        const { publicKey } = await this.rnBiometrics.createKeys();
        await AsyncStorage.setItem('biometric_public_key', publicKey);
        return { success: true, publicKey };
      } else {
        const publicKey = await AsyncStorage.getItem('biometric_public_key');
        return { success: true, publicKey };
      }
    } catch (error) {
      console.error('Create biometric keys error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteKeys() {
    try {
      const { keysDeleted } = await this.rnBiometrics.deleteKeys();
      
      if (keysDeleted) {
        await AsyncStorage.removeItem('biometric_public_key');
        await AsyncStorage.removeItem('biometric_enabled');
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Failed to delete biometric keys'
        };
      }
    } catch (error) {
      console.error('Delete biometric keys error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSignature(payload, reason = 'Sign transaction with biometrics') {
    try {
      const { available } = await this.rnBiometrics.isSensorAvailable();
      
      if (!available) {
        throw new Error('Biometric sensor not available');
      }

      const { keysExist } = await this.rnBiometrics.biometricKeysExist();
      
      if (!keysExist) {
        throw new Error('Biometric keys not found. Please enable biometric authentication first.');
      }

      const { success, signature, error } = await this.rnBiometrics.createSignature({
        promptMessage: reason,
        payload: payload,
        cancelButtonText: 'Cancel'
      });

      if (success) {
        return {
          success: true,
          signature
        };
      } else {
        return {
          success: false,
          error: error || 'Signature creation failed'
        };
      }
    } catch (error) {
      console.error('Create signature error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async enableBiometricAuth() {
    try {
      const { available } = await this.initialize();
      
      if (!available) {
        return {
          success: false,
          error: 'Biometric authentication not available on this device'
        };
      }

      // Test authentication
      const authResult = await this.authenticate('Enable biometric authentication for BeZhas');
      
      if (!authResult.success) {
        return authResult;
      }

      // Create biometric keys
      const keyResult = await this.createKeys();
      
      if (!keyResult.success) {
        return keyResult;
      }

      // Save enabled state
      await AsyncStorage.setItem('biometric_enabled', 'true');
      
      return {
        success: true,
        message: 'Biometric authentication enabled successfully'
      };
    } catch (error) {
      console.error('Enable biometric auth error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async disableBiometricAuth() {
    try {
      // Delete biometric keys
      const deleteResult = await this.deleteKeys();
      
      if (!deleteResult.success) {
        return deleteResult;
      }

      return {
        success: true,
        message: 'Biometric authentication disabled successfully'
      };
    } catch (error) {
      console.error('Disable biometric auth error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async isBiometricEnabled() {
    try {
      const enabled = await AsyncStorage.getItem('biometric_enabled');
      const { keysExist } = await this.rnBiometrics.biometricKeysExist();
      
      return enabled === 'true' && keysExist;
    } catch (error) {
      console.error('Check biometric enabled error:', error);
      return false;
    }
  }

  async authenticateForWallet() {
    return await this.authenticate('Authenticate to access your wallet');
  }

  async authenticateForTransaction(amount, recipient) {
    const reason = `Authenticate to send ${amount} ETH to ${recipient.substring(0, 6)}...${recipient.substring(recipient.length - 4)}`;
    return await this.authenticate(reason);
  }

  async authenticateForSigning() {
    return await this.authenticate('Authenticate to sign this message');
  }

  async signWalletData(walletData) {
    try {
      const payload = JSON.stringify(walletData);
      const result = await this.createSignature(payload, 'Sign wallet data with biometrics');
      
      if (result.success) {
        return {
          success: true,
          signature: result.signature,
          payload
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Sign wallet data error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verifySignature(signature, payload) {
    try {
      // In a real implementation, you would verify the signature
      // against the stored public key and payload
      const publicKey = await AsyncStorage.getItem('biometric_public_key');
      
      if (!publicKey) {
        return {
          success: false,
          error: 'Public key not found'
        };
      }

      // This is a simplified verification
      // In production, use proper cryptographic verification
      return {
        success: true,
        verified: signature && payload && publicKey
      };
    } catch (error) {
      console.error('Verify signature error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBiometricSettings() {
    try {
      const enabled = await this.isBiometricEnabled();
      const { available, type } = await this.initialize();
      
      return {
        available,
        enabled,
        type,
        displayName: this.getBiometryDisplayName()
      };
    } catch (error) {
      console.error('Get biometric settings error:', error);
      return {
        available: false,
        enabled: false,
        type: null,
        displayName: 'Biometric Authentication'
      };
    }
  }

  // Utility methods for different authentication scenarios
  async quickAuth() {
    if (!await this.isBiometricEnabled()) {
      return { success: false, error: 'Biometric authentication not enabled' };
    }
    
    return await this.authenticate('Quick authentication');
  }

  async secureAuth(reason) {
    if (!await this.isBiometricEnabled()) {
      return { success: false, error: 'Biometric authentication not enabled' };
    }
    
    return await this.authenticate(reason);
  }

  async fallbackToPin() {
    // This would implement PIN fallback when biometrics fail
    // For now, just return a placeholder
    return {
      success: false,
      error: 'PIN fallback not implemented'
    };
  }
}

// Create singleton instance
const biometricService = new BiometricService();

export default biometricService;
