import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface FlagSettings {
  colorIndex: number;
  text: string;
}

interface FlagState {
  flagSettings: FlagSettings;
  setFlagColor: (index: number) => void;
  setFlagText: (text: string) => void;
}

export const useFlagStore = create<FlagState>()(
  persist(
    (set) => ({
      flagSettings: {
        colorIndex: 1,
        text: '旗',
      },
      setFlagColor: (index) =>
        set((state) => ({
          flagSettings: { ...state.flagSettings, colorIndex: index },
        })),
      setFlagText: (text) =>
        set((state) => ({
          flagSettings: { ...state.flagSettings, text: text.slice(0, 1) },
        })),
    }),
    {
      name: 'flag-settings',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
