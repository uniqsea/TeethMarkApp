import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Platform, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ESP32GestureHandler from '../../services/esp32/ESP32GestureHandler';
import { ScannedDevice } from '../../services/esp32/ESP32TransportService';
import { GradientBackground, BlurCard } from '../../components/ui/GradientBackground';
import { PulseAnimation, BreathingDot } from '../../components/ui/PulseAnimation';
import { 
  CollapsibleDebugPanel, 
  DebugInfoRow, 
  DebugCodeBlock 
} from '../../components/ui/CollapsibleDebugPanel';
import { 
  ToothIcon, 
  BluetoothIcon, 
  SearchIcon, 
  SignalIcon, 
  ConnectedIcon, 
  DisconnectedIcon, 
  ChevronRightIcon, 
  RefreshIcon, 
  WaveIcon 
} from '../../components/icons/DeviceIcons';

// Modern light theme colors
const Colors = {
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemRed: '#FF3B30',
  systemPurple: '#AF52DE',
  systemPink: '#FF2D92',
  systemTeal: '#5AC8FA',
  systemIndigo: '#5856D6',
  
  // Light theme colors
  primary: '#FFFFFF',
  secondary: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceVariant: '#F2F2F7',
  
  // Text colors for light theme
  onPrimary: '#000000',
  onSecondary: '#1C1C1E',
  onSurface: '#1C1C1E',
  onSurfaceVariant: '#8E8E93',
  onSurfaceMuted: '#AEAEB2',
  
  // Semantic colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
  
  // Utility
  border: 'rgba(60, 60, 67, 0.29)',
  borderMuted: 'rgba(60, 60, 67, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  
  // Legacy compatibility
  labelSecondary: '#8E8E93',
  systemGray5: '#E5E5EA',
};

const { width: screenWidth } = Dimensions.get('window');

interface DeviceCardProps {
  device: ScannedDevice;
  isConnected: boolean;
  onConnect: () => void;
  isConnecting: boolean;
}

function DeviceCard({ device, isConnected, onConnect, isConnecting }: DeviceCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ])
    ]).start();
  };

  const handlePress = () => {
    if (!isConnected && !isConnecting) {
      animatePress();
      onConnect();
    }
  };

  const getSignalStrength = (rssi?: number): number => {
    if (!rssi) return 1;
    if (rssi > -50) return 4; // Strong signal
    if (rssi > -60) return 3; // Good signal
    if (rssi > -70) return 2; // Fair signal  
    return 1; // Weak signal
  };

  return (
    <Animated.View style={[
      { transform: [{ scale: scaleAnim }], opacity: opacityAnim }
    ]}>
      <BlurCard style={styles.deviceCard}>
        <TouchableOpacity 
          style={styles.deviceCardContent} 
          onPress={handlePress}
          disabled={isConnected || isConnecting}
          activeOpacity={0.8}
        >
          <PulseAnimation 
            size={48} 
            color={isConnected ? Colors.success : Colors.info}
            isActive={isConnected}
            style={styles.deviceIconContainer}
          >
            <View style={[
              styles.deviceIcon, 
              { backgroundColor: isConnected ? Colors.success : Colors.info }
            ]}>
              <ToothIcon size={24} color={Colors.onPrimary} />
            </View>
          </PulseAnimation>
          
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{device.name || 'TeethMark Device'}</Text>
            <Text style={styles.deviceId}>{device.id.slice(-8)}</Text>
            {device.rssi && (
              <View style={styles.signalContainer}>
                <SignalIcon 
                  size={16} 
                  color={Colors.onSurfaceVariant} 
                  strength={getSignalStrength(device.rssi)}
                />
                <Text style={styles.signalText}>{device.rssi}dBm</Text>
              </View>
            )}
          </View>
          
          <View style={styles.connectionStatus}>
            {isConnecting ? (
              <View style={styles.connectingIndicator}>
                <ActivityIndicator size="small" color={Colors.info} />
                <Text style={styles.connectingText}>Connecting</Text>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                {isConnected ? (
                  <ConnectedIcon size={20} color={Colors.success} />
                ) : (
                  <DisconnectedIcon size={20} color={Colors.onSurfaceVariant} />
                )}
                <BreathingDot 
                  color={isConnected ? Colors.success : Colors.onSurfaceMuted} 
                  size={8} 
                  isActive={isConnected} 
                />
              </View>
            )}
            <ChevronRightIcon size={16} color={Colors.onSurfaceVariant} />
          </View>
        </TouchableOpacity>
      </BlurCard>
    </Animated.View>
  );
}

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  icon?: string;
  loading?: boolean;
}

