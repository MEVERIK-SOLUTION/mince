import { Animated, Easing } from 'react-native';

// Základní animační konstanty
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 800,
};

export const EASING = {
  EASE_IN_OUT: Easing.inOut(Easing.ease),
  EASE_OUT: Easing.out(Easing.ease),
  EASE_IN: Easing.in(Easing.ease),
  BOUNCE: Easing.bounce,
  ELASTIC: Easing.elastic(1),
  BACK: Easing.back(1.5),
  BEZIER: Easing.bezier(0.25, 0.46, 0.45, 0.94),
};

// Fade animace
export const createFadeAnimation = (
  animatedValue: Animated.Value,
  toValue: number,
  duration: number = ANIMATION_DURATION.NORMAL,
  easing: Animated.EasingFunction = EASING.EASE_IN_OUT
) => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    easing,
    useNativeDriver: true,
  });
};

// Scale animace
export const createScaleAnimation = (
  animatedValue: Animated.Value,
  toValue: number,
  duration: number = ANIMATION_DURATION.NORMAL,
  easing: Animated.EasingFunction = EASING.EASE_IN_OUT
) => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    easing,
    useNativeDriver: true,
  });
};

// Slide animace
export const createSlideAnimation = (
  animatedValue: Animated.Value,
  toValue: number,
  duration: number = ANIMATION_DURATION.NORMAL,
  easing: Animated.EasingFunction = EASING.EASE_IN_OUT
) => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    easing,
    useNativeDriver: true,
  });
};

// Rotation animace
export const createRotationAnimation = (
  animatedValue: Animated.Value,
  duration: number = ANIMATION_DURATION.SLOW,
  easing: Animated.EasingFunction = Easing.linear
) => {
  return Animated.loop(
    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: true,
    })
  );
};

// Spring animace
export const createSpringAnimation = (
  animatedValue: Animated.Value,
  toValue: number,
  tension: number = 100,
  friction: number = 8
) => {
  return Animated.spring(animatedValue, {
    toValue,
    tension,
    friction,
    useNativeDriver: true,
  });
};

// Pulse animace
export const createPulseAnimation = (
  animatedValue: Animated.Value,
  minValue: number = 0.8,
  maxValue: number = 1.2,
  duration: number = ANIMATION_DURATION.SLOW
) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: maxValue,
        duration: duration / 2,
        easing: EASING.EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: minValue,
        duration: duration / 2,
        easing: EASING.EASE_IN_OUT,
        useNativeDriver: true,
      }),
    ])
  );
};

// Shake animace
export const createShakeAnimation = (
  animatedValue: Animated.Value,
  intensity: number = 10,
  duration: number = ANIMATION_DURATION.FAST
) => {
  return Animated.sequence([
    Animated.timing(animatedValue, {
      toValue: intensity,
      duration: duration / 4,
      easing: EASING.EASE_IN_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: -intensity,
      duration: duration / 2,
      easing: EASING.EASE_IN_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: duration / 4,
      easing: EASING.EASE_IN_OUT,
      useNativeDriver: true,
    }),
  ]);
};

// Bounce animace
export const createBounceAnimation = (
  animatedValue: Animated.Value,
  toValue: number,
  duration: number = ANIMATION_DURATION.NORMAL
) => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    easing: EASING.BOUNCE,
    useNativeDriver: true,
  });
};

// Stagger animace pro seznamy
export const createStaggerAnimation = (
  animatedValues: Animated.Value[],
  toValue: number,
  staggerDelay: number = 100,
  duration: number = ANIMATION_DURATION.NORMAL
) => {
  return Animated.stagger(
    staggerDelay,
    animatedValues.map(value =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: EASING.EASE_OUT,
        useNativeDriver: true,
      })
    )
  );
};

// Parallax animace
export const createParallaxAnimation = (
  scrollY: Animated.Value,
  inputRange: number[],
  outputRange: number[]
) => {
  return scrollY.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
};

// Komplexní animace pro karty mincí
export const createCoinCardAnimation = (
  animatedValue: Animated.Value,
  delay: number = 0
) => {
  return Animated.sequence([
    Animated.delay(delay),
    Animated.parallel([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: ANIMATION_DURATION.NORMAL,
        easing: EASING.EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: ANIMATION_DURATION.NORMAL,
        easing: EASING.BACK,
        useNativeDriver: true,
      }),
    ]),
  ]);
};

// Animace pro přechody mezi obrazovkami
export const createScreenTransition = (
  animatedValue: Animated.Value,
  direction: 'left' | 'right' | 'up' | 'down' = 'right'
) => {
  const directions = {
    left: { from: -100, to: 0 },
    right: { from: 100, to: 0 },
    up: { from: -100, to: 0 },
    down: { from: 100, to: 0 },
  };

  return Animated.timing(animatedValue, {
    toValue: directions[direction].to,
    duration: ANIMATION_DURATION.NORMAL,
    easing: EASING.EASE_OUT,
    useNativeDriver: true,
  });
};

