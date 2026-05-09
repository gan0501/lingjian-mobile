import React, { FC, memo, useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { View, StyleSheet, Platform, Text, Image, Animated, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, getProjectColor } from '@/constants/colors';

const { width, height } = Dimensions.get('window');

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  type: number;
  data?: any;
  isFollowed?: boolean;
  followRole?: 'creator' | 'collaborator';
  flag?: {
    style: string;
    color: string;
    icon: string;
    brightness: string;
  };
}

export interface MapBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

interface TianDiTuMapProps {
  markers: MapMarker[];
  initialCenter?: { latitude: number; longitude: number };
  initialZoom?: number;
  mapType?: 'standard' | 'satellite' | 'night';
  onMarkerPress?: (marker: MapMarker) => void;
  onMapPress?: () => void;
  markerColorGetter?: (type: number) => string;
  onBoundsChange?: (bounds: MapBounds | null) => void;
  onViewportChange?: (bounds: MapBounds | null, zoom: number | null) => void;
  onMapReady?: () => void;
  children?: React.ReactNode;
}

export interface TianDiTuMapRef {
  moveToLocation: (latitude: number, longitude: number, zoom?: number) => void;
  getCurrentViewport: () => { bounds: MapBounds | null; zoom: number } | null;
}

const TIANDITU_KEY = '5f0faa0b93213cc747eebab0891c2cfc';

const TianDiTuMapInner = forwardRef<TianDiTuMapRef, TianDiTuMapProps>(({
  markers,
  initialCenter = { latitude: 39.9042, longitude: 116.4074 },
  initialZoom = 10,
  mapType = 'standard',
  onMarkerPress,
  onMapPress,
  markerColorGetter = getProjectColor,
  onBoundsChange,
  onViewportChange,
  onMapReady,
  children,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const markersRef = useRef(markers);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const updateMarkers = useCallback(() => {
    if (webViewRef.current && isMapReady) {
      const markersData = markersRef.current.map(m => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        title: m.title,
        type: m.type,
        color: markerColorGetter(m.type),
        isFollowed: m.isFollowed,
      }));
      
      const script = `
        if (typeof updateMarkers === 'function') {
          updateMarkers(${JSON.stringify(markersData)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [isMapReady, markerColorGetter]);

  useEffect(() => {
    updateMarkers();
  }, [markers, updateMarkers]);

  useImperativeHandle(ref, () => ({
    moveToLocation: (latitude: number, longitude: number, zoom?: number) => {
      if (webViewRef.current && isMapReady) {
        webViewRef.current.injectJavaScript(`
          moveToLocation(${latitude}, ${longitude}, ${zoom || initialZoom});
          true;
        `);
      }
    },
    getCurrentViewport: () => {
      return { bounds: null, zoom: initialZoom };
    },
  }), [isMapReady, initialZoom]);

  const generateMapHTML = useCallback(() => {
    const markersData = markers.map(m => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.title,
      type: m.type,
      color: markerColorGetter(m.type),
      isFollowed: m.isFollowed,
    }));

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>天地图</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .marker-label {
            background: rgba(255, 255, 255, 0.9);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
    </style>
    <script src="https://api.tianditu.gov.cn/api?v=4.0&tk=${TIANDITU_KEY}"></script>
</head>
<body>
    <div id="map"></div>
    <script>
        let map;
        let markers = [];
        const markersData = ${JSON.stringify(markersData)};
        
        function initMap() {
            map = new T.Map('map', {
                center: new T.LngLat(${initialCenter.longitude}, ${initialCenter.latitude}),
                zoom: ${initialZoom},
                layers: [new T.TileLayer({
                    url: '${mapType === 'satellite' ? 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=' + TIANDITU_KEY : 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=' + TIANDITU_KEY}',
                    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
                })]
            });
            
            if (${mapType !== 'satellite'}) {
                const labelLayer = new T.TileLayer({
                    url: 'https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}',
                    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
                });
                map.addLayer(labelLayer);
            }
            
            addMarkers();
            
            map.addEventListener('click', function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapClick',
                    data: { latitude: e.latlng.lat, longitude: e.latlng.lng }
                }));
            });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapReady',
                data: {}
            }));
        }
        
        function addMarkers() {
            markers.forEach(m => map.removeOverLay(m));
            markers = [];
            
            markersData.forEach(data => {
                const point = new T.LngLat(data.longitude, data.latitude);
                
                const sz = data.isFollowed ? [30, 40] : [40, 52];
                const icon = new T.Icon({
                    iconUrl: 'data:image/svg+xml;base64,' + btoa(createMarkerSVG(data.color, data.isFollowed)),
                    iconSize: new T.Point(sz[0], sz[1]),
                    iconAnchor: new T.Point(sz[0] / 2, sz[1])
                });
                
                const marker = new T.Marker(point, { icon: icon });
                marker.addEventListener('click', function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerClick',
                        data: data
                    }));
                });
                
                map.addOverLay(marker);
                markers.push(marker);
                
                const label = new T.Label({
                    text: data.title,
                    position: point,
                    offset: new T.Point(0, -50)
                });
                label.setStyle({
                    background: 'rgba(0,0,0,0.8)',
                    color: '#ffffff',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                });
                map.addOverLay(label);
                markers.push(label);
            });
        }
        
        function createMarkerSVG(color, isFollowed) {
            const svg = isFollowed 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.7 23.3 0 15 0z" fill="' + color + '"/><circle cx="15" cy="15" r="8" fill="white"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C8.95 0 0 8.95 0 20c0 15 20 32 20 32s20-17 20-32C40 8.95 31.05 0 20 0z" fill="' + color + '"/></svg>';
            return svg;
        }
        
        function moveToLocation(lat, lng, zoom) {
            map.centerAndZoom(new T.LngLat(lng, lat), zoom);
        }
        
        function updateMarkers(newMarkersData) {
            markersData = newMarkersData;
            addMarkers();
        }
        
        if (typeof T !== 'undefined') {
            initMap();
        } else {
            window.onload = initMap;
        }
    </script>
</body>
</html>
    `;
  }, [markers, initialCenter, initialZoom, mapType, markerColorGetter]);

  const handleMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'mapReady':
          setIsMapReady(true);
          Animated.timing(mapOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
          onMapReady?.();
          break;
        case 'markerClick':
          const markerData = message.data;
          const marker = markers.find(m => m.id === markerData.id);
          if (marker) {
            onMarkerPress?.(marker);
          }
          break;
        case 'mapClick':
          onMapPress?.();
          break;
      }
    } catch (error) {
    }
  }, [markers, onMarkerPress, onMapPress, onMapReady, mapOpacity]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mapContainer, { opacity: mapOpacity }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: generateMapHTML() }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          mixedContentMode="always"
          onError={() => {}}
          onHttpError={() => {}}
        />
      </Animated.View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    width: width,
    height: height,
  },
});

export const TianDiTuMap = memo(TianDiTuMapInner);
