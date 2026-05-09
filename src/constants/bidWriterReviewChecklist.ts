/**
 * 投标文件审查点配置
 * 用于自动审稿功能的提示词
 */

/** 审查项接口 */
export interface ReviewCheckItem {
  id: string;
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  keywords?: string[];  // 用于匹配的关键词
}

/** 投标文件整体审查点 (18项) */
export const OVERALL_REVIEW_CHECKLIST: ReviewCheckItem[] = [
  {
    id: 'overall_1',
    category: '基础信息',
    description: '项目名称与编号是否准确',
    severity: 'critical',
    keywords: ['项目名称', '项目编号', '招标编号'],
  },
  {
    id: 'overall_2',
    category: '基础信息',
    description: '投标人名称是否与证照一致',
    severity: 'critical',
    keywords: ['投标人', '营业执照', '企业名称'],
  },
  {
    id: 'overall_3',
    category: '文件格式',
    description: '文本格式是否符合招标文件要求',
    severity: 'high',
    keywords: ['文本格式', '字体', '字号'],
  },
  {
    id: 'overall_4',
    category: '文件格式',
    description: '字体、行数是否符合招标文件要求',
    severity: 'medium',
    keywords: ['字体', '行数', '行距'],
  },
  {
    id: 'overall_5',
    category: '文件格式',
    description: '图片是否清晰、完整',
    severity: 'high',
    keywords: ['图片', '清晰度', '完整性'],
  },
  {
    id: 'overall_6',
    category: '文件格式',
    description: '目录是否完整、页码是否更新',
    severity: 'high',
    keywords: ['目录', '页码', '完整性'],
  },
  {
    id: 'overall_7',
    category: '内容完整性',
    description: '投标内容是否完整',
    severity: 'critical',
    keywords: ['投标内容', '完整性', '缺失'],
  },
  {
    id: 'overall_8',
    category: '内容完整性',
    description: '页码、页眉、页脚是否正确',
    severity: 'medium',
    keywords: ['页码', '页眉', '页脚'],
  },
  {
    id: 'overall_9',
    category: '报价',
    description: '投标报价是否唯一有效',
    severity: 'critical',
    keywords: ['投标报价', '唯一性', '有效性'],
  },
  {
    id: 'overall_10',
    category: '报价',
    description: '投标报价是否超过最高投标限价',
    severity: 'critical',
    keywords: ['投标报价', '最高限价', '超限'],
  },
  {
    id: 'overall_11',
    category: '报价',
    description: '各版本报价是否一致',
    severity: 'high',
    keywords: ['报价', '一致性', '版本'],
  },
  {
    id: 'overall_12',
    category: '报价',
    description: '分项报价内容、形式是否与总价一致',
    severity: 'high',
    keywords: ['分项报价', '总价', '一致性'],
  },
  {
    id: 'overall_13',
    category: '资质文件',
    description: '营业执照是否有效、符合要求',
    severity: 'critical',
    keywords: ['营业执照', '有效期', '资质'],
  },
  {
    id: 'overall_14',
    category: '资质文件',
    description: '资质证书是否有效、符合要求',
    severity: 'critical',
    keywords: ['资质证书', '有效期', '资质等级'],
  },
  {
    id: 'overall_15',
    category: '资质文件',
    description: '银行资信证明是否有效',
    severity: 'high',
    keywords: ['银行资信证明', '有效期', '资信'],
  },
  {
    id: 'overall_16',
    category: '时间期限',
    description: '交付期(工期)是否符合要求',
    severity: 'critical',
    keywords: ['交付期', '工期', '交付时间'],
  },
  {
    id: 'overall_17',
    category: '时间期限',
    description: '投标有效期是否符合要求',
    severity: 'high',
    keywords: ['投标有效期', '有效期', '期限'],
  },
  {
    id: 'overall_18',
    category: '否决条款',
    description: '其他否决投标因素(违反法律法规或招标文件规定)',
    severity: 'critical',
    keywords: ['否决', '违法', '违规', '不符合要求'],
  },
];

/** 分项审查点 */
export const DETAILED_REVIEW_CHECKLIST = {
  /** 开标文件审查 */
  opening_documents: {
    title: '开标文件',
    items: [
      {
        id: 'opening_1',
        description: '格式响应是否符合要求',
        severity: 'high' as const,
        keywords: ['格式', '响应', '开标文件'],
      },
      {
        id: 'opening_2',
        description: '金额大小写是否一致',
        severity: 'critical' as const,
        keywords: ['金额', '大写', '小写'],
      },
      {
        id: 'opening_3',
        description: '单价与总价是否正确',
        severity: 'critical' as const,
        keywords: ['单价', '总价', '计算'],
      },
    ],
  },

  /** 投标保证金审查 */
  bid_security: {
    title: '投标保证金',
    items: [
      {
        id: 'security_1',
        description: '保证金形式是否符合要求',
        severity: 'high' as const,
        keywords: ['保证金', '形式', '银行保函'],
      },
      {
        id: 'security_2',
        description: '保证金备注是否正确',
        severity: 'medium' as const,
        keywords: ['保证金', '备注', '项目名称'],
      },
      {
        id: 'security_3',
        description: '保证金金额是否符合要求',
        severity: 'critical' as const,
        keywords: ['保证金', '金额', '要求'],
      },
    ],
  },

  /** 商务部分审查 */
  commercial_part: {
    title: '商务部分',
    items: [
      {
        id: 'commercial_1',
        description: '格式是否符合要求',
        severity: 'high' as const,
        keywords: ['格式', '商务部分', '要求'],
      },
      {
        id: 'commercial_2',
        description: '内容是否完整',
        severity: 'critical' as const,
        keywords: ['完整性', '商务部分', '缺失'],
      },
      {
        id: 'commercial_3',
        description: '资质证书是否在有效期内',
        severity: 'critical' as const,
        keywords: ['资质证书', '有效期', '过期'],
      },
      {
        id: 'commercial_4',
        description: '企业资质是否齐全',
        severity: 'critical' as const,
        keywords: ['企业资质', '齐全', '缺失'],
      },
      {
        id: 'commercial_5',
        description: '人员信息是否对应',
        severity: 'high' as const,
        keywords: ['人员', '信息', '对应'],
      },
      {
        id: 'commercial_6',
        description: '商务条款偏离表(正/负/无偏离)',
        severity: 'high' as const,
        keywords: ['商务条款', '偏离表', '正偏离', '负偏离'],
      },
    ],
  },

  /** 技术部分审查 */
  technical_part: {
    title: '技术部分',
    items: [
      {
        id: 'technical_1',
        description: '技术规格与方案是否符合要求',
        severity: 'critical' as const,
        keywords: ['技术规格', '技术方案', '符合要求'],
      },
      {
        id: 'technical_2',
        description: '项目需求分析是否有针对性',
        severity: 'high' as const,
        keywords: ['需求分析', '针对性', '项目需求'],
      },
      {
        id: 'technical_3',
        description: '项目实施计划是否合理、可行',
        severity: 'high' as const,
        keywords: ['实施计划', '合理性', '可行性'],
      },
      {
        id: 'technical_4',
        description: '风险控制措施是否完善',
        severity: 'high' as const,
        keywords: ['风险控制', '措施', '完善'],
      },
      {
        id: 'technical_5',
        description: '质量管理体系是否健全',
        severity: 'high' as const,
        keywords: ['质量管理', '体系', '健全'],
      },
      {
        id: 'technical_6',
        description: '售后服务与培训方案是否完善',
        severity: 'medium' as const,
        keywords: ['售后服务', '培训', '方案'],
      },
      {
        id: 'technical_7',
        description: '技术条款偏离表(正/负/无偏离)',
        severity: 'high' as const,
        keywords: ['技术条款', '偏离表', '正偏离', '负偏离'],
      },
    ],
  },

  /** 电子光盘审查 */
  electronic_media: {
    title: '电子光盘',
    items: [
      {
        id: 'media_1',
        description: '文件格式是否可导入',
        severity: 'high' as const,
        keywords: ['文件格式', '导入', '兼容性'],
      },
      {
        id: 'media_2',
        description: '电脑是否可读',
        severity: 'high' as const,
        keywords: ['可读性', '电脑', '读取'],
      },
      {
        id: 'media_3',
        description: '光盘正面填写信息是否正确',
        severity: 'medium' as const,
        keywords: ['光盘', '信息', '正确性'],
      },
    ],
  },
};

/** 完整审查点配置 */
export const BID_WRITER_REVIEW_CHECKLIST = {
  overall: OVERALL_REVIEW_CHECKLIST,
  detailed: DETAILED_REVIEW_CHECKLIST,
};

/** 获取所有审查点(扁平化) */
export function getAllReviewItems(): ReviewCheckItem[] {
  const items: ReviewCheckItem[] = [...OVERALL_REVIEW_CHECKLIST];

  Object.values(DETAILED_REVIEW_CHECKLIST).forEach((section) => {
    section.items.forEach((item) => {
      items.push({
        id: item.id,
        category: section.title,
        description: item.description,
        severity: item.severity,
        keywords: item.keywords,
      });
    });
  });

  return items;
}

/** 按严重程度分组 */
export function groupBySeverity(items: ReviewCheckItem[]) {
  return {
    critical: items.filter((item) => item.severity === 'critical'),
    high: items.filter((item) => item.severity === 'high'),
    medium: items.filter((item) => item.severity === 'medium'),
    low: items.filter((item) => item.severity === 'low'),
  };
}

/** 按类别分组 */
export function groupByCategory(items: ReviewCheckItem[]) {
  const groups: Record<string, ReviewCheckItem[]> = {};

  items.forEach((item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });

  return groups;
}