// Animace pro loading indikátory
export const createLoadingAnimation = (animatedValue: Animated.Value) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: ANIMATION_DURATION.SLOW,
        easing: EASING.EASE_IN_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: ANIMATION_DURATION.SLOW,
        easing: EASING.EASE_IN_OUT,
        useNativeDriver: true,
      }),
    ])
  );
};

// Animace pro modály
export const createModalAnimation = (
  animatedValue: Animated.Value,
  isVisible: boolean
) => {
  return Animated.parallel([
    Animated.timing(animatedValue, {
      toValue: isVisible ? 1 : 0,
      duration: ANIMATION_DURATION.NORMAL,
      easing: EASING.EASE_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: isVisible ? 1 : 0.8,
      duration: ANIMATION_DURATION.NORMAL,
      easing: EASING.EASE_OUT,
      useNativeDriver: true,
    }),
  ]);
};

// Animace pro swipe gesta
export const createSwipeAnimation = (
  animatedValue: Animated.Value,
  velocity: number,
  direction: 'left' | 'right'
) => {
  const toValue = direction === 'left' ? -100 : 100;
  
  return Animated.timing(animatedValue, {
    toValue,
    duration: Math.min(Math.abs(velocity) * 100, ANIMATION_DURATION.NORMAL),
    easing: EASING.EASE_OUT,
    useNativeDriver: true,
  });
};

// Animace pro pull-to-refresh
export const createPullToRefreshAnimation = (
  animatedValue: Animated.Value,
  isRefreshing: boolean
) => {
  if (isRefreshing) {
    return createRotationAnimation(animatedValue, 1000);
  } else {
    return Animated.timing(animatedValue, {
      toValue: 0,
      duration: ANIMATION_DURATION.FAST,
      easing: EASING.EASE_OUT,
      useNativeDriver: true,
    });
  }
};

// Animace pro floating action button
export const createFABAnimation = (
  animatedValue: Animated.Value,
  isVisible: boolean
) => {
  return Animated.parallel([
    Animated.timing(animatedValue, {
      toValue: isVisible ? 1 : 0,
      duration: ANIMATION_DURATION.NORMAL,
      easing: EASING.EASE_OUT,
      useNativeDriver: true,
    }),
    Animated.spring(animatedValue, {
      toValue: isVisible ? 1 : 0.8,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }),
  ]);
};

// Utility funkce pro interpolace
export const interpolateColor = (
  animatedValue: Animated.Value,
  inputRange: number[],
  outputRange: string[]
) => {
  return animatedValue.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
};

export const interpolateSize = (
  animatedValue: Animated.Value,
  inputRange: number[],
  outputRange: number[]
) => {
  return animatedValue.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
};

// Hook pro animace
export const useAnimatedValue = (initialValue: number = 0) => {
  return new Animated.Value(initialValue);
};

export const useAnimatedValueXY = (initialValue: { x: number; y: number } = { x: 0, y: 0 }) => {
  return new Animated.ValueXY(initialValue);
};

// Předpřipravené animační sekvence
export const PRESET_ANIMATIONS = {
  fadeIn: (animatedValue: Animated.Value) => 
    createFadeAnimation(animatedValue, 1),
  
  fadeOut: (animatedValue: Animated.Value) => 
    createFadeAnimation(animatedValue, 0),
  
  scaleIn: (animatedValue: Animated.Value) => 
    createScaleAnimation(animatedValue, 1),
  
  scaleOut: (animatedValue: Animated.Value) => 
    createScaleAnimation(animatedValue, 0),
  
  slideInLeft: (animatedValue: Animated.Value) => 
    createSlideAnimation(animatedValue, 0),
  
  slideInRight: (animatedValue: Animated.Value) => 
    createSlideAnimation(animatedValue, 0),
  
  bounceIn: (animatedValue: Animated.Value) => 
    createBounceAnimation(animatedValue, 1),
  
  pulse: (animatedValue: Animated.Value) => 
    createPulseAnimation(animatedValue),
  
  shake: (animatedValue: Animated.Value) => 
    createShakeAnimation(animatedValue),
  
  rotate: (animatedValue: Animated.Value) => 
    createRotationAnimation(animatedValue),
};

export default {
  ANIMATION_DURATION,
  EASING,
  createFadeAnimation,
  createScaleAnimation,
  createSlideAnimation,
  createRotationAnimation,
  createSpringAnimation,
  createPulseAnimation,
  createShakeAnimation,
  createBounceAnimation,
  createStaggerAnimation,
  createParallaxAnimation,
  createCoinCardAnimation,
  createScreenTransition,
  createLoadingAnimation,
  createModalAnimation,
  createSwipeAnimation,
  createPullToRefreshAnimation,
  createFABAnimation,
  interpolateColor,
  interpolateSize,
  useAnimatedValue,
  useAnimatedValueXY,
  PRESET_ANIMATIONS,
};