import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/utils';
import Feather from '@expo/vector-icons/Feather';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Feather>['name'];
  color: string;
}) {
  return <Feather size={24} style={{ marginBottom: -3 }} {...props} />
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [hideCommunication, setHideCommunication] = useState(false);

  useEffect(() => {
    // 检查是否隐藏通信标签页
    const checkHideCommunication = async () => {
      try {
        const hideValue = await AsyncStorage.getItem('hideCommunicationTab');
        setHideCommunication(hideValue === 'true');
      } catch (error) {
        console.error('Failed to load hide setting:', error);
      }
    };

    checkHideCommunication();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false, // 隐藏标题栏
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Navigation',
          tabBarIcon: ({ color }) => <TabBarIcon name="navigation" color={color} />,
        }}
      />
      {!hideCommunication && (
        <Tabs.Screen
          name="CommunicationScreen"
          options={{
            title: 'Communication',
            tabBarIcon: ({ color }) => <TabBarIcon name="phone" color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="DevicesScreen"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color }) => <TabBarIcon name="bluetooth" color={color} />,
        }}
      />
    </Tabs>
  );
}
