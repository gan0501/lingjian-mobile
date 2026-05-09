import { NativeModules, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

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
  if (Platform.OS === 'android' && AMapLocationModule) {
    return AMapLocationModule.getCurrentLocation();
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || 0,
            accuracy: position.coords.accuracy || 0,
            address: '',
            street: '',
            city: '',
            district: '',
            province: '',
            aoiName: '',
            locationType: 1,
          });
        },
        (error) => {
          reject(new Error(`定位失败: ${error.message}`));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  return Promise.reject(new Error('高德定位仅支持Android/iOS平台'));
};

export default { getAMapCurrentLocation };