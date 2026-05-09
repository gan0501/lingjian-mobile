import { Platform } from 'react-native';
import { MAP_CONFIG, DEFAULT_PROVINCES, PROVINCE_CODE_BY_NAME } from '@/constants';

export const getProvinceByLocation = async (latitude: number, longitude: number): Promise<string | null> => {
  try {
    const key = __DEV__ ? (Platform.OS === 'ios' ? MAP_CONFIG.AMAP_KEY_IOS : MAP_CONFIG.AMAP_KEY_ANDROID) : '';
    if (!key || key.includes('YOUR_AMAP')) return null;
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(key)}&location=${encodeURIComponent(`${longitude},${latitude}`)}&radius=1000&extensions=base`;
    const resp = await fetch(url);
    const json: any = await resp.json();
    if (!json || json.status !== '1') return null;
    const province = json?.regeocode?.addressComponent?.province;
    if (!province || typeof province !== 'string') return null;
    const normalized = DEFAULT_PROVINCES.find(p => p === province) || DEFAULT_PROVINCES.find(p => province.includes(p) || p.includes(province));
    return normalized || null;
  } catch { return null; }
};

export const getProvinceCode = (provinceName: string): string => PROVINCE_CODE_BY_NAME[provinceName] || '';

export const getRegionInfoByLocation = async (latitude: number, longitude: number): Promise<{ province: string; city: string } | null> => {
  try {
    const amapKey = __DEV__ ? (Platform.OS === 'ios' ? MAP_CONFIG.AMAP_KEY_IOS : MAP_CONFIG.AMAP_KEY_ANDROID) : '';
    if (amapKey && !amapKey.includes('YOUR_AMAP')) {
      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(amapKey)}&location=${encodeURIComponent(`${longitude},${latitude}`)}&radius=1000&extensions=base`;
      const resp = await fetch(url);
      const json: any = await resp.json();
      if (json && json.status === '1' && json.regeocode?.addressComponent) {
        const comp = json.regeocode.addressComponent;
        let province = comp.province || ''; if (Array.isArray(province)) province = '';
        let city = comp.city || ''; if (Array.isArray(city)) city = '';
        if (!city && province) city = province;
        return { province, city };
      }
    }
    const tdtKey = MAP_CONFIG.TIANDITU_BROWSER_KEY || '5f0faa0b93213cc747eebab0891c2cfc';
    const postStr = JSON.stringify({ lon: longitude, lat: latitude, ver: 1 });
    const tdtUrl = `http://api.tianditu.gov.cn/geocoder?postStr=${encodeURIComponent(postStr)}&type=geocode&tk=${tdtKey}`;
    const tdtResp = await fetch(tdtUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 'Referer': 'http://lbs.tianditu.gov.cn/' },
    });
    const tdtJson: any = await tdtResp.json();
    if (tdtJson && tdtJson.status === '0' && tdtJson.result?.addressComponent) {
      const comp = tdtJson.result.addressComponent;
      let province = comp.province || ''; let city = comp.city || '';
      if (!city && province) city = province;
      return { province, city };
    }
    return null;
  } catch { return null; }
};

export const filterByProvince = (items: any[], selectedProvince: string, provinceCode?: string): any[] => {
  if (!selectedProvince) return items;
  const code = provinceCode || getProvinceCode(selectedProvince);
  return items.filter((item: any) => {
    const regionName = String(item?.region_name || '');
    const regionCode = String(item?.region_code || '');
    const pName = String(item?.province || '');
    const pCode = String(item?.province_code || '');
    if (code) { if (regionCode && regionCode.startsWith(code)) return true; if (pCode && pCode.startsWith(code)) return true; }
    if (pName && pName.includes(selectedProvince)) return true;
    if (regionName.includes(selectedProvince)) return true;
    return false;
  });
};
