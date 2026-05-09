import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'token-storage' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

export type ModelType = 'qwen' | 'doubao' | 'kimi' | 'deepseek' | 'zhupu' | 'minimax';

export interface ModelPricing {
  input: number;
  output: number;
  unit: 'per_1k' | 'per_1m';
}

export const MODEL_PRICING: Record<ModelType, ModelPricing> = {
  qwen: { input: 0.002, output: 0.006, unit: 'per_1k' },
  doubao: { input: 0.0008, output: 0.002, unit: 'per_1k' },
  kimi: { input: 0.012, output: 0.012, unit: 'per_1k' },
  deepseek: { input: 0.001, output: 0.002, unit: 'per_1k' },
  zhupu: { input: 0.005, output: 0.005, unit: 'per_1k' },
  minimax: { input: 0.015, output: 0.015, unit: 'per_1k' },
};

export const FEES = {
  infrastructure: 0.20,
  tax: 0.06,
  service: 0.05,
  total: 1.31,
};

export interface TokenRecord {
  id: string;
  model: ModelType;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  feature: string;
  createdAt: number;
}

interface TokenState {
  records: TokenRecord[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;

  addRecord: (record: Omit<TokenRecord, 'id' | 'createdAt'>) => void;
  calculateCost: (model: ModelType, inputTokens: number, outputTokens: number) => number;
  getRecordsByFeature: (feature: string) => TokenRecord[];
  getRecordsByDate: (date: string) => TokenRecord[];
  clearRecords: () => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      records: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,

      addRecord: (record) => {
        const newRecord: TokenRecord = {
          ...record,
          id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
        };

        set((state) => ({
          records: [newRecord, ...state.records],
          totalInputTokens: state.totalInputTokens + record.inputTokens,
          totalOutputTokens: state.totalOutputTokens + record.outputTokens,
          totalCost: state.totalCost + record.cost,
        }));
      },

      calculateCost: (model, inputTokens, outputTokens) => {
        const pricing = MODEL_PRICING[model];
        const multiplier = pricing.unit === 'per_1m' ? 1000000 : 1000;
        
        const inputCost = (inputTokens / multiplier) * pricing.input;
        const outputCost = (outputTokens / multiplier) * pricing.output;
        const baseCost = inputCost + outputCost;
        
        return baseCost * FEES.total;
      },

      getRecordsByFeature: (feature) => {
        return get().records.filter(r => r.feature === feature);
      },

      getRecordsByDate: (date) => {
        const targetDate = new Date(date).toDateString();
        return get().records.filter(r => 
          new Date(r.createdAt).toDateString() === targetDate
        );
      },

      clearRecords: () => set({
        records: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
      }),
    }),
    {
      name: 'token-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
