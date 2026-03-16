import React, { useState, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';
import { Canvas, useCanvasRef } from '@shopify/react-native-skia';

interface PhotoEditorProps {
  imageUri: string;
  onSave: (editedUri: string) => void;
  onCancel: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const PhotoEditor: React.FC<PhotoEditorProps> = ({
  imageUri,
  onSave,
  onCancel
}) => {
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [isProcessing, setIsProcessing] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropMode, setCropMode] = useState(false);
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenWidth
  });

  const canvasRef = useCanvasRef();

  const applyFilters = useCallback(async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const actions = [];

      // Rotace
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }

      // Ořez
      if (cropMode) {
        actions.push({
          crop: {
            originX: cropArea.x,
            originY: cropArea.y,
            width: cropArea.width,
            height: cropArea.height
          }
        });
      }

      // Filtry
      if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
        actions.push({
          brightness: brightness,
          contrast: contrast,
          saturation: saturation
        });
      }

      if (actions.length > 0) {
        const result = await manipulateAsync(
          currentUri,
          actions,
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        setCurrentUri(result.uri);
      }
    } catch (error) {
      console.error('Error applying filters:', error);
      Alert.alert('Chyba', 'Nepodařilo se aplikovat filtry');
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri, brightness, contrast, saturation, rotation, cropMode, cropArea, isProcessing]);

  const rotateImage = useCallback(async (degrees: number) => {
    try {
      setIsProcessing(true);
      const result = await manipulateAsync(
        currentUri,
        [{ rotate: degrees }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
      setRotation(prev => (prev + degrees) % 360);
    } catch (error) {
      console.error('Error rotating image:', error);
      Alert.alert('Chyba', 'Nepodařilo se otočit obrázek');
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri]);

  const flipImage = useCallback(async (flipType: FlipType) => {
    try {
      setIsProcessing(true);
      const result = await manipulateAsync(
        currentUri,
        [{ flip: flipType }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
    } catch (error) {
      console.error('Error flipping image:', error);
      Alert.alert('Chyba', 'Nepodařilo se převrátit obrázek');
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri]);

  const cropImage = useCallback(async () => {
    try {
      setIsProcessing(true);
      const result = await manipulateAsync(
        currentUri,
        [{
          crop: {
            originX: cropArea.x,
            originY: cropArea.y,
            width: cropArea.width,
            height: cropArea.height
          }
        }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
      setCropMode(false);
    } catch (error) {
      console.error('Error cropping image:', error);
      Alert.alert('Chyba', 'Nepodařilo se oříznout obrázek');
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri, cropArea]);

  const enhanceForCoins = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      // Optimalizace pro mince - zvýšení kontrastu a ostrosti
      const result = await manipulateAsync(
        currentUri,
        [{
          brightness: 0.1,
          contrast: 1.3,
          saturation: 0.8
        }],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      
      setCurrentUri(result.uri);
      setBrightness(0.1);
      setContrast(1.3);
      setSaturation(0.8);
    } catch (error) {
      console.error('Error enhancing image:', error);
      Alert.alert('Chyba', 'Nepodařilo se vylepšit obrázek');
    } finally {
      setIsProcessing(false);
    }
  }, [currentUri]);

  const resetImage = useCallback(() => {
    setCurrentUri(imageUri);
    setBrightness(0);
    setContrast(1);
    setSaturation(1);
    setRotation(0);
    setCropMode(false);
  }, [imageUri]);

  const handleSave = useCallback(() => {
    onSave(currentUri);
  }, [currentUri, onSave]);

  return (
    <View style={styles.container}>
      {/* Náhled obrázku */}
      <View style={styles.imageContainer}>
        <Canvas ref={canvasRef} style={styles.canvas}>
          {/* Zde by byl implementován canvas pro pokročilé úpravy */}
        </Canvas>
        
        {cropMode && (
          <View style={styles.cropOverlay}>
            <View 
              style={[
                styles.cropArea,
                {
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.width,
                  height: cropArea.height
                }
              ]}
            />
          </View>
        )}
      </View>

      {/* Nástroje pro úpravy */}
      <View style={styles.toolsContainer}>
        {!cropMode ? (
          <>
            {/* Základní nástroje */}
            <View style={styles.toolsRow}>
              <TouchableOpacity
                style={styles.toolButton}
                onPress={() => rotateImage(90)}
                disabled={isProcessing}
              >
                <Ionicons name="refresh" size={24} color="white" />
                <Text style={styles.toolText}>Otočit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolButton}
                onPress={() => flipImage(FlipType.Horizontal)}
                disabled={isProcessing}
              >
                <Ionicons name="swap-horizontal" size={24} color="white" />
                <Text style={styles.toolText}>Převrátit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolButton}
                onPress={() => setCropMode(true)}
                disabled={isProcessing}
              >
                <Ionicons name="crop" size={24} color="white" />
                <Text style={styles.toolText}>Oříznout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolButton}
                onPress={enhanceForCoins}
                disabled={isProcessing}
              >
                <Ionicons name="sparkles" size={24} color="white" />
                <Text style={styles.toolText}>Vylepšit</Text>
              </TouchableOpacity>
            </View>

            {/* Filtry */}
            <View style={styles.filtersContainer}>
              <Text style={styles.filterLabel}>Jas: {brightness.toFixed(1)}</Text>
              <Text style={styles.filterLabel}>Kontrast: {contrast.toFixed(1)}</Text>
              <Text style={styles.filterLabel}>Sytost: {saturation.toFixed(1)}</Text>
            </View>
          </>
        ) : (
          /* Nástroje pro ořez */
          <View style={styles.toolsRow}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setCropMode(false)}
            >
              <Ionicons name="close" size={24} color="white" />
              <Text style={styles.toolText}>Zrušit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={cropImage}
              disabled={isProcessing}
            >
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.toolText}>Potvrdit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Spodní panel s akcemi */}
      <View style={styles.bottomPanel}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onCancel}
        >
          <Text style={styles.actionButtonText}>Zrušit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={resetImage}
          disabled={isProcessing}
        >
          <Text style={styles.actionButtonText}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton]}
          onPress={handleSave}
          disabled={isProcessing}
        >
          <Text style={[styles.actionButtonText, styles.saveButtonText]}>
            {isProcessing ? 'Zpracování...' : 'Uložit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    width: screenWidth,
    height: screenWidth,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cropArea: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'white',
    borderStyle: 'dashed',
  },
  toolsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 20,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolButton: {
    alignItems: 'center',
    padding: 10,
  },
  toolText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  filterLabel: {
    color: 'white',
    fontSize: 12,
  },
  bottomPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  saveButtonText: {
    color: 'white',
  },
});

export default PhotoEditor;