function ActionButton({ title, onPress, disabled = false, variant = 'secondary', icon, loading = false }: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      animatePress();
      onPress();
    }
  };

  const getButtonStyle = () => {
    if (disabled) return [styles.actionButton, styles.actionButtonDisabled];
    switch (variant) {
      case 'primary': return [styles.actionButton, styles.actionButtonPrimary];
      case 'destructive': return [styles.actionButton, styles.actionButtonDestructive];
      default: return [styles.actionButton, styles.actionButtonSecondary];
    }
  };

  const getTextStyle = () => {
    if (disabled) return [styles.actionButtonText, styles.actionButtonTextDisabled];
    switch (variant) {
      case 'primary': return [styles.actionButtonText, styles.actionButtonTextPrimary];
      case 'destructive': return [styles.actionButtonText, styles.actionButtonTextDestructive];
      default: return [styles.actionButtonText, styles.actionButtonTextSecondary];
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? '#FFFFFF' : Colors.systemBlue} />
        ) : (
          <View style={styles.buttonContent}>
            {icon && <Text style={styles.buttonIcon}>{icon}</Text>}
            <Text style={getTextStyle()}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DevicesScreen() {
  const handlerRef = useRef(ESP32GestureHandler.getInstance());
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStrength, setConnectionStrength] = useState<number | null>(null);
  const [rawData, setRawData] = useState<string>('');
  const [lastGesture, setLastGesture] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(true);
  const [autoInitOutputs, setAutoInitOutputs] = useState(false);
  const [dataStats, setDataStats] = useState({
    messagesReceived: 0,
    messagesSent: 0,
    lastMessageTime: null as Date | null,
    connectionUptime: null as Date | null
  });
  
  // Safe area
  const insets = useSafeAreaInsets();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📝';
    setLogs(prevLogs => [`${emoji} ${timestamp} ${message}`, ...prevLogs].slice(0, 100));
  };

  useEffect(() => {
    const handler = handlerRef.current;
    let mounted = true;

    // Initialize animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Initialize processor
    (async () => {
      try {
        const success = await handler.initialize();
        if (mounted) {
          log(success ? 'ESP32 handler initialized successfully' : 'ESP32 handler initialization failed', success ? 'success' : 'error');
        }
      } catch (error) {
        if (mounted) {
          log(`Initialization error: ${error}`, 'error');
        }
      }
    })();

    // Set event listeners
    const onConnected = (deviceId: string) => {
      setConnectedId(deviceId);
      setIsConnecting(false);
      setDataStats(prev => ({
        ...prev,
        connectionUptime: new Date(),
        messagesReceived: 0,
        messagesSent: 0
      }));
      log(`Connected to device: ${deviceId}`, 'success');
    };

    const onDisconnected = () => {
      setConnectedId(null);
      setIsConnecting(false);
      setConnectionStrength(null);
      setDataStats(prev => ({ ...prev, connectionUptime: null }));
      log('Device disconnected', 'warning');
    };

    const onDevicesScanned = (scannedDevices: ScannedDevice[]) => {
      setDevices(scannedDevices);
      setIsScanning(false);
      log(`Scan completed, found ${scannedDevices.length} devices`, 'info');
    };

    const onGestureProcessed = (gesture: any) => {
      setLastGesture(gesture);
      log(`Gesture detected: ${gesture.action || gesture.type}`, 'info');
    };

    const onRawDataReceived = (data: string) => {
      setRawData(data);
      setDataStats(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1,
        lastMessageTime: new Date()
      }));
      if (debugMode) {
        log(`Raw data: ${data}`, 'info');
      }
    };

    handler.on('esp32Connected', onConnected);
    handler.on('esp32Disconnected', onDisconnected);
    handler.on('devicesScanned', onDevicesScanned);
    handler.on('gestureProcessed', onGestureProcessed);
    handler.on('rawDataReceived', onRawDataReceived);
  // apply current auto-init setting
  handler.enableAutoInitializeOutputs(autoInitOutputs);

    // Set timer for real-time connection statistics updates
    const statsUpdateTimer = setInterval(() => {
      if (dataStats.connectionUptime) {
        // Force re-render to update connection duration display
        setDataStats(prev => ({ ...prev }));
      }
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(statsUpdateTimer);
      handler.off('esp32Connected', onConnected);
      handler.off('esp32Disconnected', onDisconnected);
      handler.off('devicesScanned', onDevicesScanned);
      handler.off('gestureProcessed', onGestureProcessed);
      handler.off('rawDataReceived', onRawDataReceived);
    };
  }, [fadeAnim, slideAnim, dataStats.connectionUptime, autoInitOutputs]);

  // Scan devices
  const handleScan = async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    log('Starting ESP32 device scan...', 'info');
    
    try {
      await handlerRef.current.scanForDevices();
    } catch (error) {
      log(`Scan failed: ${error}`, 'error');
      setIsScanning(false);
    }
  };

  // Connect device
  const handleConnect = async (deviceId: string) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    log(`Connecting to ${deviceId}...`, 'info');

    try {
      const success = await handlerRef.current.connectToDevice(deviceId);
      if (!success) {
        setIsConnecting(false);
        log('Connection failed', 'error');
      }
    } catch (error) {
      setIsConnecting(false);
      log(`Connection error: ${error}`, 'error');
    }
  };

  // Disconnect device
  const handleDisconnect = async () => {
    try {
      await handlerRef.current.disconnect();
      log('Connection actively disconnected', 'info');
    } catch (error) {
      log(`Disconnect failed: ${error}`, 'error');
    }
  };

  // Test functions
  const handleTest = async () => {
    try {
      await handlerRef.current.sendTestFeedback();
      setDataStats(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
      log('Test feedback sent', 'success');
    } catch (error) {
      log(`Test failed: ${error}`, 'error');
    }
  };

  const handleNavigationTest = async (direction: 'left' | 'right') => {
    try {
      await handlerRef.current.sendNavigationTurnFeedback(direction);
      setDataStats(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
      log(`Navigation ${direction === 'left' ? 'left turn' : 'right turn'} feedback sent`, 'success');
    } catch (error) {
      log(`Navigation test failed: ${error}`, 'error');
    }
  };

  const handleArrivalTest = async () => {
    try {
      await handlerRef.current.sendNavigationArrivalFeedback();
      setDataStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1,
        lastSentTime: Date.now()
      }));
      log('Destination reached feedback sent', 'success');
    } catch (error) {
      log(`Arrival test failed: ${error}`, 'error');
    }
  };

  const handleOutputModeChange = async (mode: string) => {
    try {
      await handlerRef.current.sendOutputMode(mode);
      setDataStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1,
        lastSentTime: Date.now()
      }));
      log(`Output mode set to: ${mode}`, 'success');
    } catch (error) {
      log(`Mode setting failed: ${error}`, 'error');
    }
  };

  const handleManualHandshake = () => {
    handlerRef.current.runInitialHandshake();
    log('Manual handshake/config sent', 'info');
  };

  // Mock incoming call
  const handleSimulateCall = () => {
    if (typeof global !== 'undefined' && (global as any).mockIncomingCall) {
      (global as any).mockIncomingCall('+1234567890');
      log('Mock incoming call triggered', 'info');
    } else {
      log('Mock call function not available', 'warning');
    }
  };  // Comprehensive test suite
  const handleFullTestSuite = async () => {
    try {
      log('Starting full test suite...', 'info');
      
      // Import test suite dynamically
      const { ESP32Tests } = await import('../../tests/ESP32TestSuite');
      
      const results = await ESP32Tests.runFullTestSuite();
      
      // Log results
      log(`Test suite completed: ${results.passed} passed, ${results.failed} failed`, 
          results.failed === 0 ? 'success' : 'error');
      
      // Add detailed logs
      const testLogs = ESP32Tests.getTestLogs();
      testLogs.forEach(testLog => {
        log(testLog.substring(testLog.indexOf(' ') + 1), 'info'); // Remove emoji prefix
      });
      
    } catch (error) {
      log(`Test suite error: ${error}`, 'error');
    }
  };

  // Quick connection test
  const handleQuickConnectionTest = async () => {
    try {
      log('Running quick connection test...', 'info');
      
      const { ESP32Tests } = await import('../../tests/ESP32TestSuite');
      const result = await ESP32Tests.quickConnectionTest();
      
      log(`Connection test: ${result ? 'PASSED' : 'FAILED'}`, result ? 'success' : 'error');
    } catch (error) {
      log(`Connection test error: ${error}`, 'error');
    }
  };

  // Quick gesture test
  const handleQuickGestureTest = async () => {
    try {
      log('Running quick gesture test...', 'info');
      
      const { ESP32Tests } = await import('../../tests/ESP32TestSuite');
      const result = await ESP32Tests.quickGestureTest();
      
      log(`Gesture test: ${result ? 'PASSED' : 'FAILED'}`, result ? 'success' : 'error');
    } catch (error) {
      log(`Gesture test error: ${error}`, 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.primary} />
      <GradientBackground variant="primary" style={styles.container}>
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Devices</Text>
              <Text style={styles.subtitle}>
                {connectedId ? `Connected to ${connectedId.slice(-8)}` : 'No device connected'}
              </Text>
            </View>
            {connectedId && (
              <View style={styles.headerStatus}>
                <BreathingDot color={Colors.success} size={12} isActive={true} />
                <WaveIcon size={24} color={Colors.success} />
              </View>
            )}
          </View>

          {/* Connection status card */}
          {connectedId && (
            <BlurCard style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <PulseAnimation 
                  size={56} 
                  color={Colors.success}
                  isActive={true}
                  style={styles.statusIconContainer}
                >
                  <View style={styles.statusIcon}>
                    <BluetoothIcon size={28} color={Colors.onPrimary} />
                  </View>
                </PulseAnimation>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusTitle}>Connected Device</Text>
                  <Text style={styles.statusDeviceId}>{connectedId}</Text>
                  {dataStats.connectionUptime && (
                    <Text style={styles.statusUptime}>
                      Connected for {Math.floor((Date.now() - dataStats.connectionUptime.getTime()) / 60000)}m
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectButton}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
              {connectionStrength && (
                <View style={styles.strengthMeter}>
                  <Text style={styles.strengthLabel}>Signal Strength</Text>
                  <View style={styles.strengthBar}>
                    <View style={[
                      styles.strengthFill,
                      { width: `${Math.max(0, Math.min(100, connectionStrength))}%` }
                    ]} />
                  </View>
                  <Text style={styles.strengthValue}>{connectionStrength}%</Text>
                </View>
              )}
            </BlurCard>
          )}

          {/* Control buttons */}
          <View style={styles.controlSection}>
            <TouchableOpacity 
              style={[
                styles.scanButton, 
                isScanning && styles.scanButtonActive
              ]} 
              onPress={handleScan}
              disabled={isScanning}
            >
              <View style={styles.scanButtonContent}>
                {isScanning ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <RefreshIcon size={20} color={Colors.onPrimary} />
                )}
                <Text style={styles.scanButtonText}>
                  {isScanning ? 'Scanning...' : 'Scan for Devices'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.actionButton, autoInitOutputs ? styles.actionButtonPrimary : styles.actionButtonSecondary]}
                onPress={() => setAutoInitOutputs(v => !v)}
              >
                <Text style={[styles.actionButtonText, autoInitOutputs ? styles.actionButtonTextPrimary : styles.actionButtonTextSecondary]}>
                  {autoInitOutputs ? 'Auto Init: ON' : 'Auto Init: OFF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleManualHandshake}
              >
                <Text style={styles.actionButtonTextSecondary}>Send Handshake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Device list */}
          <View style={styles.devicesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Available Devices
              </Text>
              <Text style={styles.deviceCount}>{devices.length}</Text>
            </View>
            {devices.length === 0 ? (
              <BlurCard style={styles.emptyState}>
                <View style={styles.emptyStateContent}>
                  <View style={styles.emptyStateIcon}>
                    <SearchIcon size={48} color={Colors.onSurfaceVariant} />
                  </View>
                  <Text style={styles.emptyStateText}>No Devices Found</Text>
                  <Text style={styles.emptyStateSubtext}>Tap scan to discover TeethMark devices</Text>
                </View>
              </BlurCard>
            ) : (
              <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <DeviceCard
                    device={item}
                    isConnected={connectedId === item.id}
                    onConnect={() => handleConnect(item.id)}
                    isConnecting={isConnecting}
                  />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.devicesList}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            )}
          </View>

          {/* Debug information */}
          {connectedId && (
            <CollapsibleDebugPanel title="Debug Information" isExpanded={debugMode}>
              <DebugCodeBlock 
                title="Raw Data" 
                code={rawData || 'No data received'} 
              />
              
              {lastGesture && (
                <DebugCodeBlock
                  title="Latest Gesture"
                  code={`Type: ${lastGesture.type || lastGesture.gesture}\nAction: ${lastGesture.action}\nConfidence: ${lastGesture.confidence?.toFixed(2) || 'N/A'}`}
                />
              )}
              
              <View style={styles.debugStats}>
                <DebugInfoRow
                  label="Connection Uptime"
                  value={dataStats.connectionUptime 
                    ? `${Math.floor((Date.now() - dataStats.connectionUptime.getTime()) / 1000)}s`
                    : 'N/A'}
                />
                <DebugInfoRow
                  label="Messages Received"
                  value={dataStats.messagesReceived.toString()}
                />
                <DebugInfoRow
                  label="Messages Sent"
                  value={dataStats.messagesSent.toString()}
                />
                <DebugInfoRow
                  label="Last Message"
                  value={dataStats.lastMessageTime 
                    ? dataStats.lastMessageTime.toLocaleTimeString() 
                    : 'None'}
                />
              </View>
            </CollapsibleDebugPanel>
          )}

          {/* Test functions */}
          {connectedId && (
            <CollapsibleDebugPanel title="Testing Functions">
              <View style={styles.testGroup}>
                <Text style={styles.testGroupTitle}>Feedback Tests</Text>
                <View style={styles.testButtonGrid}>
                  <ActionButton title="Basic Test" onPress={handleTest} />
                  <ActionButton title="Turn Left" onPress={() => handleNavigationTest('left')} />
                  <ActionButton title="Turn Right" onPress={() => handleNavigationTest('right')} />
                  <ActionButton title="Arrival" onPress={handleArrivalTest} />
                </View>
              </View>

              <View style={styles.testGroup}>
                <Text style={styles.testGroupTitle}>Output Modes</Text>
                <View style={styles.testButtonGrid}>
                  <ActionButton title="Default" onPress={() => handleOutputModeChange('default')} />
                  <ActionButton title="Strong" onPress={() => handleOutputModeChange('strong')} />
                  <ActionButton title="Silent" onPress={() => handleOutputModeChange('silent')} />
                </View>
              </View>

              <View style={styles.testGroup}>
                <Text style={styles.testGroupTitle}>Call Control</Text>
                <View style={styles.testButtonGrid}>
                  <ActionButton title="Mock Call" onPress={handleSimulateCall} />
                </View>
              </View>
            </CollapsibleDebugPanel>
          )}

          {/* Activity Logs */}
          <CollapsibleDebugPanel title={`Activity Log (${logs.length})`}>
            <ScrollView 
              style={styles.logContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {logs.map((log, index) => (
                <Text key={index} style={styles.logEntry}>{log}</Text>
              ))}
              {logs.length === 0 && (
                <Text style={styles.emptyLog}>No log entries</Text>
              )}
            </ScrollView>
          </CollapsibleDebugPanel>
        </Animated.View>
      </GradientBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  
  container: {
    flex: 1,
  },
  
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 24,
  },
  
  headerContent: {
    flex: 1,
  },
  
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.onPrimary,
    marginBottom: 4,
  },
  
  subtitle: {
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },

  // Status card
  statusCard: {
    marginBottom: 24,
    padding: 20,
  },
  
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  statusIconContainer: {
    marginRight: 16,
  },
  
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  statusInfo: {
    flex: 1,
  },
  
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  
  statusDeviceId: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  
  statusUptime: {
    fontSize: 12,
    color: Colors.onSurfaceMuted,
  },
  
  disconnectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },

  strengthMeter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  strengthLabel: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    width: 60,
  },
  
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.systemGray5,
    borderRadius: 2,
    marginHorizontal: 12,
  },
  
  strengthFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  
  strengthValue: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    width: 40,
    textAlign: 'right',
  },

  // Control area
  controlSection: {
    marginBottom: 32,
  },
  
  scanButton: {
    backgroundColor: Colors.info,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: Colors.info,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  
  scanButtonActive: {
    backgroundColor: Colors.surfaceVariant,
  },
  
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onPrimary,
  },

  // Device list
  devicesSection: {
    flex: 1,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  
  deviceCount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  
  devicesList: {
    paddingBottom: 20,
  },
  
  deviceCard: {
    padding: 16,
  },
  
  deviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  deviceIconContainer: {
    marginRight: 16,
  },
  
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  deviceInfo: {
    flex: 1,
  },
  
  deviceName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  
  deviceId: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  signalText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  connectingIndicator: {
    alignItems: 'center',
    gap: 4,
  },
  
  connectingText: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    padding: 40,
  },
  
  emptyStateContent: {
    alignItems: 'center',
  },
  
  emptyStateIcon: {
    marginBottom: 20,
    opacity: 0.6,
  },
  
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },


  // Test area
  testGroup: {
    marginBottom: 16,
  },
  
  testGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  testButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  
  debugStats: {
    marginTop: 8,
  },

  // Button styles
  actionButton: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  
  actionButtonPrimary: {
    backgroundColor: Colors.info,
  },
  
  actionButtonSecondary: {
    backgroundColor: Colors.secondary,
  },
  
  actionButtonDestructive: {
    backgroundColor: Colors.error,
  },
  
  actionButtonDisabled: {
    backgroundColor: Colors.systemGray5,
    borderColor: Colors.borderMuted,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  buttonIcon: {
    marginRight: 6,
    fontSize: 12,
  },
  
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  actionButtonTextPrimary: {
    color: Colors.onPrimary,
  },
  
  actionButtonTextSecondary: {
    color: Colors.onSurface,
  },
  
  actionButtonTextDestructive: {
    color: Colors.onPrimary,
  },
  
  actionButtonTextDisabled: {
    color: Colors.onSurfaceMuted,
  },

  // Log area
  logContainer: {
    maxHeight: 200,
  },
  
  logEntry: {
    fontSize: 11,
    color: '#3C3C43',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
    marginBottom: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
  },
  
  emptyLog: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});