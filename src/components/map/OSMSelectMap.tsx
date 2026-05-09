/**
 * OSM 本地瓦片选取地图组件
 * 使用本地 tileserver-gl-light 服务 (矢量瓦片 PBF)
 * 通过 MapLibre GL JS 渲染矢量瓦片
 *
 * 关键设计：
 * 1. OSM 瓦片数据在 AI 主机上，通过 FRP 内网穿透暴露到公网
 * 2. 开发模式: 通过 localhost:8000 (ADB反向代理) -> 本地后端 -> AI主机 tileserver
 * 3. 生产模式: 通过 https://api.lingjianai.cn (云服务器代理到 AI主机)
 * 4. 【关键修复】style.json 先由 RN 端获取，再直接内嵌到 HTML 字符串中
 *    - 旧方案: 先加载 WebView，异步获取 style.json 后用 injectJavaScript 注入
 *      → 存在时序竞争：style.json 获取完时 WebView 可能还没执行到 _pendingMapInit 赋值
 *    - 新方案: 先获取 style.json，再生成包含完整数据的 HTML，WebView 加载时立即可用
 * 5. MapLibre GL JS 从本地 asset 加载（file:///android_asset/ 不受同源策略限制）
 * 6. 支持地图截图功能，通过 map.getCanvas().toDataURL() 获取当前地图画面
 */
import React, { useRef, useCallback, useState, useMemo, memo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { API_CONFIG } from '@/constants';
const OSM_API_BASE = API_CONFIG.BASE_URL;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Bounds {
  northEast: LatLng;
  southWest: LatLng;
}

export interface OSMSelectMapRef {
  captureMap: (bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => Promise<string | null>;
}

interface OSMSelectMapProps {
  style?: ViewStyle;
  initialCenter?: LatLng;
  initialZoom?: number;
  onBoundsChange?: (bounds: Bounds) => void;
  onMapReady?: () => void;
  onLoadError?: () => void;
}

const OSMSelectMap = forwardRef<OSMSelectMapRef, OSMSelectMapProps>(({
  style,
  initialCenter = { latitude: 39.9042, longitude: 116.4074 },
  initialZoom = 10,
  onBoundsChange,
  onMapReady,
  onLoadError,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const errorCountRef = useRef(0);
  const hasReportedErrorRef = useRef(false);
  const [styleJson, setStyleJson] = useState<string | null>(null);
  const captureResolveRef = useRef<((value: string | null) => void) | null>(null);

  const initLat = initialCenter.latitude;
  const initLon = initialCenter.longitude;

  console.log('[OSMSelectMap] initialCenter:', initialCenter, 'OSM_API_BASE:', OSM_API_BASE);

  useImperativeHandle(ref, () => ({
    captureMap: (bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => {
      return new Promise<string | null>((resolve) => {
        console.log('[OSMSelectMap] captureMap called, isReady:', isReady);
        if (!isReady || !webViewRef.current) {
          console.warn('[OSMSelectMap] captureMap: not ready');
          resolve(null);
          return;
        }
        captureResolveRef.current = resolve;
        const bboxJson = bbox ? JSON.stringify(bbox) : 'null';
        console.log('[OSMSelectMap] calling _captureMap with bbox:', bboxJson);
        webViewRef.current.injectJavaScript(`window._captureMap(${bboxJson}); true;`);
        setTimeout(() => {
          if (captureResolveRef.current) {
            console.warn('[OSMSelectMap] capture timeout');
            captureResolveRef.current(null);
            captureResolveRef.current = null;
          }
        }, 5000);
      });
    },
  }), [isReady]);

  useEffect(() => {
    const fetchStyle = async () => {
      try {
        const url = `${OSM_API_BASE}/api/map/osm/style.json`;
        console.log('[OSMSelectMap] Fetching style.json from:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setStyleJson(JSON.stringify(data));
          console.log('[OSMSelectMap] style.json fetched, sources:', Object.keys(data.sources || {}));
        } else {
          console.error('[OSMSelectMap] style.json fetch failed:', response.status, response.statusText);
          setStyleJson('ERROR');
          onLoadError?.();
        }
      } catch (e: any) {
        console.error('[OSMSelectMap] style.json fetch error:', e.message);
        setStyleJson('ERROR');
        onLoadError?.();
      }
    };
    fetchStyle();
  }, [onLoadError]);

  const htmlContent = useMemo(() => {
    if (!styleJson || styleJson === 'ERROR') return '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="maplibre-gl.js"><\/script>
  <link href="maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f0f0f0; }
    #map { width: 100%; height: 100%; }
    #loadingHint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #888; font: 14px sans-serif; z-index: 0; }
  <\/style>
</head>
<body>
  <div id="map"></div>
  <div id="loadingHint">地图加载中...</div>
  <script>
    (function() {
      var map;

      function postMsg(obj) {
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          }
        } catch(e) {}
      }

      function initMapWithStyle(styleData) {
        try {
          if (typeof maplibregl === 'undefined') {
            postMsg({ type: 'error', message: 'MapLibre GL JS not loaded!' });
            var hint = document.getElementById('loadingHint');
            if (hint) hint.textContent = 'MapLibre GL JS 加载失败';
            return;
          }
          postMsg({ type: 'log', message: 'MapLibre GL JS loaded, version: ' + (maplibregl.version || 'unknown') });
          postMsg({ type: 'log', message: 'Initializing map with inline style, sources: ' + Object.keys(styleData.sources || {}).join(', ') });

          map = new maplibregl.Map({
            container: 'map',
            style: styleData,
            center: [${initLon}, ${initLat}],
            zoom: ${initialZoom},
            attributionControl: false,
            preserveDrawingBuffer: true
          });
          window._osmMap = map;

          map.dragRotate.disable();
          map.touchZoomRotate.disableRotation();

          function reportBounds() {
            try {
              var bounds = map.getBounds();
              if (!bounds) return;
              postMsg({
                type: 'boundsChange',
                bounds: {
                  northEast: {
                    latitude: bounds.getNorthEast().lat,
                    longitude: bounds.getNorthEast().lng
                  },
                  southWest: {
                    latitude: bounds.getSouthWest().lat,
                    longitude: bounds.getSouthWest().lng
                  },
                }
              });
            } catch(e) {}
          }

          map.on('moveend', reportBounds);
          map.on('zoomend', reportBounds);

          map.on('load', function() {
            var hint = document.getElementById('loadingHint');
            if (hint) hint.style.display = 'none';
            postMsg({ type: 'ready' });
            setTimeout(reportBounds, 500);
          });

          map.on('error', function(e) {
            var errorMsg = (e.error && e.error.message) || 'Map error';
            postMsg({ type: 'error', message: errorMsg, details: JSON.stringify(e.error || {}) });
          });

          map.on('tileerror', function(e) {
            var tileUrl = (e.tile && e.tile.url) || 'unknown';
            var tileErr = (e.error && e.error.message) || 'unknown';
            postMsg({ type: 'error', message: 'Tile load failed: ' + tileErr, url: tileUrl });
          });

        } catch(e) {
          postMsg({ type: 'error', message: 'initMap error: ' + e.message });
        }
      }

      window._captureMap = function(bbox) {
        try {
          if (typeof window._osmMap !== 'undefined' && window._osmMap) {
            var canvas = window._osmMap.getCanvas();
            if (canvas) {
              if (bbox && window._osmMap.project) {
                var sw = window._osmMap.project([bbox.minLon, bbox.minLat]);
                var ne = window._osmMap.project([bbox.maxLon, bbox.maxLat]);
                var pr = window.devicePixelRatio || 1;
                var x = Math.floor(Math.min(sw.x, ne.x) * pr);
                var y = Math.floor(Math.min(sw.y, ne.y) * pr);
                var w = Math.ceil(Math.abs(ne.x - sw.x) * pr);
                var h = Math.ceil(Math.abs(ne.y - sw.y) * pr);
                x = Math.max(0, x); y = Math.max(0, y);
                w = Math.min(w, canvas.width - x); h = Math.min(h, canvas.height - y);
                if (w > 0 && h > 0) {
                  var cc = document.createElement('canvas'); cc.width=w; cc.height=h;
                  cc.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
                  postMsg({type:'captureResult', dataUrl: cc.toDataURL('image/png')});
                  return;
                }
              }
              postMsg({type:'captureResult', dataUrl: canvas.toDataURL('image/png')});
            } else {
              postMsg({type:'captureResult', error:'Canvas not available'});
            }
          } else {
            postMsg({type:'captureResult', error:'Map not initialized'});
          }
        } catch(e) {
          postMsg({type:'captureResult', error:'_captureMap error: ' + e.message});
        }
      };

      var embeddedStyle = ${styleJson};
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initMapWithStyle(embeddedStyle); });
      } else {
        initMapWithStyle(embeddedStyle);
      }
    })();
  <\/script>
</body>
</html>`;
  }, [initLat, initLon, initialZoom, styleJson]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'ready') {
        setIsReady(true);
      } else if (data.type === 'boundsChange' && data.bounds) {
        onBoundsChange?.(data.bounds);
      } else if (data.type === 'captureResult') {
        console.log('[OSMSelectMap] captureResult received, dataUrl length:', data.dataUrl ? data.dataUrl.length : 0, 'error:', data.error || 'none');
        if (captureResolveRef.current) {
          if (data.dataUrl && data.dataUrl.length > 100) {
            captureResolveRef.current(data.dataUrl);
          } else {
            captureResolveRef.current(null);
          }
          captureResolveRef.current = null;
        }
      } else if (data.type === 'error') {
        console.warn('[OSMSelectMap] Error:', data.message, data.url || '', data.details || '');
        errorCountRef.current += 1;
        if (errorCountRef.current >= 3 && !hasReportedErrorRef.current) {
          hasReportedErrorRef.current = true;
          console.warn('[OSMSelectMap] 错误次数超过阈值，触发加载失败回调');
          onLoadError?.();
        }
      } else if (data.type === 'log') {
        console.log('[OSMSelectMap] Log:', data.message);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [onBoundsChange, onLoadError]);

  useEffect(() => {
    if (isReady) {
      onMapReady?.();
    }
  }, [isReady, onMapReady]);

  return (
    <View style={[styles.container, style]}>
      {styleJson === 'ERROR' && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>地图服务暂时不可用</Text>
          <Text style={styles.errorSubtext}>请检查网络连接或稍后重试</Text>
        </View>
      )}
      {styleJson && styleJson !== 'ERROR' ? (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent, baseUrl: 'file:///android_asset/' }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          allowUniversalAccessFromFileURLs
          allowFileAccess
          allowFileAccessFromFileURLs
          onMessage={handleMessage}
          onLoadStart={() => console.log('[OSMSelectMap] WebView load start')}
          onLoadEnd={() => console.log('[OSMSelectMap] WebView load end')}
          onError={(syntheticEvent) => {
            console.error('[OSMSelectMap] WebView error:', syntheticEvent.nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            console.error('[OSMSelectMap] HTTP error:', syntheticEvent.nativeEvent);
          }}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
        />
      ) : (
        <View style={styles.loadingPlaceholder} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingPlaceholder: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});

export default memo(OSMSelectMap);
