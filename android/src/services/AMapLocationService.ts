import { NativeModules, Platform } from 'react-native';

const { AMapLocationModule } = NativeModules;

export interface AMapLocationResult {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  address: string;
  street: string;
  city: string;
  district: string;
  province: string;
  aoiName: string;
  locationType: number;
}

export const getAMapCurrentLocation = (): Promise<AMapLocationResult> => {
  if (Platform.OS !== 'android' || !AMapLocationModule) {
    return Promise.reject(new Error('高德定位仅支持Android平台'));
  }
  return AMapLocationModule.getCurrentLocation();
};

export default { getAMapCurrentLocation };