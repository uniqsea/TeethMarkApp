import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  from: string;
  onReject: () => void;
  onRejectWithBusy: () => void;
  esp32Connected?: boolean; // ESP32连接状态
  selectedButton?: number | null; // 当前ESP32选中的按钮 (0:挂断, 1:接听, 2:忙碌)
  status?: 'idle' | 'sending' | 'sent' | 'failed';
}

export default function IncomingTwilioCallCard({ 
  visible, 
  from, 
  onReject, 
  onRejectWithBusy,
  esp32Connected = false,
  selectedButton = null,
  status = 'idle'
}: Props) {
  if (!visible) return null;

  const getButtonStyle = (buttonIndex: number) => {
    const isSelected = selectedButton === buttonIndex;
    const baseStyle = [styles.actionBtn];
    
    switch (buttonIndex) {
      case 0: // 挂断
        return [...baseStyle, styles.reject, isSelected && styles.selectedButton];
      case 1: // 接听（已移除按钮，保留样式占位）
        return [...baseStyle, styles.accept, isSelected && styles.selectedButton];
      case 2: // 忙碌短信
        return [...baseStyle, styles.busy, isSelected && styles.selectedButton];
      default:
        return baseStyle;
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialIcons name="phone" size={28} color="#fff" />
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Incoming Call</Text>
            <Text style={styles.subTitle}>{from || 'Unknown'}</Text>
            {esp32Connected && (
              <Text style={styles.esp32Status}>🦷 Gesture Control Available</Text>
            )}
          </View>
        </View>

        {status === 'idle' && (
          <View style={styles.actions}>
            <TouchableOpacity style={getButtonStyle(0)} onPress={onReject}>
              <FontAwesome5 name="phone-slash" size={20} color="#fff" />
              <Text style={styles.actionText}>Decline</Text>
            </TouchableOpacity>
            {/* 接听按钮已移除 */}
            <TouchableOpacity style={getButtonStyle(2)} onPress={onRejectWithBusy}>
              <MaterialIcons name="message" size={20} color="#fff" />
              <Text style={styles.actionText}>SMS</Text>
            </TouchableOpacity>
          </View>
        )}

        {status !== 'idle' && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>
              {status === 'sending' ? 'Sending SMS…' : status === 'sent' ? 'SMS sent' : 'SMS failed'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#111827',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#14b8a6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  subTitle: {
    color: '#cbd5e1',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
  },
  accept: { backgroundColor: '#10b981' },
  reject: { backgroundColor: '#ef4444' },
  busy: { backgroundColor: '#0ea5e9' },
  selectedButton: {
    borderWidth: 3,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 12,
  },
  esp32Status: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBox: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  statusText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});


