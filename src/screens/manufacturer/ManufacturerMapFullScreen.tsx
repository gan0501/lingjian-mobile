import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import { Spacing } from '@/constants/spacing';
import { FontSize } from '@/constants/typography';
import type { RootStackScreenProps } from '@/navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TIANDITU_KEY = '5f0faa0b93213cc747eebab0891c2cfc';

type Props = RootStackScreenProps<'ManufacturerMapFullScreen'>;

const ManufacturerMapFullScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { lat, lon, name } = route.params;

  const openNavigation = () => {
    const url = `https://uri.amap.com/navigation?to=${lon},${lat},${encodeURIComponent(name)}&mode=car&policy=1&src=myapp`;
    Linking.openURL(url).catch(() => {
      Alert.alert('提示', '无法打开导航应用');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          source={{
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=18.0, minimum-scale=1.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
  <script src="https://api.tianditu.gov.cn/api?v=4.0&tk=${TIANDITU_KEY}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var imgUrl = 'https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}';
    var ciaUrl = 'https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}';
    var imgLayer = new T.TileLayer(imgUrl, {minZoom: 1, maxZoom: 18});
    var ciaLayer = new T.TileLayer(ciaUrl, {minZoom: 1, maxZoom: 18});
    var map = new T.Map('map', {
      projection: 'EPSG:900913',
      layers: [imgLayer, ciaLayer]
    });
    map.centerAndZoom(new T.LngLat(${lon}, ${lat}), 11);
    var marker = new T.Marker(new T.LngLat(${lon}, ${lat}));
    map.addOverLay(marker);
  </script>
</body>
</html>
            `,
            baseUrl: 'https://api.tianditu.gov.cn',
          }}
          style={styles.webView}
        />
      </View>

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
          <Navigation color="#fff" size={18} />
          <Text style={styles.navButtonText}>导航到这里</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { ...StyleSheet.absoluteFillObject },
  webView: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: '600', color: '#fff', textAlign: 'center', marginHorizontal: Spacing.sm },
  headerRight: { width: 40 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.md },
  navButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#80011A', paddingVertical: 14, borderRadius: 10, gap: 8 },
  navButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ManufacturerMapFullScreen;
