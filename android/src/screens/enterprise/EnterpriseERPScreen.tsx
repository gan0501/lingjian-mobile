import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { FontSize, FontWeight } from '@/constants/typography';

const ERP_3D_URI = Platform.OS === 'android'
  ? 'file:///android_asset/enterpriseERP3D.html'
  : 'about:blank';

const DEPARTMENTS = [
  { id: 'center', name: '企业中枢', icon: 'building', color: '#818cf8', desc: '企业架构 · 部门管理 · 统计数据' },
  { id: 'admin', name: '行政人事', icon: 'users', color: '#22d3ee', desc: '人事管理 · 考勤薪资 · 招聘培训 · 办公管理' },
  { id: 'purchase', name: '采购部门', icon: 'shopping-cart', color: '#34d399', desc: '供应商 · 采购订单 · 成本控制' },
  { id: 'production', name: '生产部门', icon: 'factory', color: '#fbbf24', desc: '生产计划 · 质量控制 · 库存管理' },
  { id: 'sales', name: '销售部门', icon: 'trending-up', color: '#f87171', desc: '客户管理 · 销售业绩 · 市场分析' },
  { id: 'finance', name: '财务部门', icon: 'wallet', color: '#a78bfa', desc: '财务报表 · 预算管理 · 资金流转' },
];

interface Props {
  navigation: any;
}

const EnterpriseERPScreen: React.FC<Props> = ({ navigation }) => {
  const webViewRef = useRef<WebView>(null);
  const [selectedDept, setSelectedDept] = React.useState<string | null>(null);

  const handleMessage = useCallback((event: any) => {
    Alert.alert('收到WebView消息', event.nativeEvent.data);
    console.log('WebView message raw:', event.nativeEvent.data);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message parsed:', data);
      if (data.action === 'dept_click' || data.action === 'building_click') {
        handleDeptNavigation(data.name);
      }
    } catch (e) {
      console.log('WebView message error:', e);
    }
  }, []);

  const handleDeptNavigation = useCallback((deptName: string) => {
    setSelectedDept(deptName);
    setTimeout(() => {
      switch (deptName) {
        case '行政大厅':
        case '行政部门':
          // 行政大厅作为人事部门入口
          navigation.navigate('HRHall');
          break;
        case '生产车间':
        case '生产部门':
          break;
        case '销售据点':
        case '销售部门':
          break;
        case '采购中心':
        case '采购部门':
          break;
        case '财务部门':
          break;
        case '企业中枢':
        case '总部大楼':
          break;
        default:
          break;
      }
      setTimeout(() => setSelectedDept(null), 500);
    }, 300);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f8ff" />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="chevronLeft" size={22} color="#94A3B8" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>企业 ERP</Text>
            <Text style={styles.headerSub}>3D 智能管理系统</Text>
          </View>

          <TouchableOpacity
            style={styles.infoBtn}
            activeOpacity={0.7}
          >
            <Icon name="info" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <WebView
        ref={webViewRef}
        source={{ uri: ERP_3D_URI }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        onMessage={handleMessage}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
        startInLoadingState={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />

      {selectedDept && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>
            已点击：{selectedDept}
          </Text>
        </View>
      )}

      <View style={styles.deptList}>
        <Text style={styles.listTitle}>部门概览</Text>
        <View style={styles.listGrid}>
          {DEPARTMENTS.map((dept) => (
            <TouchableOpacity
              key={dept.id}
              style={[
                styles.deptCard,
                selectedDept === dept.name && styles.deptCardActive,
              ]}
              activeOpacity={0.7}
              onPress={() => handleDeptNavigation(dept.name)}
            >
              <View style={[styles.deptIconWrap, { backgroundColor: dept.color + '20' }]}>
                <Icon name={dept.icon as any} size={18} color={dept.color} />
              </View>
              <Text style={styles.deptName}>{dept.name}</Text>
              <Text style={styles.deptDesc} numberOfLines={1}>{dept.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  safeArea: {
    backgroundColor: '#f0f8ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f8ff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(226,232,240,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: '#64748b',
    marginTop: 2,
  },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(226,232,240,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(129,140,248,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  deptList: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  listTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 12,
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  deptCard: {
    width: '31%',
    backgroundColor: 'rgba(248,250,252,0.8)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
  },
  deptCardActive: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129,140,248,0.1)',
  },
  deptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  deptName: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#334155',
    marginBottom: 2,
  },
  deptDesc: {
    fontSize: 9,
    color: '#64748b',
  },
});

export default EnterpriseERPScreen;
