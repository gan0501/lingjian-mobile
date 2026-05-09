import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { GlassSidebar } from './GlassSidebar';
import { useAuthStore, useMembershipStore } from '@/stores';
import { userApi } from '@/services';
import { Loading } from './Loading';
import { Icon } from './Icon';
import { Spacing, FontSize, BorderRadius, Colors } from '@/constants';
import { useTheme } from '@/theme/ThemeContext';

const AVATAR_IMAGES = [
  require('@/assets/images/face/1.png'),
  require('@/assets/images/face/2.png'),
  require('@/assets/images/face/3.png'),
  require('@/assets/images/face/4.png'),
  require('@/assets/images/face/5.png'),
  require('@/assets/images/face/6.png'),
  require('@/assets/images/face/7.png'),
  require('@/assets/images/face/8.png'),
  require('@/assets/images/face/9.png'),
  require('@/assets/images/face/10.png'),
  require('@/assets/images/face/11.png'),
  require('@/assets/images/face/12.png'),
];

interface UserSidebarProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenMembership?: () => void;
  onOpenMemberCenter?: () => void;
}

export const UserSidebar: React.FC<UserSidebarProps> = ({
  visible,
  onClose,
  onLogin,
  onLogout,
  onOpenMembership,
  onOpenMemberCenter,
}) => {
  const { isLoggedIn, user, setUser, token } = useAuthStore();
  const { isMember, membership, fetchMembership } = useMembershipStore();
  const { mode, toggleTheme } = useTheme();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    profession: '',
    location: '',
    company: '',
  });

  useEffect(() => {
    if (visible && isLoggedIn && user) {
      setEditForm({
        name: (user as any)?.nickname || '',
        profession: (user as any)?.profession || '',
        location: (user as any)?.area || '',
        company: (user as any)?.company || '',
      });
      if (token) {
        fetchMembership(token);
      }
    }
  }, [visible, isLoggedIn, user, token, fetchMembership]);

  const getUserInfo = () => {
    if (isLoggedIn && user) {
      return {
        name: (user as any)?.nickname || (user as any)?.name || '用户',
        avatar: (user as any)?.avatar || 'face/1.png',
        profession: (user as any)?.profession || '未设置',
        location: (user as any)?.area || '未设置',
        company: (user as any)?.company || '未设置',
        joinDate: formatJoinDate((user as any)?.created_at),
      };
    }
    return {
      name: '未登录',
      avatar: 'face/1.png',
      profession: '未设置',
      location: '未设置',
      company: '未设置',
      joinDate: '未知',
    };
  };

  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return '未知';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '未知';
    }
  };

  const currentUserInfo = getUserInfo();

  const handleEditSave = async () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: onLogin },
      ]);
      return;
    }

    if (!user) {
      Alert.alert('错误', '用户信息加载中，请稍后重试');
      return;
    }

    const nickname = editForm.name.trim();
    const profession = editForm.profession.trim();
    const company = editForm.company.trim();
    const area = editForm.location.trim();

    const updateData: any = {};
    if (nickname) updateData.nickname = nickname;
    if (profession) updateData.profession = profession;
    if (company) updateData.company = company;
    if (area) updateData.area = area;

    if (Object.keys(updateData).length === 0) {
      Alert.alert('提示', '请先修改资料');
      return;
    }

    try {
      setSavingProfile(true);
      await userApi.updateProfile(updateData);
      setUser({ ...(user as any), ...updateData });
      Alert.alert('提示', '保存成功');
      setEditModalVisible(false);
    } catch (error: any) {
      const errorMsg = error?.message || '保存失败，请稍后重试';
      if (errorMsg.includes('401') || errorMsg.includes('未授权')) {
        Alert.alert('登录已过期', '请重新登录', [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: onLogin },
        ]);
      } else {
        Alert.alert('保存失败', errorMsg);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarSelect = async (avatarIndex: number) => {
    setAvatarModalVisible(false);
    
    if (!isLoggedIn) {
      Alert.alert('提示', '请先登录', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: onLogin },
      ]);
      return;
    }

    if (!user) {
      Alert.alert('错误', '用户信息加载中，请稍后重试');
      return;
    }

    const avatar = `face/${avatarIndex + 1}.png`;
    try {
      await userApi.updateProfile({ avatar });
      setUser({ ...(user as any), avatar });
      Alert.alert('成功', '头像更新成功');
    } catch (error: any) {
      const errorMsg = error?.message || '头像更新失败';
      if (errorMsg.includes('401') || errorMsg.includes('未授权')) {
        Alert.alert('登录已过期', '请重新登录', [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: onLogin },
        ]);
      } else {
        Alert.alert('更新失败', errorMsg);
      }
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '注销账户',
      '确定要注销账户吗？此操作不可恢复，所有数据将被永久删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定注销',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '最后确认',
              '您真的要注销账户吗？这将删除您的所有数据，包括会员权益、项目跟进记录等。',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '确认注销',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeletingAccount(true);
                      await userApi.deleteAccount();
                      Alert.alert('注销成功', '您的账户已成功注销');
                      onLogout();
                      onClose();
                    } catch (error: any) {
                      const errorMsg = error?.message || '注销失败，请稍后重试';
                      Alert.alert('注销失败', errorMsg);
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const renderAvatar = () => {
    const avatar = currentUserInfo.avatar;
    if (avatar && avatar.startsWith('face/')) {
      const index = parseInt(avatar.replace('face/', '').replace('.png', '')) - 1;
      if (index >= 0 && index < AVATAR_IMAGES.length) {
        return (
          <Image
            source={AVATAR_IMAGES[index]}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        );
      }
    }
    if (avatar && avatar.startsWith('http')) {
      return (
        <Image
          source={{ uri: avatar }}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      );
    }
    return <Text style={styles.avatarText}>{currentUserInfo.name.charAt(0)}</Text>;
  };

  return (
    <>
      <GlassSidebar
        visible={visible}
        onClose={onClose}
        title="个人信息"
        width="80%"
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarRow}>
              <TouchableOpacity 
                style={styles.avatarContainer} 
                onPress={() => {
                  if (isLoggedIn) {
                    setAvatarModalVisible(true);
                  } else {
                    Alert.alert('提示', '请先登录', [
                      { text: '取消', style: 'cancel' },
                      { text: '去登录', onPress: onLogin },
                    ]);
                  }
                }}
              >
                {renderAvatar()}
              </TouchableOpacity>
              {/* 主题切换按钮已隐藏 */}
              {/* <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                <Text style={styles.themeToggleIcon}>{mode === 'day' ? '🌙' : '☀️'}</Text>
              </TouchableOpacity> */}
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (isLoggedIn) {
                  setEditModalVisible(true);
                } else {
                  onLogin();
                }
              }}
            >
              <Text style={styles.userName}>{currentUserInfo.name}</Text>
            </TouchableOpacity>
          </View>

          {isLoggedIn ? (
            <View style={styles.infoSection}>
              <TouchableOpacity style={styles.infoItem} onPress={() => setEditModalVisible(true)}>
                <Text style={styles.infoLabel}>职业：</Text>
                <Text style={styles.infoValue}>{currentUserInfo.profession}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoItem} onPress={() => setEditModalVisible(true)}>
                <Text style={styles.infoLabel}>地区：</Text>
                <Text style={styles.infoValue}>{currentUserInfo.location}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoItem} onPress={() => setEditModalVisible(true)}>
                <Text style={styles.infoLabel}>单位：</Text>
                <Text style={styles.infoValue}>{currentUserInfo.company}</Text>
              </TouchableOpacity>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>加入：</Text>
                <Text style={styles.infoValue}>{currentUserInfo.joinDate}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.guestSection}>
              <Text style={styles.guestText}>登录后查看完整个人信息</Text>
            </View>
          )}

          <View style={styles.buttonSection}>
            {isLoggedIn ? (
              <>
                {isMember() ? (
                  <TouchableOpacity
                    style={styles.memberCenterButton}
                    onPress={() => {
                      onClose();
                      if (onOpenMemberCenter) {
                        onOpenMemberCenter();
                      }
                    }}
                  >
                    <Text style={styles.memberCenterButtonText}>会员信息</Text>
                    {typeof membership.balance === 'number' && (
                      <Text style={styles.memberBalanceText}>
                        余额 ¥{membership.balance.toFixed(2)}
                      </Text>
                    )}
                    {membership.expiredAt && (
                      <Text style={styles.memberExpireText}>
                        有效期至 {new Date(membership.expiredAt).toLocaleDateString('zh-CN')}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  onOpenMembership && (
                    <TouchableOpacity
                      style={styles.membershipButton}
                      onPress={() => {
                        onClose();
                        onOpenMembership();
                      }}
                    >
                      <Text style={styles.membershipButtonText}>开通会员</Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity style={styles.logoutButton} onPress={() => { onLogout(); onClose(); }}>
                  <Text style={styles.logoutButtonText}>退出登录</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteAccountButton} 
                  onPress={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? (
                    <Loading size="small" color="#DC2626" />
                  ) : (
                    <Text style={styles.deleteAccountButtonText}>注销账户</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
                <Text style={styles.loginButtonText}>登录</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </GlassSidebar>

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>编辑资料</Text>

            <TextInput
              style={styles.input}
              placeholder="昵称"
              placeholderTextColor="#666"
              value={editForm.name}
              onChangeText={(text) => setEditForm({ ...editForm, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="职业"
              placeholderTextColor="#666"
              value={editForm.profession}
              onChangeText={(text) => setEditForm({ ...editForm, profession: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="地区"
              placeholderTextColor="#666"
              value={editForm.location}
              onChangeText={(text) => setEditForm({ ...editForm, location: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="单位"
              placeholderTextColor="#666"
              value={editForm.company}
              onChangeText={(text) => setEditForm({ ...editForm, company: text })}
            />

            <View style={styles.editModalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleEditSave} disabled={savingProfile}>
                {savingProfile ? <Loading size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>保存</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={avatarModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.avatarModal}>
            <Text style={styles.avatarModalTitle}>选择头像</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_IMAGES.map((img, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.avatarOption}
                  onPress={() => handleAvatarSelect(index)}
                >
                  <Image source={img} style={styles.avatarOptionImage} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeAvatarModal} onPress={() => setAvatarModalVisible(false)}>
              <Text style={styles.closeAvatarModalText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userInfoContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  themeToggle: {
    position: 'absolute',
    right: -50,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleIcon: {
    fontSize: 18,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 32,
    color: '#B20000',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: '#1A1A2E',
  },
  infoSection: {
    paddingHorizontal: Spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: FontSize.base,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: FontSize.base,
    color: '#1A1A2E',
  },
  guestSection: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  guestText: {
    fontSize: FontSize.base,
    color: '#6B7280',
  },
  buttonSection: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  membershipButton: {
    backgroundColor: '#B20000',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
  },
  membershipButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: '#FFF',
  },
  memberCenterButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
  },
  memberCenterButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: '#FFF',
  },
  memberBalanceText: {
    fontSize: FontSize.sm,
    color: '#FFF',
    marginTop: 2,
  },
  memberExpireText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: FontSize.base,
    color: '#1A1A2E',
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  deleteAccountButtonText: {
    fontSize: FontSize.base,
    color: '#DC2626',
  },
  loginButton: {
    backgroundColor: '#B20000',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '85%',
  },
  editModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    fontSize: FontSize.base,
    color: '#1A1A2E',
    height: 44,
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.base,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    color: '#1A1A2E',
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    backgroundColor: '#B20000',
  },
  saveButtonText: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: '#FFF',
  },
  avatarModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '85%',
  },
  avatarModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  avatarOptionImage: {
    width: 60,
    height: 60,
  },
  closeAvatarModal: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  closeAvatarModalText: {
    fontSize: FontSize.base,
    color: '#1A1A2E',
  },
});

export default UserSidebar;
