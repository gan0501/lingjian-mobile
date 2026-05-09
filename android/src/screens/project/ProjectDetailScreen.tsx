import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, getProjectColor } from '@/constants';
import { Button, Card } from '@/components/common';

interface ProjectDetailScreenProps {
  route: {
    params: {
      projectId: string;
      projectName: string;
      projectType: number;
    };
  };
}

const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const { projectId, projectName, projectType } = route.params;

  const projectInfo = {
    name: projectName || '项目名称',
    type: projectType || 1,
    region: '浙江省杭州市',
    address: '杭州市西湖区文三路xxx号',
    publishDate: '2024-01-15',
    amount: '5000万元',
    constructor: '某某建设有限公司',
    status: '招标中',
  };

  const typeColor = getProjectColor(projectInfo.type);
  const typeNames: Record<number, string> = {
    1: '规划工程',
    2: '土地拍卖',
    3: '招标信息',
    4: '采购公告',
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>项目详情</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Text style={styles.shareButtonText}>分享</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.titleSection}>
          <Text style={styles.projectName}>{projectInfo.name}</Text>
          <View style={styles.tagsRow}>
            <View style={[styles.typeTag, { backgroundColor: typeColor }]}>
              <Text style={styles.typeTagText}>{typeNames[projectInfo.type]}</Text>
            </View>
            <View style={styles.regionTag}>
              <Text style={styles.regionTagText}>{projectInfo.region}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>项目地址</Text>
            <Text style={styles.infoValue}>{projectInfo.address}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>发布日期</Text>
            <Text style={styles.infoValue}>{projectInfo.publishDate}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>项目金额</Text>
            <Text style={styles.infoValue}>{projectInfo.amount}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>建设单位</Text>
            <Text style={styles.infoValue}>{projectInfo.constructor}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>项目状态</Text>
            <Text style={[styles.infoValue, styles.statusValue]}>{projectInfo.status}</Text>
          </View>
        </View>

        <View style={styles.actionSection}>
          <Button title="收藏项目" variant="outline" onPress={() => {}} />
          <Button title="跟进项目" onPress={() => {}} style={{ marginTop: Spacing.sm }} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.text.primary,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  shareButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  shareButtonText: {
    fontSize: FontSize.sm,
    color: Colors.primary[400],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 100,
  },
  titleSection: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  typeTagText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  regionTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.background.secondary,
  },
  regionTagText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  infoSection: {
    paddingVertical: Spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
  },
  infoValue: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  statusValue: {
    color: Colors.accent.success,
  },
  actionSection: {
    marginTop: Spacing.xl,
  },
});

export default ProjectDetailScreen;
