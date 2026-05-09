/**
 * 地图底部详情卡片组件（日间版）
 *
 * 点击标记点后从底部弹出的详情面板。
 * - ProjectCardContent: 项目卡片（分享/协作/跟进/查看）
 * - EntityCardContent: 建企/厂家卡片（Logo+信息+操作）
 *
 * 设计规范：
 * - 所有图标使用 lucide-react-native 线性图标
 * - 主按钮：黑色背景 #111827；次要按钮：灰色背景 #F2F3F7
 */
import React, { FC, memo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Share2, Users, Building2, Ruler, MapPin, Clock,
} from 'lucide-react-native';
import { DayColors } from '@/constants';
import { formatDateShort } from '@/utils/format';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── 按钮色彩规范 ───
const BTN = {
  primary: '#111827',    // 主按钮（黑色）
  secondary: '#F2F3F7',  // 次要按钮（灰色）
  secondaryText: '#333',
};

// ─── 通用卡片容器 ───

interface MapBottomCardProps {
  visible: boolean;
  children: ReactNode;
  onClose?: () => void;
}

export const MapBottomCard: FC<MapBottomCardProps> = memo(({ visible, children, onClose }) => {
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="auto">
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
});

// ─── 项目卡片内容 ───

interface ProjectCardContentProps {
  name: string;
  typeName: string;
  typeColor: string;
  region?: string;
  isFollowed?: boolean;
  constructor?: string;
  scale?: string;
  address?: string;
  publishTime?: string;
  onShare?: () => void;
  onCollaborate?: () => void;
  onFollow?: () => void;
  onView?: () => void;
  collaboratorCount?: number;
  onShowCollaborators?: () => void;
}

export const ProjectCardContent: FC<ProjectCardContentProps> = memo(({
  name, typeName, typeColor, region, isFollowed,
  constructor, scale, address, publishTime,
  onShare, onCollaborate, onFollow, onView,
  collaboratorCount = 0, onShowCollaborators,
}) => (
  <View style={styles.content}>
    {/* 标题 */}
    <Text style={styles.title} numberOfLines={2}>{name}</Text>

    {/* 标签行 */}
    <View style={styles.tagsRow}>
      <View style={[styles.tag, { backgroundColor: `${typeColor}1A` }]}>
        <Text style={[styles.tagText, { color: typeColor }]}>{typeName}</Text>
      </View>
      {region && region !== '-' && (
        <View style={styles.tagBase}>
          <Text style={styles.tagBaseText}>{region}</Text>
        </View>
      )}
      {isFollowed && (
        <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.tagText, { color: '#D97706' }]}>已跟进</Text>
        </View>
      )}
    </View>

    <View style={styles.divider} />

    {/* 信息区 */}
    <View style={styles.infoGrid}>
      <InfoRow label="建设单位" value={constructor || '--'} bold />
      <InfoRow label="项目规模" value={scale || '--'} />
      <InfoRow label="项目地址" value={address || '--'} />
      <InfoRow label="发布时间" value={publishTime ? formatDateShort(publishTime) : '--'} />
    </View>

    <View style={styles.divider} />

    {/* 操作按钮 */}
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.iconBtn} onPress={onShare} activeOpacity={0.7}>
        <Share2 color={DayColors.textSecondary} size={20} />
        <Text style={styles.iconBtnLabel}>分享</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onShowCollaborators} activeOpacity={0.7}>
        <Users color={DayColors.textSecondary} size={20} />
        <Text style={styles.iconBtnLabel}>{collaboratorCount}/5</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: BTN.secondary }]} onPress={onCollaborate} activeOpacity={0.7}>
        <Text style={[styles.actionBtnText, { color: BTN.secondaryText }]}>协作</Text>
      </TouchableOpacity>
      {isFollowed ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: BTN.primary }]}
          onPress={onView}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnTextWhite}>查看</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: BTN.primary }]}
          onPress={onFollow}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnTextWhite}>跟进</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
));

// ─── 建企/厂家卡片内容 ───

interface EntityCardContentProps {
  name: string;
  typeName: string;
  typeColor: string;
  logoChars?: string;
  infoRows: { label: string; value: string; bold?: boolean }[];
  actions: ReactNode;
}

export const EntityCardContent: FC<EntityCardContentProps> = memo(({
  name, typeName, typeColor, logoChars, infoRows, actions,
}) => {
  const chars = logoChars || name.replace(/^[^\u4e00-\u9fa5a-zA-Z]+/, '').slice(0, 4);
  const line1 = chars.slice(0, 2);
  const line2 = chars.slice(2, 4);

  return (
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.logoWrapper}>
          <View style={[styles.logo, { backgroundColor: typeColor }]}>
            <Text style={styles.logoLine}>{line1}</Text>
            {line2 ? <Text style={styles.logoLine}>{line2}</Text> : null}
          </View>
        </View>
        <View style={styles.titleInfo}>
          <Text style={styles.title} numberOfLines={2}>{name}</Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: typeColor }]}>
              <Text style={[styles.tagText, { color: '#fff' }]}>{typeName}</Text>
            </View>
          </View>
        </View>
      </View>

      {infoRows.map((row, i) => (
        <View key={i} style={styles.entityInfoRow}>
          <Text style={styles.entityInfoLabel}>{row.label}</Text>
          <Text style={[styles.entityInfoValue, row.bold && styles.entityInfoValueBold]} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      {actions}
    </View>
  );
});

// ─── 辅助组件 ───

const InfoRow: FC<{ label: string; value: string; bold?: boolean }> = ({
  label, value, bold,
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, bold && styles.infoValueBold]} numberOfLines={2}>{value}</Text>
    </View>
  </View>
);

// ─── 样式 ───

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end', zIndex: 160,
  },
  card: {
    backgroundColor: DayColors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
  },
  handleArea: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingTop: 10, paddingBottom: 5,
  },
  handle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2 },
  scrollView: { paddingHorizontal: 20, paddingTop: 12 },
  scrollContent: { paddingBottom: 8 },
  content: { paddingBottom: 4 },

  // 标题
  title: {
    fontSize: 17, fontWeight: '700', color: DayColors.text,
    lineHeight: 22, marginBottom: 8,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, alignItems: 'center' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
  tagBase: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  tagBaseText: { fontSize: 11, fontWeight: '600', color: DayColors.textSecondary },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },

  // 信息区
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoIconWrapper: { width: 20, alignItems: 'center', marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '500', color: DayColors.textTertiary, marginBottom: 1 },
  infoValue: { fontSize: 13, fontWeight: '500', color: DayColors.textSecondary },
  infoValueBold: { fontWeight: '600', color: DayColors.text },

  // 操作行
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 8, minWidth: 52,
  },
  iconBtnLabel: { fontSize: 11, fontWeight: '500', color: DayColors.textSecondary, marginTop: 3 },
  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  actionBtnTextWhite: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Logo
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  logoWrapper: { marginRight: 12 },
  logo: {
    width: 48, height: 48, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 2,
  },
  logoLine: { fontSize: 12, fontWeight: '700', color: '#fff', lineHeight: 16 },
  titleInfo: { flex: 1 },

  // 建企/厂家信息行
  entityInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4,
  },
  entityInfoLabel: { fontSize: 14, color: DayColors.textTertiary, width: 80 },
  entityInfoValue: { fontSize: 14, fontWeight: '500', color: DayColors.textSecondary, flex: 1, textAlign: 'left' },
  entityInfoValueBold: { fontWeight: '600', color: DayColors.text },
});

export default MapBottomCard;
