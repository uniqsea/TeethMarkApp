import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';

interface PulseAnimationProps {
  size?: number;
  color?: string;
  isActive?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const PulseAnimation: React.FC<PulseAnimationProps> = ({
  size = 60,
  color = '#007AFF',
  isActive = false,
  style,
  children
}) => {
  const scaleAnim1 = useRef(new Animated.Value(0.8)).current;
  const scaleAnim2 = useRef(new Animated.Value(0.8)).current;
  const opacityAnim1 = useRef(new Animated.Value(1)).current;
  const opacityAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const createPulseAnimation = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 1.4,
                duration: 2000,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 2000,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 0,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ])
        );

      const animation1 = createPulseAnimation(scaleAnim1, opacityAnim1, 0);
      const animation2 = createPulseAnimation(scaleAnim2, opacityAnim2, 1000);

      animation1.start();
      animation2.start();

      return () => {
        animation1.stop();
        animation2.stop();
      };
    } else {
      scaleAnim1.setValue(0.8);
      scaleAnim2.setValue(0.8);
      opacityAnim1.setValue(0);
      opacityAnim2.setValue(0);
    }
  }, [isActive]);

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      {isActive && (
        <>
          <Animated.View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: opacityAnim1,
              transform: [{ scale: scaleAnim1 }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: opacityAnim2,
              transform: [{ scale: scaleAnim2 }],
            }}
          />
        </>
      )}
      {children}
    </View>
  );
};

export const BreathingDot: React.FC<{ color?: string; size?: number; isActive?: boolean }> = ({
  color = '#34C759',
  size = 12,
  isActive = false
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      breathe.start();
      return () => breathe.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isActive]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: scaleAnim }],
      }}
    />
  );
};