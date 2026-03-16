import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  size?: number;
  style?: any;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  size = 24, 
  style 
}) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(isDark ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isDark ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isDark, animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.primary, theme.colors.surface],
  });

  const iconColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['white', theme.colors.primary],
  });

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.toggleContainer,
          {
            backgroundColor,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Animated.View style={styles.iconContainer}>
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={size}
            color={iconColor}
          />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    width: 50,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ThemeToggle;