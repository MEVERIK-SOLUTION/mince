import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Switch, Slider } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  hapticFeedback: boolean;
  voiceOver: boolean;
  largeText: boolean;
  colorBlindMode: string;
}

interface AccessibilityMenuProps {
  visible: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AccessibilitySettings) => void;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: 16,
  highContrast: false,
  reduceMotion: false,
  screenReader: false,
  hapticFeedback: true,
  voiceOver: false,
  largeText: false,
  colorBlindMode: 'none'
};

const COLOR_BLIND_MODES = [
  { value: 'none', label: 'Žádný', description: 'Standardní barvy' },
  { value: 'protanopia', label: 'Protanopie', description: 'Červeno-zelená barvoslepost (typ 1)' },
  { value: 'deuteranopia', label: 'Deuteranopie', description: 'Červeno-zelená barvoslepost (typ 2)' },
  { value: 'tritanopia', label: 'Tritanopie', description: 'Modro-žlutá barvoslepost' },
  { value: 'monochromacy', label: 'Monochromatismus', description: 'Úplná barvoslepost' }
];

export const AccessibilityMenu: React.FC<AccessibilityMenuProps> = ({
  visible,
  onClose,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  React.useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem('accessibility_settings');
      if (stored) {
        const loadedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: AccessibilitySettings) => {
    try {
      await AsyncStorage.setItem('accessibility_settings', JSON.stringify(newSettings));
      onSettingsChange(newSettings);
    } catch (error) {
      console.error('Error saving accessibility settings:', error);
    }
  };

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  };

  const renderToggleSetting = (
    key: keyof AccessibilitySettings,
    title: string,
    description: string,
    icon: string
  ) => (
    <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.settingContent}>
        <Ionicons name={icon as any} size={24} color={theme.colors.primary} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        </View>
        <Switch
          value={settings[key] as boolean}
          onValueChange={(value) => updateSetting(key, value)}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
          thumbColor={settings[key] ? theme.colors.primary : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderSliderSetting = (
    key: keyof AccessibilitySettings,
    title: string,
    description: string,
    icon: string,
    min: number,
    max: number,
    step: number,
    unit: string
  ) => (
    <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.settingContent}>
        <Ionicons name={icon as any} size={24} color={theme.colors.primary} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
          <Text style={[styles.settingValue, { color: theme.colors.primary }]}>
            {settings[key]}{unit}
          </Text>
        </View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={settings[key] as number}
        onValueChange={(value) => updateSetting(key, value)}
        minimumTrackTintColor={theme.colors.primary}
        maximumTrackTintColor={theme.colors.border}
        thumbStyle={{ backgroundColor: theme.colors.primary }}
      />
    </View>
  );

  const renderColorBlindSetting = () => (
    <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.settingContent}>
        <Ionicons name="color-palette" size={24} color={theme.colors.primary} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            Režim pro barvoslepé
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            Přizpůsobení barev pro různé typy barvosleposti
          </Text>
        </View>
      </View>
      
      <View style={styles.colorBlindOptions}>
        {COLOR_BLIND_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[
              styles.colorBlindOption,
              {
                backgroundColor: settings.colorBlindMode === mode.value 
                  ? theme.colors.primary + '20' 
                  : theme.colors.surface,
                borderColor: settings.colorBlindMode === mode.value 
                  ? theme.colors.primary 
                  : theme.colors.border,
              }
            ]}
            onPress={() => updateSetting('colorBlindMode', mode.value)}
          >
            <Text style={[
              styles.colorBlindLabel,
              {
                color: settings.colorBlindMode === mode.value 
                  ? theme.colors.primary 
                  : theme.colors.text
              }
            ]}>
              {mode.label}
            </Text>
            <Text style={[styles.colorBlindDescription, { color: theme.colors.textSecondary }]}>
              {mode.description}
            </Text>
            {settings.colorBlindMode === mode.value && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.primary}
                style={styles.colorBlindCheck}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Přístupnost
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetSettings}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Velikost písma */}
          {renderSliderSetting(
            'fontSize',
            'Velikost písma',
            'Upravte velikost textu v aplikaci',
            'text',
            12,
            24,
            1,
            'px'
          )}

          {/* Vysoký kontrast */}
          {renderToggleSetting(
            'highContrast',
            'Vysoký kontrast',
            'Zvýší kontrast pro lepší čitelnost',
            'contrast'
          )}

          {/* Velký text */}
          {renderToggleSetting(
            'largeText',
            'Velký text',
            'Použije větší velikost textu v celé aplikaci',
            'resize'
          )}

          {/* Snížení animací */}
          {renderToggleSetting(
            'reduceMotion',
            'Snížit animace',
            'Omezí pohyb a animace v aplikaci',
            'pause'
          )}

          {/* Haptická zpětná vazba */}
          {renderToggleSetting(
            'hapticFeedback',
            'Haptická zpětná vazba',
            'Vibrace při interakci s aplikací',
            'phone-portrait'
          )}

          {/* Čtečka obrazovky */}
          {renderToggleSetting(
            'screenReader',
            'Podpora čtečky obrazovky',
            'Optimalizace pro čtečky obrazovky',
            'volume-high'
          )}

          {/* VoiceOver */}
          {renderToggleSetting(
            'voiceOver',
            'VoiceOver',
            'Hlasové popisky pro navigaci',
            'chatbubble'
          )}

          {/* Režim pro barvoslepé */}
          {renderColorBlindSetting()}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Nastavení přístupnosti pomáhají přizpůsobit aplikaci vašim potřebám
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  settingItem: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  settingText: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  colorBlindOptions: {
    marginTop: 12,
    gap: 8,
  },
  colorBlindOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
  },
  colorBlindLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  colorBlindDescription: {
    fontSize: 12,
  },
  colorBlindCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AccessibilityMenu;