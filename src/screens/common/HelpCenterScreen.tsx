import React, { FC, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, HelpCircle, User, Map, Building2, Factory, BookOpen, Cpu, MessageCircle } from 'lucide-react-native';
import { Header } from '@/components/common/Header';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'HelpCenter'>;

const HELP_SECTIONS = [
  {
    id: 'account', title: '账号相关', icon: User, color: '#4CAF50',
    items: [
      { q: '如何登录？', a: '在首页右上角点击「👤」图标打开个人信息面板，点击底部的「登录」按钮，输入手机号并获取验证码即可完成登录。首次登录将自动注册账号。' },
      { q: '如何退出登录？', a: '在首页右上角点击「👤」图标打开个人信息面板，滑动到底部找到「退出登录」按钮点击即可退出。退出登录不会删除您的账号数据。' },
      { q: '如何注销账户？', a: '在个人信息面板底部，点击「注销账户」按钮，在弹出的确认框中输入"注销"两个字并确认即可。\n\n⚠️ 注意：账户注销后无法恢复，所有数据将被永久删除。' },
      { q: '如何查看消息？', a: '在首页右上角点击「💬」图标可打开消息侧边栏。系统会推送项目更新、会员状态、充值记录等重要通知。未读消息数量会显示为红色角标。' },
      { q: '如何开通会员？', a: '在个人信息面板中点击「开通会员」按钮，选择合适的套餐（月度/季度/年度），通过支付宝完成支付即可开通 Plus 会员，享受无限跟进项目等专属权益。' },
    ],
  },
  {
    id: 'project', title: '找项目', icon: Map, color: '#2196F3',
    items: [
      { q: '如何搜索项目？', a: '进入「找项目」板块后，在底部搜索栏输入项目名称、地址等关键词，点击发送即可搜索。搜索结果会在地图上以标记点形式展示。' },
      { q: '如何筛选项目类型？', a: '在地图右侧有类型筛选栏，点击对应类型可以过滤显示特定类型的项目。再次点击可取消筛选。' },
      { q: '如何查看项目详情？', a: '在地图上点击项目标记点，底部会弹出项目信息卡片，点击「查看」按钮即可进入项目详情页。' },
      { q: '如何跟进项目？', a: '在项目详情页中点击「跟进」按钮即可跟进该项目。跟进后，系统会实时推送项目的最新动态和状态变化。Plus 会员可享受无限跟进项目数量。' },
    ],
  },
  {
    id: 'enterprise', title: '找建企', icon: Building2, color: '#FF9800',
    items: [
      { q: '如何搜索建筑企业？', a: '进入「找建企」板块，在底部搜索栏输入企业名称或地址进行搜索。' },
      { q: '如何认领企业？', a: '在企业详情页底部点击「认领企业」按钮，填写认领信息并提交审核。审核通过后您将获得该企业的编辑管理权限。' },
      { q: '什么是企业认证？', a: '企业认证是一种年费制的展示会员服务，费用为 ¥999/年。认证后可享受地图LOGO展示、专属详情页等全套展示功能。' },
      { q: '发现信息被冒领怎么办？', a: '在企业详情页底部点击「已被认领」，在弹出提示中点击「申诉」，上传证明材料进行申诉。' },
    ],
  },
  {
    id: 'manufacturer', title: '找厂家', icon: Factory, color: '#9C27B0',
    items: [
      { q: '如何搜索厂家？', a: '进入「找厂家」板块，在底部搜索栏输入厂家名称或产品类型进行搜索。' },
      { q: '如何联系厂家？', a: '在厂家详情页底部有「电话」和「导航」按钮，可以直接拨打电话或导航到厂家地址。' },
    ],
  },
  {
    id: 'resource', title: '找资源', icon: BookOpen, color: '#00BCD4',
    items: [
      { q: '找资源板块有什么？', a: '找资源板块汇集了建筑行业的各类标准规范、图集资源。您可以搜索、浏览并阅读行业标准文档。' },
      { q: '如何搜索规范图集？', a: '在找资源页面底部搜索栏输入规范名称或编号进行搜索。' },
    ],
  },
  {
    id: 'aitools', title: '牛马体（AI工具箱）', icon: Cpu, color: '#E91E63',
    items: [
      { q: '牛马体是什么？', a: '牛马体是领建为建筑行业打造的AI工具箱，包含桩基比选、CAD识图等智能工具。使用AI工具需要开通会员。' },
      { q: '如何使用桩基比选？', a: '进入牛马体板块，选择「桩基比选」工具。按照引导依次完成上传地勘报告→AI识别土层→选择持力层→生成对比报告。' },
      { q: '使用AI工具如何收费？', a: '使用AI工具采用"会员 + 按量付费"模式：需要先开通 Plus 会员，每次调用AI功能会扣除少量余额。' },
    ],
  },
  {
    id: 'contact', title: '联系我们', icon: MessageCircle, color: '#607D8B',
    items: [
      { q: '如何联系客服？', a: '📞 客服电话：0571-85850875\n🌐 官网：LingJianai.cn\n💬 首页底部「用户反馈」提交问题\n\n工作时间：周一至周五 9:00-18:00' },
      { q: '如何提交反馈建议？', a: '在首页底部点击「用户反馈」，可以提交您在使用过程中遇到的问题或改进建议。' },
    ],
  },
];

const HelpCenterScreen: FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [expandedSections, setExpandedSections] = useState<string[]>(['account']);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleItem = (key: string) => {
    setExpandedItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <View style={styles.container}>
      <Header title="帮助中心" showBack onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.heroSection}>
          <HelpCircle color="#80011A" size={36} />
          <Text style={styles.heroTitle}>你好，有什么可以帮您？</Text>
          <Text style={styles.heroSubtitle}>以下是领建各功能板块的使用说明</Text>
        </View>

        {HELP_SECTIONS.map(section => {
          const SectionIcon = section.icon;
          const isExpanded = expandedSections.includes(section.id);
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.id)} activeOpacity={0.7}>
                <View style={[styles.sectionIconWrap, { backgroundColor: section.color + '14' }]}>
                  <SectionIcon color={section.color} size={18} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.items.length}个问题</Text>
                {isExpanded ? <ChevronDown color="#999" size={18} /> : <ChevronRight color="#999" size={18} />}
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.itemsContainer}>
                  {section.items.map((item, idx) => {
                    const itemKey = `${section.id}-${idx}`;
                    const isItemExpanded = expandedItems.includes(itemKey);
                    return (
                      <View key={itemKey}>
                        <TouchableOpacity style={styles.questionRow} onPress={() => toggleItem(itemKey)} activeOpacity={0.7}>
                          <Text style={styles.questionBullet}>Q</Text>
                          <Text style={styles.questionText}>{item.q}</Text>
                          {isItemExpanded ? <ChevronDown color="#bbb" size={16} /> : <ChevronRight color="#bbb" size={16} />}
                        </TouchableOpacity>
                        {isItemExpanded && (
                          <View style={styles.answerContainer}>
                            <Text style={styles.answerText}>{item.a}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>领建 · LingJianai.cn</Text>
          <Text style={styles.footerVersion}>Version 5.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  heroSection: { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 12 },
  heroSubtitle: { fontSize: 13, color: '#888', marginTop: 6 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingRight: 12 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  sectionCount: { fontSize: 11, color: '#bbb', marginRight: 6 },
  itemsContainer: { borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  questionBullet: { fontSize: 11, fontWeight: '800', color: '#80011A', backgroundColor: '#fce4e8', width: 20, height: 20, borderRadius: 4, textAlign: 'center', lineHeight: 20, marginRight: 10, overflow: 'hidden' },
  questionText: { flex: 1, fontSize: 14, color: '#333', fontWeight: '500' },
  answerContainer: { backgroundColor: '#FAFCFF', paddingHorizontal: 16, paddingVertical: 14, paddingLeft: 44, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  answerText: { fontSize: 13, color: '#555', lineHeight: 22 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 12, color: '#bbb' },
  footerVersion: { fontSize: 11, color: '#ddd', marginTop: 4 },
});

export default HelpCenterScreen;
