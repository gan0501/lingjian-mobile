import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JOB_STATUS = [
  { id: 'all', name: '全部', count: 8 },
  { id: 'open', name: '招聘中', count: 5 },
  { id: 'closed', name: '已关闭', count: 3 },
];

const MOCK_POSITIONS = [
  { id: '1', title: '高级前端工程师', department: '技术部', location: '北京', salary: '25-40K', experience: '3-5年', education: '本科', applicants: 12, status: 'open', createTime: '2024-01-15' },
  { id: '2', title: '产品经理', department: '产品部', location: '上海', salary: '20-35K', experience: '3-5年', education: '本科', applicants: 8, status: 'open', createTime: '2024-01-12' },
  { id: '3', title: 'UI设计师', department: '设计部', location: '深圳', salary: '15-25K', experience: '1-3年', education: '本科', applicants: 15, status: 'open', createTime: '2024-01-10' },
  { id: '4', title: '销售经理', department: '销售部', location: '广州', salary: '15-25K', experience: '3-5年', education: '大专', applicants: 6, status: 'open', createTime: '2024-01-08' },
  { id: '5', title: '财务主管', department: '财务部', location: '北京', salary: '18-28K', experience: '5-10年', education: '本科', applicants: 4, status: 'closed', createTime: '2024-01-05' },
];

const MOCK_CANDIDATES = [
  { id: '1', name: '张明', position: '高级前端工程师', status: 'interview', applyTime: '2024-01-18', education: '硕士', experience: '4年' },
  { id: '2', name: '李华', position: '产品经理', status: 'pending', applyTime: '2024-01-17', education: '本科', experience: '3年' },
  { id: '3', name: '王芳', position: 'UI设计师', status: 'passed', applyTime: '2024-01-16', education: '本科', experience: '2年' },
];

interface Props {
  navigation: any;
}

const HRRecruitScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'candidates'>('positions');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filteredPositions = useMemo(() => {
    let result = MOCK_POSITIONS;
    if (selectedStatus !== 'all') {
      result = result.filter(p => p.status === selectedStatus);
    }
    if (searchText) {
      result = result.filter(p => 
        p.title.includes(searchText) || 
        p.department.includes(searchText)
      );
    }
    return result;
  }, [selectedStatus, searchText]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getCandidateStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待筛选', color: '#f59e0b', bgColor: '#fef3c7' };
      case 'interview':
        return { label: '面试中', color: '#3b82f6', bgColor: '#dbeafe' };
      case 'passed':
        return { label: '已通过', color: '#22c55e', bgColor: '#dcfce7' };
      case 'rejected':
        return { label: '已拒绝', color: '#ef4444', bgColor: '#fee2e2' };
      default:
        return { label: '未知', color: '#64748b', bgColor: '#f1f5f9' };
    }
  };

  const renderPositionItem = useCallback(({ item }: { item: typeof MOCK_POSITIONS[0] }) => (
    <TouchableOpacity
      style={styles.positionCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('HRPositionDetail', { positionId: item.id })}
    >
      <View style={styles.positionHeader}>
        <View style={styles.positionTitleRow}>
          <Text style={styles.positionTitle}>{item.title}</Text>
          <View style={[
            styles.positionStatus,
            { backgroundColor: item.status === 'open' ? '#dcfce7' : '#fee2e2' }
          ]}>
            <Text style={[
              styles.positionStatusText,
              { color: item.status === 'open' ? '#16a34a' : '#dc2626' }
            ]}>
              {item.status === 'open' ? '招聘中' : '已关闭'}
            </Text>
          </View>
        </View>
        <Text style={styles.positionSalary}>{item.salary}</Text>
      </View>

      <View style={styles.positionTags}>
        <View style={styles.tag}>
          <Icon name="map-pin" size={12} color="#94a3b8" />
          <Text style={styles.tagText}>{item.location}</Text>
        </View>
        <View style={styles.tag}>
          <Icon name="briefcase" size={12} color="#94a3b8" />
          <Text style={styles.tagText}>{item.experience}</Text>
        </View>
        <View style={styles.tag}>
          <Icon name="book-open" size={12} color="#94a3b8" />
          <Text style={styles.tagText}>{item.education}</Text>
        </View>
      </View>

      <View style={styles.positionFooter}>
        <Text style={styles.positionDept}>{item.department}</Text>
        <View style={styles.applicantsInfo}>
          <Icon name="users" size={14} color="#fbbf24" />
          <Text style={styles.applicantsText}>{item.applicants}人投递</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderCandidateItem = useCallback(({ item }: { item: typeof MOCK_CANDIDATES[0] }) => {
    const statusConfig = getCandidateStatus(item.status);
    
    return (
      <TouchableOpacity
        style={styles.candidateCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HRCandidateDetail', { candidateId: item.id })}
      >
        <View style={styles.candidateAvatar}>
          <Text style={styles.candidateAvatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.candidateInfo}>
          <View style={styles.candidateHeader}>
            <Text style={styles.candidateName}>{item.name}</Text>
            <View style={[styles.candidateStatus, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.candidateStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.candidatePosition}>{item.position}</Text>
          <View style={styles.candidateMeta}>
            <Text style={styles.candidateMetaText}>{item.education} · {item.experience}</Text>
          </View>
        </View>
        <Icon name="chevronRight" size={18} color="#cbd5e1" />
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevronLeft" size={22} color="#64748b" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>招聘市场</Text>

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
            <Icon name="plus" size={20} color="#fbbf24" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'positions' && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('positions')}
          >
            <Text style={[styles.tabText, activeTab === 'positions' && styles.tabTextActive]}>
              职位管理
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'candidates' && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('candidates')}
          >
            <Text style={[styles.tabText, activeTab === 'candidates' && styles.tabTextActive]}>
              候选人
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Icon name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'positions' ? '搜索职位...' : '搜索候选人...'}
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>
      </SafeAreaView>

      {activeTab === 'positions' && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={JOB_STATUS}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedStatus === item.id && styles.filterChipActive
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedStatus(item.id)}
              >
                <Text style={[
                  styles.filterText,
                  selectedStatus === item.id && styles.filterTextActive
                ]}>
                  {item.name}
                </Text>
                <Text style={[
                  styles.filterCount,
                  selectedStatus === item.id && styles.filterCountActive
                ]}>
                  {item.count}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <FlatList
        data={activeTab === 'positions' ? filteredPositions : MOCK_CANDIDATES}
        keyExtractor={item => item.id}
        renderItem={activeTab === 'positions' ? renderPositionItem : renderCandidateItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#fbbf24']}
            tintColor="#fbbf24"
          />
        }
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <Icon name="mic" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffbeb',
  },
  safeArea: {
    backgroundColor: '#fffbeb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  tabActive: {
    backgroundColor: '#fbbf24',
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#1e293b',
    padding: 0,
  },
  filterContainer: {
    paddingBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#fbbf24',
  },
  filterText: {
    fontSize: FontSize.sm,
    color: '#64748b',
    fontWeight: FontWeight.medium,
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    fontWeight: FontWeight.semibold,
  },
  filterCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  positionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  positionHeader: {
    marginBottom: 12,
  },
  positionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  positionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
    flex: 1,
  },
  positionStatus: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  positionStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  positionSalary: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#f59e0b',
  },
  positionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: '#64748b',
  },
  positionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  positionDept: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  applicantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applicantsText: {
    fontSize: FontSize.sm,
    color: '#f59e0b',
    fontWeight: FontWeight.medium,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  candidateAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#f59e0b',
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  candidateName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
  },
  candidateStatus: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  candidateStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  candidatePosition: {
    fontSize: FontSize.sm,
    color: '#64748b',
  },
  candidateMeta: {
    marginTop: 4,
  },
  candidateMetaText: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default HRRecruitScreen;
