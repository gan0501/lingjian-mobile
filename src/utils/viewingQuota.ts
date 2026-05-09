import { storage } from './storage';
import { useMembershipStore } from '@/stores/useMembershipStore';

const QUOTA_STORAGE_KEY = 'viewing_quota_v1';
const DAILY_FREE_QUOTA = 3;
const UPLOAD_BONUS = 10;

interface QuotaData {
  lastResetDate: string;
  usedToday: number;
  bonusQuota: number;
}

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getQuotaData(): QuotaData {
  try {
    const raw = storage.getString(QUOTA_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lastResetDate: getTodayDate(), usedToday: 0, bonusQuota: 0 };
}

function saveQuotaData(data: QuotaData): void {
  storage.set(QUOTA_STORAGE_KEY, JSON.stringify(data));
}

function checkAndResetDaily(data: QuotaData): QuotaData {
  const today = getTodayDate();
  if (data.lastResetDate !== today) return { ...data, lastResetDate: today, usedToday: 0 };
  return data;
}

function checkIsMember(): boolean {
  try { return useMembershipStore.getState().isMember(); } catch { return false; }
}

export function getQuotaStatus(): { used: number; total: number; canView: boolean; isMember: boolean } {
  const isMember = checkIsMember();
  if (isMember) return { used: 0, total: Infinity, canView: true, isMember: true };
  let data = getQuotaData();
  data = checkAndResetDaily(data);
  saveQuotaData(data);
  const total = DAILY_FREE_QUOTA + data.bonusQuota;
  return { used: data.usedToday, total, canView: data.usedToday < total, isMember: false };
}

export function consumeQuota(): boolean {
  if (checkIsMember()) return true;
  let data = getQuotaData();
  data = checkAndResetDaily(data);
  const total = DAILY_FREE_QUOTA + data.bonusQuota;
  if (data.usedToday >= total) return false;
  data.usedToday += 1;
  if (data.usedToday > DAILY_FREE_QUOTA && data.bonusQuota > 0) data.bonusQuota -= 1;
  saveQuotaData(data);
  return true;
}

export function addBonusQuota(amount: number = UPLOAD_BONUS): void {
  let data = getQuotaData();
  data = checkAndResetDaily(data);
  data.bonusQuota += amount;
  saveQuotaData(data);
}

export function getDailyFreeQuota(): number { return DAILY_FREE_QUOTA; }
export function getUploadBonus(): number { return UPLOAD_BONUS; }
