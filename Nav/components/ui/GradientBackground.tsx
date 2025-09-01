import React from 'react';
import { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'surface';
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ 
  children, 
  style, 
  variant = 'primary' 
}) => {
  const getGradientColors = (): [string, string, ...string[]] => {
    switch (variant) {
      case 'primary':
        return ['#F8F9FA', '#E9ECEF', '#DEE2E6'];
      case 'secondary':
        return ['#FFFFFF', '#F8F9FA', '#F1F3F4'];
      case 'surface':
        return ['rgba(255, 255, 255, 0.95)', 'rgba(248, 249, 250, 0.85)'];
      default:
        return ['#F8F9FA', '#E9ECEF', '#DEE2E6'];
    }
  };

  return (
    <LinearGradient
      colors={getGradientColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
};

export const BlurCard: React.FC<GradientBackgroundProps> = ({ children, style }) => (
  <LinearGradient
    colors={['rgba(255, 255, 255, 0.9)', 'rgba(248, 249, 250, 0.8)'] as [string, string, ...string[]]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[
      {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      style,
    ]}
  >
    {children}
  </LinearGradient>
);