import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import ImagePicker from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';

// Services
import StorageService from '../services/StorageService';
import WalletService from '../services/WalletService';

const { width, height } = Dimensions.get('window');

export default function CameraScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [showNFTModal, setShowNFTModal] = useState(false);
  const [nftMetadata, setNftMetadata] = useState({
    name: '',
    description: '',
    attributes: [],
    royalty: '5'
  });
  const [flashMode, setFlashMode] = useState(RNCamera.Constants.FlashMode.off);
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' or 'video'

  const cameraRef = useRef(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const cameraPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const micPermission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const cameraResult = await request(cameraPermission);
      const micResult = await request(micPermission);

      if (cameraResult === RESULTS.GRANTED && micResult === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone permissions are required to create NFTs.',
          [
            { text: 'Cancel', onPress: () => navigation.goBack() },
            { text: 'Settings', onPress: () => openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Permission check error:', error);
      Alert.alert('Error', 'Failed to check permissions');
    }
  };

  const openSettings = () => {
    // Open device settings
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      
      const options = {
        quality: 0.8,
        base64: false,
        skipProcessing: false,
        forceUpOrientation: true,
        fixOrientation: true,
      };

      const data = await cameraRef.current.takePictureAsync(options);
      
      setCapturedMedia({
        type: 'photo',
        uri: data.uri,
        width: data.width,
        height: data.height
      });
      
      setShowNFTModal(true);
    } catch (error) {
      console.error('Take picture error:', error);
      Toast.show({
        type: 'error',
        text1: 'Camera Error',
        text2: 'Failed to capture photo'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const recordVideo = async () => {
    if (!cameraRef.current) return;

    try {
      if (isRecording) {
        // Stop recording
        cameraRef.current.stopRecording();
        setIsRecording(false);
      } else {
        // Start recording
        setIsRecording(true);
        
        const options = {
          quality: RNCamera.Constants.VideoQuality['720p'],
          maxDuration: 60, // 60 seconds max
          maxFileSize: 50 * 1024 * 1024, // 50MB max
        };

        const data = await cameraRef.current.recordAsync(options);
        
        setCapturedMedia({
          type: 'video',
          uri: data.uri,
          duration: data.duration || 0
        });
        
        setIsRecording(false);
        setShowNFTModal(true);
      }
    } catch (error) {
      console.error('Record video error:', error);
      setIsRecording(false);
      Toast.show({
        type: 'error',
        text1: 'Recording Error',
        text2: 'Failed to record video'
      });
    }
  };

  const selectFromGallery = () => {
    const options = {
      title: 'Select Media',
      mediaType: 'mixed',
      quality: 0.8,
      allowsEditing: true,
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    ImagePicker.showImagePicker(options, (response) => {
      if (response.didCancel || response.error) {
        return;
      }

      const mediaType = response.type?.startsWith('video') ? 'video' : 'photo';
      
      setCapturedMedia({
        type: mediaType,
        uri: response.uri,
        width: response.width,
        height: response.height,
        duration: response.duration || 0
      });
      
      setShowNFTModal(true);
    });
  };

  const toggleFlash = () => {
    setFlashMode(
      flashMode === RNCamera.Constants.FlashMode.off
        ? RNCamera.Constants.FlashMode.on
        : RNCamera.Constants.FlashMode.off
    );
  };

  const toggleCamera = () => {
    setCameraType(
      cameraType === RNCamera.Constants.Type.back
        ? RNCamera.Constants.Type.front
        : RNCamera.Constants.Type.back
    );
  };

  const addAttribute = () => {
    setNftMetadata(prev => ({
      ...prev,
      attributes: [...prev.attributes, { trait_type: '', value: '' }]
    }));
  };

  const updateAttribute = (index, field, value) => {
    setNftMetadata(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) => 
        i === index ? { ...attr, [field]: value } : attr
      )
    }));
  };

  const removeAttribute = (index) => {
    setNftMetadata(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index)
    }));
  };

  const createNFT = async () => {
    try {
      if (!capturedMedia) {
        Toast.show({
          type: 'error',
          text1: 'No Media',
          text2: 'Please capture or select media first'
        });
        return;
      }

      if (!nftMetadata.name.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Missing Name',
          text2: 'Please enter a name for your NFT'
        });
        return;
      }

      setIsProcessing(true);

      // Check wallet connection
      const walletStatus = WalletService.getConnectionStatus();
      if (!walletStatus.isConnected) {
        throw new Error('Wallet not connected');
      }

      // Upload media to IPFS
      const mediaFile = {
        uri: capturedMedia.uri,
        type: capturedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg',
        name: `nft_${Date.now()}.${capturedMedia.type === 'video' ? 'mp4' : 'jpg'}`
      };

      Toast.show({
        type: 'info',
        text1: 'Uploading Media',
        text2: 'Uploading to IPFS...'
      });

      const mediaUpload = await StorageService.uploadFile(mediaFile);
      
      if (!mediaUpload.success) {
        throw new Error('Failed to upload media to IPFS');
      }

      // Create metadata
      const metadata = {
        name: nftMetadata.name,
        description: nftMetadata.description,
        image: mediaUpload.ipfsHash,
        attributes: nftMetadata.attributes.filter(attr => 
          attr.trait_type.trim() && attr.value.trim()
        ),
        properties: {
          created_with: 'BeZhas Mobile App',
          creation_date: new Date().toISOString(),
          media_type: capturedMedia.type,
          creator: walletStatus.address
        },
        royalty_percentage: parseInt(nftMetadata.royalty) || 0
      };

      // Upload metadata to IPFS
      Toast.show({
        type: 'info',
        text1: 'Creating NFT',
        text2: 'Uploading metadata...'
      });

      const metadataUpload = await StorageService.uploadJSON(metadata);
      
      if (!metadataUpload.success) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      // Here you would mint the NFT using your smart contract
      // For now, we'll just show success
      Toast.show({
        type: 'success',
        text1: 'NFT Created!',
        text2: 'Your NFT has been created successfully'
      });

      // Reset state
      setCapturedMedia(null);
      setNftMetadata({
        name: '',
        description: '',
        attributes: [],
        royalty: '5'
      });
      setShowNFTModal(false);

      // Navigate back or to NFT details
      navigation.navigate('NFTs', { 
        newNFT: {
          tokenURI: metadataUpload.ipfsHash,
          metadata: metadata
        }
      });

    } catch (error) {
      console.error('Create NFT error:', error);
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: error.message || 'Failed to create NFT'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelNFTCreation = () => {
    setCapturedMedia(null);
    setNftMetadata({
      name: '',
      description: '',
      attributes: [],
      royalty: '5'
    });
    setShowNFTModal(false);
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera-alt" size={80} color="#ccc" />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={checkPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        androidRecordAudioPermissionOptions={{
          title: 'Permission to use audio recording',
          message: 'We need your permission to use your audio',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
      />

      {/* Camera Controls Overlay */}
      <View style={styles.overlay}>
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <Icon 
              name={flashMode === RNCamera.Constants.FlashMode.on ? 'flash-on' : 'flash-off'} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
            <Icon name="flip-camera-ios" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Media Type Toggle */}
        <View style={styles.mediaTypeContainer}>
          <TouchableOpacity
            style={[styles.mediaTypeButton, mediaType === 'photo' && styles.activeMediaType]}
            onPress={() => setMediaType('photo')}
          >
            <Text style={[styles.mediaTypeText, mediaType === 'photo' && styles.activeMediaTypeText]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaTypeButton, mediaType === 'video' && styles.activeMediaType]}
            onPress={() => setMediaType('video')}
          >
            <Text style={[styles.mediaTypeText, mediaType === 'video' && styles.activeMediaTypeText]}>
              Video
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.galleryButton} onPress={selectFromGallery}>
            <Icon name="photo-library" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, isRecording && styles.recordingButton]}
            onPress={mediaType === 'photo' ? takePicture : recordVideo}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <Icon 
                name={mediaType === 'photo' ? 'camera-alt' : (isRecording ? 'stop' : 'videocam')} 
                size={32} 
                color="white" 
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryButton} onPress={() => navigation.goBack()}>
            <Icon name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}
      </View>

      {/* NFT Creation Modal */}
      <Modal
        visible={showNFTModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancelNFTCreation}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={cancelNFTCreation}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create NFT</Text>
            <TouchableOpacity onPress={createNFT} disabled={isProcessing}>
              <Text style={[styles.createButton, isProcessing && styles.disabledButton]}>
                {isProcessing ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Media Preview */}
            {capturedMedia && (
              <View style={styles.mediaPreview}>
                <Text style={styles.sectionTitle}>Preview</Text>
                <View style={styles.previewContainer}>
                  <Text style={styles.mediaInfo}>
                    {capturedMedia.type === 'video' ? 'Video' : 'Photo'} captured
                  </Text>
                </View>
              </View>
            )}

            {/* Basic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <TextInput
                style={styles.input}
                placeholder="NFT Name *"
                value={nftMetadata.name}
                onChangeText={(text) => setNftMetadata(prev => ({ ...prev, name: text }))}
                maxLength={50}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                value={nftMetadata.description}
                onChangeText={(text) => setNftMetadata(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <TextInput
                style={styles.input}
                placeholder="Royalty Percentage (0-10%)"
                value={nftMetadata.royalty}
                onChangeText={(text) => setNftMetadata(prev => ({ ...prev, royalty: text }))}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            {/* Attributes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Attributes</Text>
                <TouchableOpacity onPress={addAttribute} style={styles.addButton}>
                  <Icon name="add" size={20} color="#667eea" />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {nftMetadata.attributes.map((attribute, index) => (
                <View key={index} style={styles.attributeRow}>
                  <TextInput
                    style={[styles.input, styles.attributeInput]}
                    placeholder="Trait type"
                    value={attribute.trait_type}
                    onChangeText={(text) => updateAttribute(index, 'trait_type', text)}
                  />
                  <TextInput
                    style={[styles.input, styles.attributeInput]}
                    placeholder="Value"
                    value={attribute.value}
                    onChangeText={(text) => updateAttribute(index, 'value', text)}
                  />
                  <TouchableOpacity
                    onPress={() => removeAttribute(index)}
                    style={styles.removeButton}
                  >
                    <Icon name="remove" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    marginHorizontal: 100,
    padding: 4,
  },
  mediaTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeMediaType: {
    backgroundColor: 'white',
  },
  mediaTypeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  activeMediaTypeText: {
    color: 'black',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recordingButton: {
    backgroundColor: '#ff4444',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  permissionText: {
    fontSize: 18,
    color: '#666',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  createButton: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    color: '#ccc',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  mediaPreview: {
    marginTop: 20,
  },
  previewContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  mediaInfo: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  addButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attributeInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  removeButton: {
    padding: 8,
  },
});
