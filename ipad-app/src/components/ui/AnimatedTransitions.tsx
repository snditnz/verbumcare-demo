import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { ANIMATION } from '@constants/theme';

/**
 * AnimatedTransitions
 * 
 * Reusable animated transition components for smooth state changes
 */

interface FadeInProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}

export function FadeIn({
  children,
  duration = ANIMATION.normal,
  delay = 0,
  style,
}: FadeInProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface SlideInProps {
  children: React.ReactNode;
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}

export function SlideIn({
  children,
  direction,
  distance = 50,
  duration = ANIMATION.normal,
  delay = 0,
  style,
}: SlideInProps) {
  const slideAnim = useRef(new Animated.Value(distance)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [duration, delay, distance]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return [{ translateY: slideAnim }];
      case 'down':
        return [{ translateY: slideAnim.interpolate({
          inputRange: [0, distance],
          outputRange: [0, -distance],
        }) }];
      case 'left':
        return [{ translateX: slideAnim }];
      case 'right':
        return [{ translateX: slideAnim.interpolate({
          inputRange: [0, distance],
          outputRange: [0, -distance],
        }) }];
      default:
        return [{ translateY: slideAnim }];
    }
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface ScaleInProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}

export function ScaleIn({
  children,
  duration = ANIMATION.normal,
  delay = 0,
  style,
}: ScaleInProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: duration * 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  itemDuration?: number;
  style?: ViewStyle;
}

export function StaggeredList({
  children,
  staggerDelay = 100,
  itemDuration = ANIMATION.normal,
  style,
}: StaggeredListProps) {
  return (
    <Animated.View style={style}>
      {children.map((child, index) => (
        <FadeIn
          key={index}
          duration={itemDuration}
          delay={index * staggerDelay}
        >
          {child}
        </FadeIn>
      ))}
    </Animated.View>
  );
}

interface PulseProps {
  children: React.ReactNode;
  scale?: number;
  duration?: number;
  style?: ViewStyle;
}

export function Pulse({
  children,
  scale = 1.05,
  duration = 1000,
  style,
}: PulseProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: scale,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [scale, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * ProgressiveReveal
 * 
 * Reveals content progressively as it becomes available
 */
interface ProgressiveRevealProps {
  children: React.ReactNode;
  isReady: boolean;
  placeholder?: React.ReactNode;
  duration?: number;
  style?: ViewStyle;
}

export function ProgressiveReveal({
  children,
  isReady,
  placeholder,
  duration = ANIMATION.normal,
  style,
}: ProgressiveRevealProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const placeholderFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReady) {
      Animated.parallel([
        Animated.timing(placeholderFadeAnim, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          delay: duration / 2,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isReady, duration]);

  return (
    <Animated.View style={style}>
      {!isReady && placeholder && (
        <Animated.View
          style={{
            opacity: placeholderFadeAnim,
            position: isReady ? 'absolute' : 'relative',
          }}
        >
          {placeholder}
        </Animated.View>
      )}
      <Animated.View
        style={{
          opacity: fadeAnim,
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}