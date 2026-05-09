import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants';
import { useAuthStore, useMembershipStore, MEMBER_NAMES } from '@/stores';
import { Button } from '@/components/common';
import { useTheme } from '@/theme/ThemeContext';

const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, logout, isLoggedIn } = useAuthStore();
  const { level, expiresAt } = useMembershipStore();
  const { mode, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'membership', title: '会员中心', icon: '👑', route: 'Membership' },
    { id: 'followed', title: '我的收藏', icon: '⭐', route: 'FollowedProjects' },
    { id: 'bids', title: '我的标书', icon: '📝', route: 'MyBids' },
    { id: 'reports', title: '对比报告', icon: '📊', route: 'Reports' },
    { id: 'settings', title: '设置', icon: '⚙️', route: 'Settings' },
    { id: 'help', title: '帮助中心', icon: '❓', route: 'Help' },
    { id: 'feedback', title: '意见反馈', icon: '💬', route: 'Feedback' },
  ];

  const handleLogout = () => {
    logout();
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.loginPrompt, { paddingTop: insets.top + 100 }]}>
          <Text style={styles.loginPromptText}>登录后查看个人信息</Text>
          <Button title="去登录" onPress={() => {}} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.content}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.avatarSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.nickname?.charAt(0) || '用'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.nickname}>{user?.nickname || '用户'}</Text>
                <Text style={styles.phone}>{user?.phone || ''}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
              <Text style={styles.themeToggleIcon}>{mode === 'day' ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>{MEMBER_NAMES[level]}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.logoutSection}>
          <Button
            title="退出登录"
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.base,
  },
  themeToggleIcon: {
    fontSize: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    marginLeft: Spacing.base,
  },
  nickname: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  phone: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  memberBadge: {
    marginTop: Spacing.base,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary[500],
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  memberBadgeText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  menuSection: {
    marginTop: Spacing.base,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: Spacing.base,
  },
  menuTitle: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  menuArrow: {
    fontSize: 16,
    color: Colors.text.tertiary,
  },
  logoutSection: {
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.xl,
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPromptText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginBottom: Spacing.base,
  },
});

export default ProfileScreen;
