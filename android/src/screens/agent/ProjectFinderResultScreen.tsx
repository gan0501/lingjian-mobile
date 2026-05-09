/**
 * ProjectFinderResultScreen - 项目助手匹配结果页面
 *
 * 功能：
 * - 显示智能匹配到的项目列表
 * - 每个项目显示匹配分数、名称、匹配原因
 * - 支持添加到跟进项目
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Plus, Check, Star, MapPin, Calendar, Building2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { DayColors } from '@/constants';
import { useOverlay } from '@/components/overlay';
import api from '@/services/api';
import { useFollowedProjectStore, useAuthStore } from '@/stores';

interface ProjectResult {
  id: string;
  task_id: string;
  project_id: string;
  project_name: string;
  project_source: string;
  project_data: any;
  match_score: number;
  match_reason: string;
  analysis: string;
  created_at: string;
}

const ProjectFinderResultScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const overlay = useOverlay();

  const { taskId } = route.params || {};
  const { addProject, followedProjects, loadFollowedProjects } = useFollowedProjectStore();
  const { isLoggedIn } = useAuthStore();

  const [results, setResults] = useState<ProjectResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [followingLoadingId, setFollowingLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadFollowedProjects(true);
  }, []);

  useEffect(() => {
    const ids = new Set<string>();
    followedProjects.forEach((p: any) => {
      ids.add(String(p.external_project_id || p.project_id || p.id));
    });
    setFollowingIds(ids);
  }, [followedProjects]);

  const fetchResults = useCallback(async (isRefresh = false) => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    isRefresh ? setRefreshing(true) : setLoading(true);

    try {
      const res: any = await api.get(`/api/agent-tasks/${taskId}/results`);
      const data = res?.data || [];
      setResults(data);
    } catch (err: any) {
      console.warn('[ProjectFinderResult] fetch error:', err?.message);
      overlay.toast.error('加载失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleFollowProject = useCallback(async (item: ProjectResult) => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const projectId = item.project_id;
    if (followingIds.has(projectId) || followingLoadingId === projectId) return;

    setFollowingLoadingId(projectId);
    try {
      const projectData = item.project_data || {};
      const projectType = projectData.project_type || 1;

      await api.post('/api/user/followed-projects', {
        project_id: projectId,
        project_name: item.project_name,
        project_type: projectType,
        source_table: item.project_source,
        source_data: projectData,
      });

      addProject({
        id: projectId,
        name: item.project_name,
        type: projectType,
        followed_at: new Date().toISOString(),
      });

      setFollowingIds(prev => new Set(prev).add(projectId));
      overlay.toast.success('已添加到跟进项目');
    } catch (err: any) {
      console.warn('[ProjectFinderResult] follow error:', err?.message);
      overlay.toast.error('添加失败，请重试');
    } finally {
      setFollowingLoadingId(null);
    }
  }, [isLoggedIn, followingIds, followingLoadingId, addProject]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#FB923C';
    return '#EF4444';
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    return 'D';
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return '';
    }
  };

  const renderProjectItem = ({ item, index }: { item: ProjectResult; index: number }) => {
    const scoreColor = getScoreColor(item.match_score);
    const scoreGrade = getScoreGrade(item.match_score);
    const isFollowing = followingIds.has(item.project_id);
    const isLoading = followingLoadingId === item.project_id;
    const isExpanded = expandedIds.has(item.id);
    const projectData = item.project_data || {};

    const toggleExpand = () => {
      setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    };

    return (
      <View style={styles.projectCard}>
        <Text style={styles.projectName} numberOfLines={2}>
          {item.project_name || '未命名项目'}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.gradeBadge, { backgroundColor: scoreColor + '20' }]}>
            <Star size={10} color={scoreColor} fill={scoreColor} />
            <Text style={[styles.gradeText, { color: scoreColor }]}>
              {scoreGrade}
            </Text>
          </View>
          {projectData.province || projectData.city ? (
            <View style={styles.metaItem}>
              <MapPin size={12} color={DayColors.textTertiary} />
              <Text style={styles.metaText}>
                {projectData.province || ''}{projectData.city || ''}
              </Text>
            </View>
          ) : null}
          {projectData.publish_date || projectData.created_at ? (
            <View style={styles.metaItem}>
              <Calendar size={12} color={DayColors.textTertiary} />
              <Text style={styles.metaText}>
                {formatDate(projectData.publish_date || projectData.created_at)}
              </Text>
            </View>
          ) : null}
          {projectData.owner_name ? (
            <View style={styles.metaItem}>
              <Building2 size={12} color={DayColors.textTertiary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {projectData.owner_name}
              </Text>
            </View>
          ) : null}
        </View>

        {item.match_reason ? (
          <TouchableOpacity style={styles.matchReasonRow} onPress={toggleExpand} activeOpacity={0.7}>
            <View style={styles.matchReasonContent}>
              <Text style={styles.matchReasonLabel}>匹配理由</Text>
              <Text style={styles.matchReasonText} numberOfLines={isExpanded ? undefined : 2}>
                {item.match_reason}
              </Text>
            </View>
            <View style={styles.expandIcon}>
              {isExpanded ? (
                <ChevronUp size={16} color={DayColors.textTertiary} />
              ) : (
                <ChevronDown size={16} color={DayColors.textTertiary} />
              )}
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Text style={styles.rankText}>第 {index + 1} 个推荐</Text>
            <Text style={[styles.scoreTextFooter, { color: scoreColor }]}>
              匹配度 {item.match_score}%
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing && styles.followBtnDone,
            ]}
            onPress={() => handleFollowProject(item)}
            disabled={isFollowing || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={DayColors.accent} />
            ) : isFollowing ? (
              <>
                <Check size={14} color="#22C55E" />
                <Text style={styles.followBtnTextDone}>已跟进</Text>
              </>
            ) : (
              <>
                <Plus size={14} color={DayColors.accent} />
                <Text style={styles.followBtnText}>跟进</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>暂无匹配结果</Text>
      <Text style={styles.emptySub}>
        该任务尚未完成分析，或没有找到符合条件的项目
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => navigation.navigate('ProjectMap')}
      >
        <Text style={styles.emptyBtnText}>去项目地图查找</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={DayColors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={DayColors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>匹配结果</Text>
          <Text style={styles.headerSub}>
            {results.length > 0 ? `共 ${results.length} 个推荐项目` : '智能匹配中...'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DayColors.accent} />
          <Text style={styles.loadingText}>正在加载匹配结果...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderProjectItem}
          contentContainerStyle={[
            styles.listContent,
            results.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchResults(true)}
              tintColor={DayColors.accent}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DayColors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DayColors.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: DayColors.text,
  },
  headerSub: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginTop: 2,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: DayColors.textTertiary,
    marginTop: 12,
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  projectCard: {
    backgroundColor: DayColors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DayColors.border,
  },

  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: DayColors.text,
    lineHeight: 22,
    marginBottom: 8,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: DayColors.textTertiary,
  },

  matchReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: DayColors.surfaceSecondary,
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  matchReasonContent: {
    flex: 1,
  },
  matchReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DayColors.textSecondary,
    marginBottom: 4,
  },
  matchReasonText: {
    fontSize: 13,
    color: DayColors.text,
    lineHeight: 20,
  },
  expandIcon: {
    paddingLeft: 8,
    paddingTop: 2,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankText: {
    fontSize: 12,
    color: DayColors.textTertiary,
  },
  scoreTextFooter: {
    fontSize: 12,
    fontWeight: '600',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: DayColors.accent + '15',
    gap: 4,
  },
  followBtnDone: {
    backgroundColor: '#22C55E' + '15',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: DayColors.accent,
  },
  followBtnTextDone: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DayColors.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: DayColors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: DayColors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default ProjectFinderResultScreen;
