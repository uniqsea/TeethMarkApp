import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  ScrollView, 
  StyleSheet,
  Platform 
} from 'react-native';
import { BlurCard } from './GradientBackground';
import { ChevronRightIcon } from '../icons/DeviceIcons';

interface CollapsibleDebugPanelProps {
  title: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export const CollapsibleDebugPanel: React.FC<CollapsibleDebugPanelProps> = ({
  title,
  children,
  isExpanded = false,
  onToggle
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const heightAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);

    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: newExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: newExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <BlurCard style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpanded}>
        <Text style={styles.title}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <ChevronRightIcon size={18} color="#CBD5E0" />
        </Animated.View>
      </TouchableOpacity>
      
      <Animated.View
        style={[
          styles.content,
          {
            maxHeight: heightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 400],
            }),
            opacity: heightAnim,
          },
        ]}
      >
        <ScrollView 
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </Animated.View>
    </BlurCard>
  );
};

interface DebugInfoRowProps {
  label: string;
  value: string;
}

export const DebugInfoRow: React.FC<DebugInfoRowProps> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

interface DebugCodeBlockProps {
  title?: string;
  code: string;
}

export const DebugCodeBlock: React.FC<DebugCodeBlockProps> = ({ title, code }) => (
  <View style={styles.codeBlock}>
    {title && <Text style={styles.codeTitle}>{title}</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Text style={styles.codeText}>{code}</Text>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  
  content: {
    overflow: 'hidden',
  },
  
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    flex: 1,
  },
  
  infoValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 2,
    textAlign: 'right',
  },
  
  codeBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  
  codeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  
  codeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#3C3C43',
    lineHeight: 16,
  },
});