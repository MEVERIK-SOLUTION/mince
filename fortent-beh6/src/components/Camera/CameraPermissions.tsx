import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

interface CameraPermissionsProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

export const CameraPermissions: React.FC<CameraPermissionsProps> = ({
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [cameraPermission, setCameraPermission] = useState<string | null>(null);
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      
      setCameraPermission(cameraStatus.status);
      setMediaLibraryPermission(mediaStatus.status);

      if (cameraStatus.status === 'granted' && mediaStatus.status === 'granted') {
        onPermissionGranted();
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermissions = async () => {
    if (isRequesting) return;

    try {
      setIsRequesting(true);

      // Požádat o oprávnění ke kameře
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraResult.status);

      if (cameraResult.status !== 'granted') {
        Alert.alert(
          'Oprávnění ke kameře',
          'Pro fotografování mincí je potřeba přístup ke kameře.',
          [
            { text: 'Zrušit', onPress: onPermissionDenied },
            { text: 'Nastavení', onPress: openSettings }
          ]
        );
        return;
      }

      // Požádat o oprávnění k mediální knihovně
      const mediaResult = await MediaLibrary.requestPermissionsAsync();
      setMediaLibraryPermission(mediaResult.status);

      if (mediaResult.status !== 'granted') {
        Alert.alert(
          'Oprávnění k ukládání',
          'Pro ukládání fotografií je potřeba přístup k mediální knihovně.',
          [
            { text: 'Zrušit', onPress: onPermissionDenied },
            { text: 'Nastavení', onPress: openSettings }
          ]
        );
        return;
      }

      // Všechna oprávnění udělena
      onPermissionGranted();

    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Chyba', 'Nepodařilo se získat oprávnění');
      onPermissionDenied();
    } finally {
      setIsRequesting(false);
    }
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  const getPermissionStatus = (status: string | null) => {
    switch (status) {
      case 'granted':
        return { icon: 'checkmark-circle', color: '#4CAF50', text: 'Povoleno' };
      case 'denied':
        return { icon: 'close-circle', color: '#F44336', text: 'Zamítnuto' };
      case 'undetermined':
        return { icon: 'help-circle', color: '#FF9800', text: 'Nevyřešeno' };
      default:
        return { icon: 'help-circle', color: '#9E9E9E', text: 'Neznámé' };
    }
  };

  const cameraStatus = getPermissionStatus(cameraPermission);
  const mediaStatus = getPermissionStatus(mediaLibraryPermission);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="camera" size={64} color="#007AFF" />
        <Text style={styles.title}>Oprávnění ke kameře</Text>
        <Text style={styles.subtitle}>
          Pro fotografování mincí potřebujeme přístup ke kameře a ukládání fotografií
        </Text>
      </View>

      <View style={styles.permissionsContainer}>
        <View style={styles.permissionItem}>
          <View style={styles.permissionInfo}>
            <Ionicons name="camera" size={24} color="#666" />
            <Text style={styles.permissionText}>Přístup ke kameře</Text>
          </View>
          <View style={styles.permissionStatus}>
            <Ionicons 
              name={cameraStatus.icon as any} 
              size={20} 
              color={cameraStatus.color} 
            />
            <Text style={[styles.statusText, { color: cameraStatus.color }]}>
              {cameraStatus.text}
            </Text>
          </View>
        </View>

        <View style={styles.permissionItem}>
          <View style={styles.permissionInfo}>
            <Ionicons name="images" size={24} color="#666" />
            <Text style={styles.permissionText}>Ukládání fotografií</Text>
          </View>
          <View style={styles.permissionStatus}>
            <Ionicons 
              name={mediaStatus.icon as any} 
              size={20} 
              color={mediaStatus.color} 
            />
            <Text style={[styles.statusText, { color: mediaStatus.color }]}>
              {mediaStatus.text}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Proč potřebujeme tato oprávnění?</Text>
        <View style={styles.infoItem}>
          <Ionicons name="camera" size={16} color="#666" />
          <Text style={styles.infoText}>
            Kamera pro fotografování mincí a jejich automatické rozpoznání
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="save" size={16} color="#666" />
          <Text style={styles.infoText}>
            Ukládání fotografií do vaší kolekce pro pozdější prohlížení
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark" size={16} color="#666" />
          <Text style={styles.infoText}>
            Vaše fotografie zůstávají pouze ve vašem zařízení
          </Text>
        </View>
      </View>

      <View style={styles.buttonsContainer}>
        {(cameraPermission !== 'granted' || mediaLibraryPermission !== 'granted') && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={requestPermissions}
            disabled={isRequesting}
          >
            <Text style={styles.primaryButtonText}>
              {isRequesting ? 'Žádám o oprávnění...' : 'Povolit přístup'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onPermissionDenied}
        >
          <Text style={styles.secondaryButtonText}>Pokračovat bez kamery</Text>
        </TouchableOpacity>

        {(cameraPermission === 'denied' || mediaLibraryPermission === 'denied') && (
          <TouchableOpacity
            style={[styles.button, styles.settingsButton]}
            onPress={openSettings}
          >
            <Ionicons name="settings" size={16} color="#007AFF" />
            <Text style={styles.settingsButtonText}>Otevřít nastavení</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoContainer: {
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  buttonsContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingsButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraPermissions;