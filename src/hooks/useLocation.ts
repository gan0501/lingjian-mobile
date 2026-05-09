import { useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { useMapStore } from '@/stores';

const DEFAULT_CENTER = { latitude: 30.2741, longitude: 120.1551 };

interface Location {
  latitude: number;
  longitude: number;
}

interface UseLocationResult {
  location: Location | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<boolean>; // 返回是否有权限
}

export const useLocation = (): UseLocationResult => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setUserLocation, setCenter, setUserCity } = useMapStore();
  const hasLocatedOnce = useRef(false);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    }

    if (Platform.OS === 'android') {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      
      return results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' ||
             results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted';
    }

    return false;
  };

  const requestLocation = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setError('位置权限被拒绝');
        setLocation(DEFAULT_CENTER);
        setUserLocation(DEFAULT_CENTER);
        setLoading(false);
        Alert.alert('定位权限未授权', '已默认显示杭州市，如需使用定位功能请在系统设置中开启位置权限。');
        return false;
      }

      return new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setLocation(loc);
            setUserLocation(loc);
            if (!hasLocatedOnce.current) {
              hasLocatedOnce.current = true;
              setCenter(loc);
            }
            setLoading(false);
            resolve(true);
          },
          (err) => {
            setError(err.message);
            setLocation(DEFAULT_CENTER);
            setUserLocation(DEFAULT_CENTER);
            setLoading(false);
            resolve(false);
          }
        );
      });
    } catch (err: any) {
      setError(err.message || '获取位置失败');
      setLocation(DEFAULT_CENTER);
      setUserLocation(DEFAULT_CENTER);
      setLoading(false);
      return false;
    }
  }, [setUserLocation, setCenter]);

  return { location, loading, error, requestLocation };
};

export default useLocation;
