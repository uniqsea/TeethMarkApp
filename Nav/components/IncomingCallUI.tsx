import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface IncomingCallUIProps {
  visible: boolean;
  callerId: string;
  onAccept: () => void;
  onReject: () => void;
  onRejectWithMessage: () => void;
}

export default function IncomingCallUI({
  visible,
  callerId,
  onAccept,
  onReject,
  onRejectWithMessage,
}: IncomingCallUIProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <BlurView intensity={80} style={styles.blurContainer}>
        <View style={styles.callContainer}>
          {/* Caller Info */}
          <View style={styles.callerInfo}>
            <View style={styles.avatarContainer}>
              <MaterialIcons name="person" size={60} color="white" />
            </View>
            <Text style={styles.callerName}>{callerId}</Text>
            <Text style={styles.callStatus}>Incoming Call</Text>
          </View>

          {/* Call Actions */}
          <View style={styles.actionsContainer}>
            {/* Reject */}
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={onReject}
            >
              <FontAwesome5 name="phone-slash" size={24} color="white" />
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
            >
              <FontAwesome5 name="phone" size={24} color="white" />
            </TouchableOpacity>

            {/* Reject with Message */}
            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton]}
              onPress={onRejectWithMessage}
            >
              <MaterialIcons name="message" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Action Labels */}
          <View style={styles.labelsContainer}>
            <Text style={styles.actionLabel}>Decline</Text>
            <Text style={styles.actionLabel}>Accept</Text>
            <Text style={styles.actionLabel}>I'm Busy</Text>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  callContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 60,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: width * 0.8,
    marginBottom: 20,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  messageButton: {
    backgroundColor: '#2196F3',
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.8,
  },
  actionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    width: 70,
  },
});
