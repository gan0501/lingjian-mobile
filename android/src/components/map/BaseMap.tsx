import React, { memo, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Animated, LogBox, Image, Text, TouchableOpacity } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { getProjectColor } from '@/constants/colors';
import { MAP_CONFIG, getMapTileStyle } from '@/constants/config';
import { FLAG_IMAGES } from '@/components/map/FlagSettingsSheet';
import { useTheme, getMapStyle } from '@/theme/ThemeContext';

const MARKER_ICONS = {
  green: require('@/assets/images/green.png'),
  yellow: require('@/assets/images/yellow.png'),
  red: require('@/assets/images/red.png'),
  purple: require('@/assets/images/purple.png'),
  skybule: require('@/assets/images/skybule.png'),
};

const getMarkerIconByColor = (color: string): string => {
  const colorLower = color.toLowerCase();
  if (colorLower.includes('4caf') || colorLower.includes('008000') || colorLower.includes('228b')) {
    return 'green';
  }
  if (colorLower.includes('8b0000') || colorLower.includes('ff0000') || colorLower.includes('b222')) {
    return 'red';
  }
  if (colorLower.includes('00008b') || colorLower.includes('2196f3') || colorLower.includes('1e90')) {
    return 'skybule';
  }
  if (colorLower.includes('9c27b0') || colorLower.includes('800080') || colorLower.includes('4b0082')) {
    return 'purple';
  }
  if (colorLower.includes('ff9800') || colorLower.includes('ffa500') || colorLower.includes('ffff00')) {
    return 'yellow';
  }
  if (colorLower.includes('8b4513') || colorLower.includes('a0522d')) {
    return 'yellow';
  }
  return 'green';
};

LogBox.ignoreLogs(['MapLibre error', 'Failed to load tile', 'exhausted all routes', 'stream was reset: CANCEL', 'Request failed due to a permanent error']);

const MAP_STYLE_DAY = getMapTileStyle();

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  type: number;
  data?: any;
  isFollowed?: boolean;
  isVip?: boolean;
  logoUrl?: string;
  opacity?: number;
}

export interface MapBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

interface FlagSettings {
  colorIndex: number;
  text: string;
}

interface BaseMapProps {
  markers: MapMarker[];
  initialCenter?: { latitude: number; longitude: number };
  initialZoom?: number;
  mapType?: 'standard' | 'satellite' | 'night';
  onMarkerPress?: (marker: MapMarker) => void;
  onMapPress?: () => void;
  markerColorGetter?: (type: number) => string;
  iconByType?: Record<number, string>;
  onBoundsChange?: (bounds: MapBounds | null) => void;
  onViewportChange?: (bounds: MapBounds | null, zoom: number | null) => void;
  onMapReady?: () => void;
  flagSettings?: FlagSettings;
  selectedMarkerId?: string | null;
  children?: React.ReactNode;
}

export interface BaseMapRef {
  moveToLocation: (latitude: number, longitude: number, zoom?: number) => void;
  getCurrentViewport: () => { bounds: MapBounds | null; zoom: number } | null;
}

