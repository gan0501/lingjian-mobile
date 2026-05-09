import React, { FC, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  FileEdit, Calculator, Boxes, Ruler, Camera, Stamp, ChevronRight,
  ChevronLeft, CreditCard, Crown, Box, Hash,
} from 'lucide-react-native';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants';
import type { RootStackScreenProps } from '@/navigation/types';

// ── 工具配置 ──
interface AIToolItem {
  id: string;
  title: string;
  description: string;
  icon: typeof FileEdit;
  color: string;
  isMemberOnly: boolean;
  isAvailable: boolean;
  estimatedCost?: string;
  costColor?: string;
  screen: keyof import('@/navigation/types').RootStackParamList;
}

const AI_TOOLS: AIToolItem[] = [
  {
    id: 'bid_writer',
    title: '指尖标书',
    description: '仅需 3 步，AI 自动生成投标标书',
    icon: FileEdit,
    color: '#B20000',
    isMemberOnly: true,
    isAvailable: true,
    estimatedCost: '预估 0.3~0.8元/份',
    costColor: '#B20000',
    screen: 'BidWriter',
  },
  {
    id: 'pile_comparison',
    title: '桩基比选',
    description: '根据地勘资料 5分钟 生成桩基方案报告',
    icon: Calculator,
    color: '#27AE60',
    isMemberOnly: true,
    isAvailable: true,
    estimatedCost: '预估 0.2~0.5元/份',
    costColor: '#B20000',
    screen: 'PileComparison',
  },
  {
    id: 'building_3d',
    title: '3D建筑场景',
    description: '基于地理数据生成区域 3D 建筑模型',
    icon: Boxes,
    color: '#4A90D9',
    isMemberOnly: false,
    isAvailable: true,
    estimatedCost: '预估 0.1~0.3元/份',
    costColor: '#4A90D9',
    screen: 'Building3D',
  },
  {
    id: 'cad_viewer',
    title: 'CAD看图',
    description: '移动端高效看图 · 测量标注 · 多人协作',
    icon: Ruler,
    color: '#E67E22',
    isMemberOnly: false,
    isAvailable: true,
    estimatedCost: '会员免费',
    costColor: '#27AE60',
    screen: 'CADViewer',
  },
  {
    id: 'id_photo',
    title: '智能证件照',
    description: '一键生成标准证件照 · 多种尺寸规格',
    icon: Camera,
    color: '#9B59B6',
    isMemberOnly: false,
    isAvailable: true,
    estimatedCost: '会员免费',
    costColor: '#27AE60',
    screen: 'IDPhoto',
  },
  // {
  //   id: 'blueprint_to_3d',
  //   title: '图纸转3D',
  //   description: '拍照识图 → AI解析钢筋参数 → 3D可视化模型',
  //   icon: Box,
  //   color: '#E67E22',
  //   isMemberOnly: false,
  //   isAvailable: false,
  //   estimatedCost: '预估 0.1~0.3元/次',
  //   costColor: '#E67E22',
  //   screen: 'BlueprintList',
  // },
  // {
  //   id: 'paizhao_count',
  //   title: '拍照计数',
  //   description: '拍照识别目标数量 · 支持圆形/矩形目标',
  //   icon: Hash,
  //   color: '#10B981',
  //   isMemberOnly: false,
  //   isAvailable: false,
  //   estimatedCost: '预估 0.1~0.2元/次',
  //   costColor: '#10B981',
  //   screen: 'Paizhao',
  // },
  {
    id: 'watermark_camera',
    title: '水印相机',
    description: '拍照自动添加项目水印 · 防伪溯源',
    icon: Stamp,
    color: '#C084FC',
    isMemberOnly: false,
    isAvailable: true,
    estimatedCost: '会员免费',
    costColor: '#27AE60',
    screen: 'WatermarkCameraRN',
  },
];

type Props = RootStackScreenProps<'AITools'>;

const AIToolsScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn, token } = useAuthStore();
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isMember, setIsMember] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    setLoadingBalance(true);
    try {
      const [balRes, memRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/billing/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/membership/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (balRes.ok) {
        const j = await balRes.json();
        if (j.success && j.data) setUserBalance(parseFloat(j.data.balance || 0));
      }
      if (memRes.ok) {
        const j = await memRes.json();
        if (j.success && j.data) setIsMember(!!j.data.isActive);
      }
    } catch (e) {
      console.warn('[AITools] fetchStatus error', e);
    } finally {
      setLoadingBalance(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn) fetchStatus();
  }, [isLoggedIn, fetchStatus]);

  const handleToolPress = (tool: AIToolItem) => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }
    if (!tool.isAvailable) {
      Alert.alert('即将上线', '该功能正在开发中，敬请期待！');
      return;
    }
    if (tool.isMemberOnly && !isMember) {
      Alert.alert(
        '需要会员资格',
        '此功能需要会员身份，是否前往开通会员？',
        [
          { text: '取消', style: 'cancel' },
          { text: '去开通', onPress: () => navigation.navigate('MembershipPay') },
        ]
      );
      return;
    }
    if (tool.screen !== 'AITools') {
      (navigation.navigate as any)(tool.screen);
    }
  };

  return (
    <View style={styles.container}>
      {/* 顶部渐变标题栏 */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>牛马工具箱</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* 余额状态栏 */}
      {isLoggedIn && (
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Crown size={14} color={isMember ? '#F59E0B' : '#999'} />
            <Text style={[styles.statusText, { color: isMember ? '#F59E0B' : '#999' }]}>
              {isMember ? '会员有效' : '非会员'}
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <CreditCard size={14} color="#4A90D9" />
            {loadingBalance
              ? <ActivityIndicator size="small" color="#4A90D9" style={{ marginLeft: 4 }} />
              : <Text style={styles.statusText}>余额 ¥{userBalance.toFixed(2)}</Text>
            }
          </View>
          <TouchableOpacity
            style={styles.memberBtn}
            onPress={() => navigation.navigate('MembershipPay')}
          >
            <Text style={styles.memberBtnText}>{isMember ? '续费' : '开通会员'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {AI_TOOLS.map((tool) => {
          const IconComp = tool.icon;
          const locked = tool.isMemberOnly && !isMember && isLoggedIn;
          return (
            <TouchableOpacity
              key={tool.id}
              style={[styles.toolCard, !tool.isAvailable && styles.toolCardDisabled]}
              onPress={() => handleToolPress(tool)}
              activeOpacity={tool.isAvailable ? 0.75 : 0.6}
            >
              {/* 左色条 */}
              <View style={[styles.colorBar, { backgroundColor: tool.color }]} />

              {/* 图标 */}
              <View style={[styles.iconBox, { backgroundColor: tool.color + '20' }]}>
                <IconComp size={26} color={tool.isAvailable ? tool.color : '#999'} />
              </View>

              {/* 文字 */}
              <View style={styles.toolInfo}>
                <View style={styles.toolTitleRow}>
                  <Text style={[styles.toolTitle, !tool.isAvailable && styles.toolTitleDisabled]}>
                    {tool.title}
                  </Text>
                  {tool.isMemberOnly && (
                    <View style={styles.memberTag}>
                      <Crown size={10} color="#F59E0B" />
                      <Text style={styles.memberTagText}>会员</Text>
                    </View>
                  )}
                  {locked && (
                    <View style={[styles.memberTag, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                      <Text style={[styles.memberTagText, { color: '#F59E0B' }]}>解锁</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toolDesc} numberOfLines={1}>{tool.description}</Text>
                {tool.estimatedCost && (
                  <Text style={[styles.toolCost, { color: tool.costColor }]}>
                    {tool.estimatedCost}
                  </Text>
                )}
              </View>

              {/* 箭头 */}
              <ChevronRight size={18} color={tool.isAvailable ? '#ccc' : '#ddd'} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: 17,
    fontWeight: '700', color: '#fff',
  },
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 12, color: '#555' },
  statusDivider: { width: 1, height: 14, backgroundColor: '#E0E0E0' },
  memberBtn: {
    marginLeft: 'auto',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12,
  },
  memberBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  toolCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  toolCardDisabled: { opacity: 0.55 },
  colorBar: { width: 4, alignSelf: 'stretch' },
  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    margin: 14,
  },
  toolInfo: { flex: 1, paddingVertical: 14, paddingRight: 4 },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  toolTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  toolTitleDisabled: { color: '#999' },
  memberTag: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#FEF3C740',
    borderWidth: 1, borderColor: '#F59E0B40',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
  },
  memberTagText: { fontSize: 10, fontWeight: '600', color: '#F59E0B' },
  toolDesc: { fontSize: 12, color: '#666', marginBottom: 3 },
  toolCost: { fontSize: 11, fontWeight: '500' },
});

export default AIToolsScreen;
