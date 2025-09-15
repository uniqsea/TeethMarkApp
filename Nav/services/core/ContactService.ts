// 联系人管理服务
export interface Contact {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
}

// 预设的英文名字列表
const PRESET_NAMES = [
  'Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry',
  'Iris', 'Jack', 'Kate', 'Liam', 'Maya', 'Noah', 'Olivia', 'Peter',
  'Quinn', 'Rachel', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xavier',
  'Yara', 'Zoe', 'Alex', 'Bella', 'Chris', 'Diana', 'Eric', 'Fiona',
  'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Luna', 'Mark', 'Nina',
  'Oscar', 'Penny', 'Ryan', 'Sara', 'Tom', 'Vera', 'Will', 'Xara'
];

export class ContactService {
  private contacts: Map<string, Contact> = new Map();
  private currentUserName: string = '';

  // 获取或生成当前用户名字
  getCurrentUserName(deviceId: string): string {
    if (!this.currentUserName) {
      this.currentUserName = this.generateNameForDevice(deviceId);
    }
    return this.currentUserName;
  }

  // 基于设备ID生成稳定的名字
  private generateNameForDevice(deviceId: string): string {
    // 基于设备ID的哈希，稳定映射到预设名字表
    const hash = this.simpleHash(deviceId);
    const base = PRESET_NAMES[hash % PRESET_NAMES.length];
    return base;
  }

  // 简单的哈希函数
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  // 基于任意标识（如手机号）生成稳定显示名
  getNameForPhone(phone: string): string {
    const key = (phone || '').replace(/\s+/g, '');
    return this.generateNameForDevice(key || 'unknown');
  }

  // 更新在线设备列表
  updateOnlineDevices(deviceIds: string[], currentDeviceId?: string): Contact[] {
    // 先将所有联系人设为离线
    this.contacts.forEach(contact => {
      contact.isOnline = false;
    });

    // 更新在线状态并添加新设备
    deviceIds.forEach(deviceId => {
      // 排除自己
      if (deviceId === currentDeviceId) return;

      if (!this.contacts.has(deviceId)) {
        // 新设备，创建联系人
        const contact: Contact = {
          id: deviceId,
          name: this.generateNameForDevice(deviceId),
          avatar: 'user.svg', // 统一使用user.svg
          isOnline: true,
          unreadCount: 0
        };
        this.contacts.set(deviceId, contact);
      } else {
        // 已存在的设备，更新在线状态
        const contact = this.contacts.get(deviceId)!;
        contact.isOnline = true;
      }
    });

    // 返回所有联系人（只返回其他人的联系人，在线的排在前面）
    return Array.from(this.contacts.values())
      .filter(contact => contact.id !== currentDeviceId) // 过滤掉自己
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
      });
  }

  // 获取特定联系人
  getContact(deviceId: string): Contact | undefined {
    return this.contacts.get(deviceId);
  }

  // 更新联系人的最后消息
  updateLastMessage(deviceId: string, message: string, timestamp: number) {
    const contact = this.contacts.get(deviceId);
    if (contact) {
      contact.lastMessage = message;
      contact.lastMessageTime = timestamp;
      contact.unreadCount = (contact.unreadCount || 0) + 1;
    }
  }

  // 清除未读消息计数
  clearUnreadCount(deviceId: string) {
    const contact = this.contacts.get(deviceId);
    if (contact) {
      contact.unreadCount = 0;
    }
  }

  // 获取所有联系人
  getAllContacts(): Contact[] {
    return Array.from(this.contacts.values()).sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
  }

  // 重置服务（清除所有数据）
  reset() {
    this.contacts.clear();
  }
}

export default ContactService;
