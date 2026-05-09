import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'value-storage' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

export type FeatureType = 'bid_writer' | 'pile_compare' | 'project_finder' | 'enterprise_insight' | 'personnel' | 'supplier';

export interface FeaturePricing {
  baseValue: number;
  unit: string;
  description: string;
}

export const FEATURE_PRICING: Record<FeatureType, FeaturePricing> = {
  bid_writer: {
    baseValue: 600,
    unit: '份',
    description: '标书（3万字基准）',
  },
  pile_compare: {
    baseValue: 200,
    unit: '次',
    description: '桩基比选',
  },
  project_finder: {
    baseValue: 50,
    unit: '次',
    description: '自动找项目',
  },
  enterprise_insight: {
    baseValue: 100,
    unit: '次',
    description: '企业洞察',
  },
  personnel: {
    baseValue: 80,
    unit: '次',
    description: '人员检索',
  },
  supplier: {
    baseValue: 80,
    unit: '次',
    description: '厂家分析',
  },
};

export interface ValueRecord {
  id: string;
  feature: FeatureType;
  value: number;
  quantity: number;
  description?: string;
  createdAt: number;
}

interface ValueState {
  records: ValueRecord[];
  totalValue: number;
  featureTotals: Record<FeatureType, number>;

  addRecord: (record: Omit<ValueRecord, 'id' | 'createdAt'>) => void;
  calculateValue: (feature: FeatureType, quantity?: number, wordCount?: number) => number;
  getRecordsByFeature: (feature: FeatureType) => ValueRecord[];
  getTotalByFeature: (feature: FeatureType) => number;
  clearRecords: () => void;
}

export const useValueStore = create<ValueState>()(
  persist(
    (set, get) => ({
      records: [],
      totalValue: 0,
      featureTotals: {
        bid_writer: 0,
        pile_compare: 0,
        project_finder: 0,
        enterprise_insight: 0,
        personnel: 0,
        supplier: 0,
      },

      addRecord: (record) => {
        const newRecord: ValueRecord = {
          ...record,
          id: `value_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
        };

        set((state) => ({
          records: [newRecord, ...state.records],
          totalValue: state.totalValue + record.value,
          featureTotals: {
            ...state.featureTotals,
            [record.feature]: state.featureTotals[record.feature] + record.value,
          },
        }));
      },

      calculateValue: (feature, quantity = 1, wordCount) => {
        const pricing = FEATURE_PRICING[feature];
        
        if (feature === 'bid_writer' && wordCount) {
          return pricing.baseValue * (wordCount / 30000);
        }
        
        return pricing.baseValue * quantity;
      },

      getRecordsByFeature: (feature) => {
        return get().records.filter(r => r.feature === feature);
      },

      getTotalByFeature: (feature) => {
        return get().featureTotals[feature];
      },

      clearRecords: () => set({
        records: [],
        totalValue: 0,
        featureTotals: {
          bid_writer: 0,
          pile_compare: 0,
          project_finder: 0,
          enterprise_insight: 0,
          personnel: 0,
          supplier: 0,
        },
      }),
    }),
    {
      name: 'value-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
