/**
 * SmartProjectFinderSheet V2 - 智能找项目筛选弹窗
 *
 * 从V1迁移，主要改动：
 * - DayMode 亮色主题适配
 * - 使用 useAgentTaskStore 替代轮询
 * - 使用 useOverlay 替代 Alert
 * - 完整的省市选择器
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  ScrollView,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Sparkles, MapPin, ChevronDown } from 'lucide-react-native';
import { DayColors } from '@/constants';
import { useAgentTaskStore } from '@/stores';
import { useOverlay, InModalToast } from '@/components/overlay';
import api from '@/services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── 省份与城市数据 ──
const PROVINCE_CITY_DATA: Record<string, string[]> = {
  '北京': ['全部', '东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
  '上海': ['全部', '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
  '天津': ['全部', '和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区'],
  '重庆': ['全部', '渝中区', '万州区', '涪陵区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '渝北区', '巴南区', '长寿区', '江津区', '合川区', '永川区'],
  '河北': ['全部', '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
  '山西': ['全部', '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'],
  '辽宁': ['全部', '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
  '吉林': ['全部', '长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'],
  '黑龙江': ['全部', '哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '牡丹江', '黑河', '���化'],
  '江苏': ['全部', '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'],
  '浙江': ['全部', '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'],
  '安徽': ['全部', '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
  '福建': ['全部', '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
  '江西': ['全部', '南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
  '山东': ['全部', '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'],
  '河南': ['全部', '郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
  '湖北': ['全部', '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'],
  '湖南': ['全部', '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
  '广东': ['全部', '广州', '韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'],
  '广西': ['全部', '南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
  '海南': ['全部', '海口', '三亚', '三沙', '儋州', '五指山', '文昌', '琼海', '万宁', '东方'],
  '四川': ['全部', '成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳'],
  '贵州': ['全部', '贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
  '云南': ['全部', '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '大理', '红河', '文山'],
  '西藏': ['全部', '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'],
  '陕西': ['全部', '西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
  '甘肃': ['全部', '兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '��掖', '平凉', '酒泉', '庆阳', '定西', '陇南'],
  '青海': ['全部', '西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西'],
  '宁夏': ['全部', '银川', '石嘴山', '吴忠', '固原', '中卫'],
  '新疆': ['全部', '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰'],
  '内蒙古': ['全部', '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'],
};
const PROVINCES = Object.keys(PROVINCE_CITY_DATA);

// ── 筛选选项 ──
const PROJECT_FIELDS = ['市政道路', '民用住宅', '工业厂房', '水利水电', '公共医疗', '教育学校', '石油化工', '公共场馆', '安置小区', '电力光伏', '自定义'];
const PUBLISH_PERIODS = ['1个月内', '3个月内', '6个月内', '9个月内'];
const PROJECT_TYPES_LIST = ['政府项目', '企业项目', '个人项目'];
const PROJECT_SCALES = ['10000m²以内', '30000m²以内', '50000m²以内', '100000m²以内', '100000m²以上'];
const INVESTMENT_AMOUNTS = ['500万以内', '1000万以内', '5000万以内', '1亿以内', '1亿以上'];
const CUSTOMER_TYPES = ['国家级', '省属级', '地市级', '区县级', '街道级', '企业级'];

export interface SmartFinderFilters {
  province: string;
  city: string;
  fields: string[];
  customField: string;
  publishPeriod: string;
  projectTypes: string[];
  projectScale: string;
  investmentAmount: string;
  customerTypes: string[];
  userAdvantage: string;
}

// ── Tag 选择器 ──
const TagSelector: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
}> = ({ options, selected, onToggle }) => (
  <View style={tagStyles.container}>
    {options.map(item => {
      const active = selected.includes(item);
      return (
        <TouchableOpacity
          key={item}
          style={[tagStyles.tag, active && tagStyles.tagActive]}
          onPress={() => onToggle(item)}
          activeOpacity={0.7}
        >
          <Text style={[tagStyles.tagText, active && tagStyles.tagTextActive]}>{item}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const SingleTagSelector: React.FC<{
  options: string[];
  selected: string;
  onSelect: (item: string) => void;
}> = ({ options, selected, onSelect }) => (
  <View style={tagStyles.container}>
    {options.map(item => {
      const active = selected === item;
      return (
        <TouchableOpacity
          key={item}
          style={[tagStyles.tag, active && tagStyles.tagActive]}
          onPress={() => onSelect(active ? '' : item)}
          activeOpacity={0.7}
        >
          <Text style={[tagStyles.tagText, active && tagStyles.tagTextActive]}>{item}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ═══════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════
interface SmartProjectFinderSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const SmartProjectFinderSheet: React.FC<SmartProjectFinderSheetProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const overlay = useOverlay();

  // 从 Store 获取找项目智能体状态
  const projectFinderAgent = useAgentTaskStore(s => s.getAgent('project_finder'));
  const isRunning = projectFinderAgent?.status === 'working';

  // 筛选状态
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customField, setCustomField] = useState('');
  const [publishPeriod, setPublishPeriod] = useState('');
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [projectScale, setProjectScale] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [userAdvantage, setUserAdvantage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 动画
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && gs.dy > 0,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120) {
          Animated.timing(panY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true })
            .start(() => { onClose(); panY.setValue(SCREEN_HEIGHT); });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 8, overshootClamping: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      panY.setValue(SCREEN_HEIGHT);
      Animated.timing(panY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  const toggleMulti = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }, []);

  // ── 提交（统一通信：useAgentTaskStore） ──
  const handleStart = useCallback(async () => {
    if (selectedFields.length === 0) {
      overlay.toast.error('请至少选择一个项目领域');
      return;
    }
    setSubmitting(true);
    try {
      const filters: SmartFinderFilters = {
        province, city, fields: selectedFields, customField,
        publishPeriod, projectTypes, projectScale,
        investmentAmount, customerTypes, userAdvantage,
      };
      const res: any = await api.post('/api/agent-tasks/start', { agent_type: 'project_finder', filters });
      const data = res?.data || res;
      const taskId = data?.task_id || data?.id;

      if (taskId) {
        // 统一通信：乐观更新 Store → 首页3D机器人立即响应
        useAgentTaskStore.getState().markWorking('project_finder', '自动找项目分析中...', taskId);
        overlay.toast.success('任务已创建，智能体正在后台分析');
        onClose();
      } else {
        overlay.toast.error(data?.message || '创建任务失败');
      }
    } catch (err: any) {
      const status = err?.status || 0;
      const errMsg = err?.data?.message || err?.data?.detail || err?.message || '';
      if (status === 403) {
        overlay.toast.error(errMsg || '权限不足，请开通会员后使用');
      } else {
        overlay.toast.error(errMsg || '网络错误，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  }, [province, city, selectedFields, customField, publishPeriod, projectTypes, projectScale, investmentAmount, customerTypes, userAdvantage, onClose, overlay]);

  const cityList = province ? (PROVINCE_CITY_DATA[province] || []) : [];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <InModalToast />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: panY }] }]}>
          {/* Header */}
          <View style={styles.header} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Sparkles size={20} color={DayColors.accent} strokeWidth={2.5} />
                <Text style={styles.headerTitle}>自动找项目</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={DayColors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              AI智能体将根据筛选条件定时执行、精准分析匹配项目，完成后可在牛马列表中查看结果
            </Text>
          </View>

          {/* 滚动内容 */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* 1. 所在地区 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>📍 所在地区</Text>
              <TouchableOpacity style={styles.regionPicker} onPress={() => setShowCityPicker(true)} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color={province ? DayColors.text : DayColors.textTertiary} />
                  <Text style={[styles.regionText, !province && styles.regionPlaceholder]}>
                    {province ? (city ? `${province} · ${city}` : province) : '选择省份/城市'}
                  </Text>
                </View>
                <ChevronDown size={16} color={DayColors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* 2. 项目领域 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🏗️ 项目领域</Text>
              <TagSelector options={PROJECT_FIELDS} selected={selectedFields} onToggle={item => toggleMulti(selectedFields, item, setSelectedFields)} />
              {selectedFields.includes('自定义') && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={customField}
                  onChangeText={setCustomField}
                  placeholder="请输入自定义领域，如：新能源充电桩"
                  placeholderTextColor={DayColors.textTertiary}
                />
              )}
            </View>

            {/* 3. 发布期限 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>📅 发布期限</Text>
              <SingleTagSelector options={PUBLISH_PERIODS} selected={publishPeriod} onSelect={setPublishPeriod} />
            </View>

            {/* 4. 项目类型 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🏛️ 项目类型</Text>
              <TagSelector options={PROJECT_TYPES_LIST} selected={projectTypes} onToggle={item => toggleMulti(projectTypes, item, setProjectTypes)} />
            </View>

            {/* 5. 项目规模 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>📐 项目规模</Text>
              <SingleTagSelector options={PROJECT_SCALES} selected={projectScale} onSelect={setProjectScale} />
            </View>

            {/* 6. 投资金额 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>💰 投资金额</Text>
              <SingleTagSelector options={INVESTMENT_AMOUNTS} selected={investmentAmount} onSelect={setInvestmentAmount} />
            </View>

            {/* 7. 客户类型 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>👤 客户类型</Text>
              <TagSelector options={CUSTOMER_TYPES} selected={customerTypes} onToggle={item => toggleMulti(customerTypes, item, setCustomerTypes)} />
            </View>

            {/* 8. 用户优势 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>💎 您的优势</Text>
              <Text style={styles.sectionHint}>描述您的产品或核心优势，AI 将据此匹配胜算更大的项目</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={userAdvantage}
                onChangeText={setUserAdvantage}
                placeholder="例如：我们专注生产 PE 给水管和 HDPE 双壁波纹管..."
                placeholderTextColor={DayColors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* 底部操作栏 */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.startButton, (isRunning || submitting) && styles.startButtonDisabled]}
              onPress={handleStart}
              disabled={isRunning || submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>
                {submitting ? '提交中...' : isRunning ? '智能体工作中...' : '自动找项目'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerHint}>预计耗时 30 分钟 ~ 2 小时，运行期间可关闭此页面</Text>
          </View>
        </Animated.View>
      </View>

      {/* 省市选择弹窗 */}
      <Modal visible={showCityPicker} transparent animationType="fade" onRequestClose={() => setShowCityPicker(false)}>
        <View style={pickerStyles.overlay}>
          <TouchableOpacity style={pickerStyles.overlayBg} activeOpacity={1} onPress={() => setShowCityPicker(false)} />
          <View style={pickerStyles.container}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>选择地区</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <X size={18} color={DayColors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={pickerStyles.body}>
              <ScrollView style={pickerStyles.provinceList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[pickerStyles.provinceItem, !province && pickerStyles.provinceItemActive]}
                  onPress={() => { setProvince(''); setCity(''); }}
                >
                  <Text style={[pickerStyles.provinceText, !province && pickerStyles.provinceTextActive]}>全国</Text>
                </TouchableOpacity>
                {PROVINCES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[pickerStyles.provinceItem, province === p && pickerStyles.provinceItemActive]}
                    onPress={() => { setProvince(p); setCity(''); }}
                  >
                    <Text style={[pickerStyles.provinceText, province === p && pickerStyles.provinceTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={pickerStyles.cityList} showsVerticalScrollIndicator={false}>
                {cityList.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[pickerStyles.cityItem, city === c && pickerStyles.cityItemActive]}
                    onPress={() => { setCity(c === '全部' ? '' : c); setShowCityPicker(false); }}
                  >
                    <Text style={[pickerStyles.cityText, city === c && pickerStyles.cityTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
                {!province && <Text style={pickerStyles.cityHint}>← 请先选择省份</Text>}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

// ── Tag 样式 ──
const tagStyles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: DayColors.surfaceSecondary,
    borderWidth: 1, borderColor: DayColors.border,
  },
  tagActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tagText: { fontSize: 13, color: DayColors.textSecondary, fontWeight: '500' },
  tagTextActive: { color: '#fff' },
});

// ── 省市选择器样式 ──
const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  overlayBg: { ...StyleSheet.absoluteFillObject },
  container: { width: '88%', height: '60%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DayColors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: DayColors.text },
  body: { flex: 1, flexDirection: 'row' },
  provinceList: { width: '35%', backgroundColor: DayColors.surfaceSecondary, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: DayColors.border },
  provinceItem: { paddingVertical: 12, paddingHorizontal: 14 },
  provinceItemActive: { backgroundColor: '#fff' },
  provinceText: { fontSize: 14, color: DayColors.textSecondary },
  provinceTextActive: { color: DayColors.text, fontWeight: '600' },
  cityList: { flex: 1 },
  cityItem: { paddingVertical: 12, paddingHorizontal: 16 },
  cityItemActive: { backgroundColor: DayColors.surfaceSecondary },
  cityText: { fontSize: 14, color: DayColors.text },
  cityTextActive: { color: DayColors.text, fontWeight: '600' },
  cityHint: { padding: 20, fontSize: 13, color: DayColors.textTertiary, textAlign: 'center' },
});

// ── 主样式 ──
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: DayColors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.85, maxHeight: SCREEN_HEIGHT * 0.92,
  },
  header: {
    paddingTop: 10, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DayColors.border,
  },
  handle: { width: 36, height: 4, backgroundColor: DayColors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: DayColors.text },
  headerSubtitle: { fontSize: 12, color: DayColors.textTertiary, marginTop: 6, lineHeight: 17 },
  scrollContent: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: DayColors.text, marginBottom: 10 },
  sectionHint: { fontSize: 12, color: DayColors.textTertiary, marginBottom: 8, lineHeight: 17 },
  regionPicker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: DayColors.surfaceSecondary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: DayColors.border,
  },
  regionText: { fontSize: 15, color: DayColors.text, fontWeight: '500' },
  regionPlaceholder: { color: DayColors.textTertiary, fontWeight: '400' },
  input: {
    backgroundColor: DayColors.surfaceSecondary, borderRadius: 12,
    paddingHorizontal: 14, height: 44, fontSize: 14, color: DayColors.text,
    borderWidth: 1, borderColor: DayColors.border,
  },
  textArea: { height: 100, paddingVertical: 12, textAlignVertical: 'top', lineHeight: 20 },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DayColors.border,
    backgroundColor: DayColors.surface,
  },
  startButton: {
    backgroundColor: '#111827', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  footerHint: { fontSize: 11, color: DayColors.textTertiary, textAlign: 'center', marginTop: 8 },
});

export default SmartProjectFinderSheet;
