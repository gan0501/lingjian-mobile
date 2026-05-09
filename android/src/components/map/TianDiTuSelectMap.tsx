import React, { useRef, useCallback, useState, useEffect, memo } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { MAP_CONFIG, getMapTileStyle } from '@/constants/config';

const { width, height } = Dimensions.get('window');

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Bounds {
  northEast: LatLng;
  southWest: LatLng;
}

interface TianDiTuSelectMapProps {
  style?: ViewStyle;
  initialCenter?: LatLng;
  initialZoom?: number;
  onBoundsChange?: (bounds: Bounds) => void;
  onMapReady?: () => void;
}

const mapStyle = getMapTileStyle();

const TianDiTuSelectMap: React.FC<TianDiTuSelectMapProps> = ({
  style,
  initialCenter = { latitude: 30.2741, longitude: 120.1551 },
  initialZoom = 12,
  onBoundsChange,
  onMapReady,
}) => {
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportBounds = useCallback(async () => {
    if (!mapRef.current || !onBoundsChange) return;
    try {
      const bounds = await (mapRef.current as any).getVisibleBounds();
      if (bounds && bounds.length === 2) {
        onBoundsChange({
          northEast: { latitude: bounds[0][1], longitude: bounds[0][0] },
          southWest: { latitude: bounds[1][1], longitude: bounds[1][0] },
        });
      }
    } catch (e) {
    }
  }, [onBoundsChange]);

  const debouncedReportBounds = useCallback(() => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(reportBounds, 200);
  }, [reportBounds]);

  useEffect(() => {
    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, []);

  const handleDidFinishLoadingMap = useCallback(() => {
    setIsReady(true);
    onMapReady?.();
    setTimeout(reportBounds, 500);
  }, [onMapReady, reportBounds]);

  const handleRegionDidChange = useCallback(() => {
    debouncedReportBounds();
  }, [debouncedReportBounds]);

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle as any}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={handleDidFinishLoadingMap}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
            zoomLevel: initialZoom,
          }}
        />
      </MapLibreGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});

export default memo(TianDiTuSelectMap);
