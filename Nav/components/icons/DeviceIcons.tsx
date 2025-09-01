import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const ToothIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C9.24 2 7 4.24 7 7v3c0 1.1.9 2 2 2h2v8c0 1.1.9 2 2 2s2-.9 2-2v-8h2c1.1 0 2-.9 2-2V7c0-2.76-2.24-5-5-5z"
      fill={color}
    />
    <Path
      d="M10 15v5c0 .55.45 1 1 1s1-.45 1-1v-5h-2z"
      fill={color}
      fillOpacity="0.7"
    />
  </Svg>
);

export const BluetoothIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71L13.41 12l4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"
      fill={color}
    />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle
      cx="11"
      cy="11"
      r="8"
      stroke={color}
      strokeWidth="2"
    />
    <Path
      d="m21 21-4.35-4.35"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const SignalIcon: React.FC<IconProps & { strength?: number }> = ({ 
  size = 24, 
  color = '#FFFFFF', 
  strength = 3 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="17" width="3" height="5" rx="1.5" fill={strength >= 1 ? color : `${color}40`} />
    <Rect x="7" y="12" width="3" height="10" rx="1.5" fill={strength >= 2 ? color : `${color}40`} />
    <Rect x="12" y="8" width="3" height="14" rx="1.5" fill={strength >= 3 ? color : `${color}40`} />
    <Rect x="17" y="4" width="3" height="18" rx="1.5" fill={strength >= 4 ? color : `${color}40`} />
  </Svg>
);

export const ConnectedIcon: React.FC<IconProps> = ({ size = 24, color = '#34C759' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path
      d="m9 12 2 2 4-4"
      stroke="#FFFFFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const DisconnectedIcon: React.FC<IconProps> = ({ size = 24, color = '#8E8E93' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Circle cx="12" cy="12" r="3" fill={color} />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 24, color = '#C7C7CC' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="m9 18 6-6-6-6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21 3v5h-5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 21v-5h5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const WaveIcon: React.FC<IconProps> = ({ size = 24, color = '#007AFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <G opacity="0.3">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1" />
    </G>
    <G opacity="0.6">
      <Circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1" />
    </G>
    <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
    <Circle cx="12" cy="12" r="2" fill={color} />
  </Svg>
);