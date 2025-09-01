import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebRTCService, { CallMessage, CallState } from './communication/WebRTCService';
import ContactService, { Contact } from './core/ContactService';
import DeviceIdManager from './core/DeviceIdManager';
import ChatView from '../components/ChatView';
import { useCallOverlay } from '../components/CallOverlayProvider';
import SettingsModal from '../components/SettingsModal';

export default function CommunicationScreen() {
  const overlay = useCallOverlay();
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isInCall: false,
    remoteStream: null,
    localStream: null,
    messages: [],
    incomingCall: false
  });
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentChat, setCurrentChat] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{[key: string]: CallMessage[]}>({});
  
  const webRTCService = useRef<WebRTCService | null>(null);
  const contactService = useRef<ContactService>(new ContactService());

  useEffect(() => {
    // 使用统一的设备 ID 管理器
    const initializeDeviceId = async () => {
      const id = await DeviceIdManager.getInstance().getDeviceId();
      setDeviceId(id);
    };
    initializeDeviceId();
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    // 初始化 WebRTC 服务
    webRTCService.current = new WebRTCService(deviceId);
    
    // 设置回调
    webRTCService.current.onStateChange = (state) => {
      setCallState(prev => ({ ...prev, ...state }));
      
      // 如果收到在线设备列表，更新联系人
      if (state.isConnected && webRTCService.current) {
        // 这里需要从服务器获取在线设备列表
        // 暂时模拟，实际应该在 registered 消息中处理
      }
    };
    
    webRTCService.current.onIncomingCall = (callerId) => {
      const contact = contactService.current.getContact(callerId);
      const callerName = contact?.name || callerId;
      overlay.showIncoming({
        callerId: callerName,
        onAccept: () => {
          webRTCService.current?.acceptCall();
          if (contact) {
            setCurrentChat(contact);
            contactService.current.clearUnreadCount(callerId);
          }
        },
        onReject: () => webRTCService.current?.rejectCall(),
        onRejectWithMessage: () => webRTCService.current?.rejectCallWithBusyMessage(),
      });
    };
    
    webRTCService.current.onMessage = (message) => {
      // 更新聊天消息
      setChatMessages(prev => {
        const senderId = message.sender === deviceId ? 
          (currentChat?.id || '') : message.sender;
        const messages = prev[senderId] || [];
        return {
          ...prev,
          [senderId]: [...messages, message]
        };
      });
      
      // 更新联系人的最后消息
      if (message.sender !== deviceId) {
        contactService.current.updateLastMessage(
          message.sender, 
          message.content, 
          message.timestamp
        );
        setContacts(contactService.current.getAllContacts());
      }
    };
    
    webRTCService.current.onCallEnd = () => {
      Alert.alert('Call Ended', 'The call has been ended.');
    };

    webRTCService.current.onDeviceListUpdate = (deviceIds) => {
      console.log('Device list updated:', deviceIds);
      updateOnlineDevices(deviceIds);
    };

    return () => {
      webRTCService.current?.destroy();
    };
  }, [deviceId]);


  // 更新在线设备列表
  const updateOnlineDevices = (deviceIds: string[]) => {
    const updatedContacts = contactService.current.updateOnlineDevices(deviceIds, deviceId);
    setContacts(updatedContacts);
  };

  // 打开聊天窗口
  const openChat = (contact: Contact) => {
    setCurrentChat(contact);
    contactService.current.clearUnreadCount(contact.id);
    setContacts(contactService.current.getAllContacts());
  };

  // 返回联系人列表
  const backToContactList = () => {
    setCurrentChat(null);
    setMessageText('');
  };

  // 发起语音通话
  const initiateCall = async (targetId: string) => {
    try {
      await webRTCService.current?.initializeCall(targetId);
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate call');
      console.error('Call initiation error:', error);
    }
  };

  // 发送消息
  const sendMessage = () => {
    if (!messageText.trim() || !currentChat) return;
    
    webRTCService.current?.sendMessage({
      type: 'text',
      content: messageText.trim()
    }, currentChat.id);
    
    setMessageText('');
  };

  // 隐藏通信标签页
  const hideCommunicationTab = async () => {
    try {
      await AsyncStorage.setItem('hideCommunicationTab', 'true');
      Alert.alert('Success', 'Communication tab will be hidden. Restart the app to restore it.');
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  // 渲染联系人项
  const renderContact = ({ item }: { item: Contact }) => {
    return (
      <View style={styles.contactCard}>
        <TouchableOpacity style={styles.contactItem} onPress={() => openChat(item)}>
          <View style={styles.contactAvatarContainer}>
            <View style={[
              styles.contactAvatar,
              item.isOnline && styles.contactAvatarOnline
            ]}>
              <MaterialIcons name="person" size={32} color="#fff" />
            </View>
            {item.isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.contactInfo}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactName}>{item.name}</Text>
              {item.lastMessageTime && (
                <Text style={styles.contactTime}>
                  {new Date(item.lastMessageTime).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              )}
            </View>
            <View style={styles.contactBottom}>
              <Text style={styles.contactLastMessage} numberOfLines={1}>
                {item.lastMessage || 'Tap to start chatting...'}
              </Text>
              {(item.unreadCount ?? 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>
    );
  };

  // 如果在聊天窗口，显示聊天界面
  if (!deviceId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="hourglass-empty" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Initializing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (currentChat) {
    return (
      <ChatView
        contact={currentChat}
        messages={chatMessages[currentChat.id] || []}
        messageText={messageText}
        onMessageTextChange={setMessageText}
        onSendMessage={sendMessage}
        onVoiceCall={() => initiateCall(currentChat.id)}
        onBack={backToContactList}
        currentDeviceId={deviceId}
      />
    );
  }

  // 主界面：联系人列表
  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarButton}>
          <View style={styles.userAvatar}>
            <MaterialIcons name="person" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.userName}>
            {contactService.current.getCurrentUserName(deviceId)}
          </Text>
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot,
              callState.isConnected ? styles.statusConnected : styles.statusDisconnected
            ]} />
            <Text style={styles.statusText}>
              {callState.isConnected ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setShowSettings(true)}
        >
          <MaterialIcons name="settings" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* 联系人列表 */}
      <FlatList
        style={styles.contactsList}
        data={contacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contactsContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No contacts online</Text>
            <Text style={styles.emptySubtext}>
              Waiting for other devices to connect...
            </Text>
          </View>
        }
      />

      {/* Incoming P2P WebRTC call (in-app UI, avoids web Alert issues) */}
      {callState.incomingCall && callState.callerId && (
        <View style={styles.incomingCard}>
          <View style={styles.incomingRow}>
            <View style={styles.incomingAvatar}>
              <MaterialIcons name="person" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.incomingTitle}>Incoming Call</Text>
              <Text style={styles.incomingFrom}>{contactService.current.getContact(callState.callerId)?.name || callState.callerId}</Text>
            </View>
            <TouchableOpacity style={styles.incomingReject} onPress={() => webRTCService.current?.rejectCall()}>
              <MaterialIcons name="call-end" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.incomingAccept} onPress={() => webRTCService.current?.acceptCall()}>
              <MaterialIcons name="call" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 设置弹窗 */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onHideCommunication={hideCommunicationTab}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarButton: {
    marginRight: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusConnected: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  statusDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  contactsSection: {
    flex: 1,
    paddingTop: 8,
  },
  contactsList: {
    flex: 1,
    paddingTop: 8,
  },
  contactsContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contactCard: {
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contactAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarOnline: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  contactTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  contactBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactLastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  incomingCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  incomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incomingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomingTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  incomingFrom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  incomingReject: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  incomingAccept: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