const BaseMapInner = forwardRef<BaseMapRef, BaseMapProps>(({
  markers,
  initialCenter = MAP_CONFIG.DEFAULT_CENTER,
  initialZoom = MAP_CONFIG.DEFAULT_ZOOM,
  onMarkerPress,
  onMapPress,
  markerColorGetter = getProjectColor,
  onBoundsChange,
  onViewportChange,
  onMapReady,
  flagSettings,
  selectedMarkerId,
  children,
}, ref) => {
  const { mode } = useTheme();
  const dynamicMapStyle = useMemo(() => getMapStyle(mode), [mode]);

  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const currentBoundsRef = useRef<MapBounds | null>(null);
  const mapOpacity = useRef(new Animated.Value(0)).current;

  const frozenCenter = useRef<[number, number]>([initialCenter.longitude, initialCenter.latitude]);
  const frozenZoom = useRef<number>(initialZoom);

  const flagColor = flagSettings?.colorIndex ?? 1;
  const flagText = flagSettings?.text ?? '旗';

  useImperativeHandle(ref, () => ({
    moveToLocation: (latitude: number, longitude: number, zoom?: number) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: zoom ?? currentZoom,
        animationDuration: 500,
      });
    },
    getCurrentViewport: () => ({
      bounds: currentBoundsRef.current,
      zoom: currentZoom,
    }),
  }), [currentZoom]);

  const markersGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: markers
      .filter(m => {
        const lat = Number(m.latitude);
        const lng = Number(m.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
      })
      .slice(0, MAP_CONFIG.MAX_VISIBLE_MARKERS)
      .map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(m.longitude), Number(m.latitude)] },
        properties: {
          id: m.id,
          type: m.type,
          isFollowed: m.isFollowed ? 1 : 0,
          color: markerColorGetter(m.type),
          icon: getMarkerIconByColor(markerColorGetter(m.type)),
          flagImage: `flag${flagColor}`,
          flagText: flagText,
          opacity: m.opacity ?? 1,
        },
      })),
  }), [markers, markerColorGetter, flagColor, flagText]);

  const handleMapReady = () => {
    Animated.timing(mapOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      onMapReady?.();
    });

    setTimeout(async () => {
      try {
        const vb = await mapRef.current?.getVisibleBounds?.();
        if (vb && vb.length === 2) {
          const [ne, sw] = vb;
          const bounds: MapBounds = { min_lat: sw[1], max_lat: ne[1], min_lon: sw[0], max_lon: ne[0] };
          currentBoundsRef.current = bounds;
          onBoundsChange?.(bounds);
        }
        const z = await mapRef.current?.getZoom?.();
        if (typeof z === 'number') {
          setCurrentZoom(z);
          onViewportChange?.(currentBoundsRef.current, z);
        }
      } catch {}
    }, 500);
  };

  const handleRegionChange = (feature: any) => {
    try {
      const props = feature?.properties;
      const bounds = props?.visibleBounds;
      if (bounds && bounds.length === 2) {
        const [ne, sw] = bounds;
        const b: MapBounds = { min_lat: sw[1], max_lat: ne[1], min_lon: sw[0], max_lon: ne[0] };
        currentBoundsRef.current = b;
        onBoundsChange?.(b);
      }
      const z = props?.zoomLevel;
      if (typeof z === 'number') {
        setCurrentZoom(z);
      }
      onViewportChange?.(currentBoundsRef.current, typeof z === 'number' ? z : currentZoom);
    } catch {}
  };

  const handleShapePress = (event: any) => {
    try {
      const feature = event?.features?.[0];
      if (!feature) return;
      const id = feature.properties?.id;
      const idStr = String(id);
      const marker = markers.find(m => m.id === idStr);
      if (marker) {
        if (marker.data?.isCluster || marker.data?.__cluster) {
          const nextZoom = Math.min(currentZoom + 2, 18);
          cameraRef.current?.setCamera({
            centerCoordinate: [marker.longitude, marker.latitude],
            zoomLevel: nextZoom,
            animationDuration: 500,
          });
        } else {
          onMarkerPress?.(marker);
        }
      }
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mapWrap, { opacity: mapOpacity }]}>
        <MapLibreGL.MapView
          ref={mapRef}
          style={styles.map}
          mapStyle={dynamicMapStyle as any}
          onDidFinishLoadingMap={handleMapReady}
          onRegionDidChange={handleRegionChange}
          onPress={() => onMapPress?.()}
        >
          <MapLibreGL.Images
            images={{
              flag1: FLAG_IMAGES[1],
              flag2: FLAG_IMAGES[2],
              flag3: FLAG_IMAGES[3],
              flag4: FLAG_IMAGES[4],
              flag5: FLAG_IMAGES[5],
              flag6: FLAG_IMAGES[6],
              flag7: FLAG_IMAGES[7],
              green: MARKER_ICONS.green,
              yellow: MARKER_ICONS.yellow,
              red: MARKER_ICONS.red,
              purple: MARKER_ICONS.purple,
              skybule: MARKER_ICONS.skybule,
            }}
          />

          <MapLibreGL.Camera
            ref={cameraRef}
            centerCoordinate={frozenCenter.current}
            zoomLevel={frozenZoom.current}
            animationMode="moveTo"
            animationDuration={0}
            minZoomLevel={4}
            maxZoomLevel={18}
          />

          {selectedMarkerId && (
            <MapLibreGL.ShapeSource
              id="selected-marker-halo"
              shape={{
                type: 'FeatureCollection' as const,
                features: markers
                  .filter(m => m.id === selectedMarkerId)
                  .map(m => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [Number(m.longitude), Number(m.latitude)] },
                    properties: { id: m.id },
                  })),
              }}
            >
              <MapLibreGL.CircleLayer
                id="selected-halo-outer"
                style={{
                  circleRadius: 20,
                  circleColor: 'rgba(220, 38, 38, 0.3)',
                  circleStrokeWidth: 0,
                  circleOpacity: 0.8,
                }}
              />
              <MapLibreGL.CircleLayer
                id="selected-halo-inner"
                style={{
                  circleRadius: 12,
                  circleColor: 'rgba(220, 38, 38, 0.6)',
                  circleStrokeWidth: 2,
                  circleStrokeColor: 'rgba(255, 255, 255, 0.9)',
                  circleOpacity: 0.9,
                }}
              />
            </MapLibreGL.ShapeSource>
          )}

          <MapLibreGL.ShapeSource
            id="basemap-markers"
            shape={markersGeoJSON as any}
            onPress={handleShapePress}
          >
            <MapLibreGL.SymbolLayer
              id="basemap-markers-layer"
              filter={['==', ['get', 'isFollowed'], 0]}
              style={{
                iconImage: ['get', 'icon'] as any,
                iconSize: 0.4,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconOpacity: ['get', 'opacity'] as any,
              }}
            />
          </MapLibreGL.ShapeSource>

            {markers.filter(m => m.isFollowed).map(m => {
              const isCollaborator = m.data?.project_category === 'collaborated' || m.data?.role === 'collaborator';
              
              return (
              <MapLibreGL.MarkerView
                key={`flag-${m.id}`}
                id={`flag-${m.id}`}
                coordinate={[Number(m.longitude), Number(m.latitude)]}
                anchor={{ x: 0.5, y: 1 }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => { onMarkerPress?.(m); }}
                  style={{ width: 28, height: 34, alignItems: 'center' }}
                >
                  {isCollaborator ? (
                    <Image source={require('@/assets/images/team.png')} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="contain" />
                  ) : (
                    <>
                      <Image source={FLAG_IMAGES[flagColor]} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="contain" />
                      <Text style={{
                        position: 'absolute',
                        top: 8.5,
                        fontSize: 11,
                        color: '#FFFFFF',
                        fontFamily: 'AlimamaDaoLiTi',
                        textShadowColor: 'rgba(0, 0, 0, 0.4)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2
                      }}>
                        {flagText}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </MapLibreGL.MarkerView>
              );
            })}
          </MapLibreGL.MapView>
      </Animated.View>
      {children}
    </View>
  );
});

export const BaseMap = memo(BaseMapInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  mapWrap: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  map: {
    flex: 1,
  },
});

export default BaseMap;
