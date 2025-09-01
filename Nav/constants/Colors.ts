// Modern unified color system
const tintColorLight = '#007AFF';
const tintColorDark = '#007AFF';

export default {
  light: {
    text: '#1C1C1E',
    background: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
    surface: '#F2F2F7',
    border: 'rgba(60, 60, 67, 0.29)',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorDark,
    surface: '#1C1C1E',
    border: 'rgba(255, 255, 255, 0.1)',
    success: '#32D74B',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
};
