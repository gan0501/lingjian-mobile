/**
 * 新建项目 - 底部弹窗表单（V2）
 *
 * 白色主题弹窗，支持：
 *   - 项目名称（必填）
 *   - 建设单位
 *   - 联系人
 *   - 项目规模
 *   - 地图选点（必填）
 * 表单下拉关闭 + 地图选择器全屏子弹窗。
 */
import React, { useState, useCallback, useRef, useEffect, FC } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated, PanResponder, Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { DayColors, MAP_CONFIG, getMapTileStyle } from '@/constants';
import { userApi } from '@/services';
import { useAuthStore, useMapStore } from '@/stores';

const PICKER_MAP_STYLE = getMapTileStyle();
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CreateProjectSheetProps {
  visible: boolean;
  onClose: () => void;
  initialLocation?: { latitude: number; longitude: number };
  onSuccess?: () => void;
  onRequireLogin?: () => void;
}

export const CreateProjectSheet: FC<CreateProjectSheetProps> = ({
  visible,
  onClose,
  initialLocation,
  onSuccess,
  onRequireLogin,
}) => {
  const insets = useSafeAreaInsets();
  const { userLocation } = useMapStore();
  const [loading, setLoading] = useState(false);

  // 表单数据
  const [projectName, setProjectName] = useState('');
  const [constructor, setConstructor] = useState('');
  const [contact, setContact] = useState('');
  const [area, setArea] = useState('');

  // 地图选择位置
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation ? { lat: initialLocation.latitude, lng: initialLocation.longitude } : null,
  );
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerCenter, setPickerCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerZoom, setPickerZoom] = useState<number>(15);

  // 拖拽关闭动画
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100) {
          Animated.timing(panY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start(() => {
            handleClose(); panY.setValue(0);
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 8, overshootClamping: true }).start();
        }
      },
    }),
  ).current;

  const handleClose = useCallback(() => {
    setProjectName(''); setConstructor(''); setContact(''); setArea('');
    setSelectedLocation(null); panY.setValue(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    panY.setValue(SCREEN_HEIGHT);
    Animated.timing(panY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, panY]);

  const handleSubmit = useCallback(async () => {
    const { isLoggedIn } = useAuthStore.getState();
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    if (!projectName.trim()) { Alert.alert('提示', '请输入项目名称'); return; }
    if (!selectedLocation) { Alert.alert('提示', '请选择项目位置'); return; }

    setLoading(true);
    try {
      await userApi.createFollowedProject({
        project_id: `custom_${Date.now()}`,
        project_name: projectName.trim(),
        project_type: 'custom',
        project_data: {
          lat: selectedLocation.lat, lng: selectedLocation.lng,
          builderUnit: constructor.trim() || undefined,
          contact: contact.trim() || undefined,
          area: area.trim() || undefined,
          custom_type: '自建项目',
        },
      });
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      Alert.alert('错误', error?.message || '创建项目失败');
    } finally {
      setLoading(false);
    }
  }, [projectName, selectedLocation, constructor, contact, area, onSuccess, handleClose, onRequireLogin]);

  const openMapPicker = useCallback(() => {
    if (selectedLocation) {
      setPickerCenter(selectedLocation);
    } else if (userLocation && userLocation.latitude !== 0) {
      // 优先使用用户当前 GPS 定位
      setPickerCenter({ lat: userLocation.latitude, lng: userLocation.longitude });
    } else if (initialLocation) {
      setPickerCenter({ lat: initialLocation.latitude, lng: initialLocation.longitude });
    } else {
      setPickerCenter({ lat: MAP_CONFIG.DEFAULT_CENTER.latitude, lng: MAP_CONFIG.DEFAULT_CENTER.longitude });
    }
    setShowMapPicker(true);
  }, [selectedLocation, userLocation, initialLocation]);

  if (!visible) return null;

  const useKAV = Platform.OS === 'ios';

  const sheetContent = (
    <>
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>新建项目</Text>
        <Text style={styles.sheetSubtitle}>新建项目仅用户自己可见</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>项目名称 *</Text>
          <TextInput style={styles.input} value={projectName} onChangeText={setProjectName}
            placeholder="请输入项目名称" placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>建设单位</Text>
          <TextInput style={styles.input} value={constructor} onChangeText={setConstructor}
            placeholder="请输入建设单位" placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系人</Text>
          <TextInput style={styles.input} value={contact} onChangeText={setContact}
            placeholder="请输入联系人姓名" placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>项目规模</Text>
          <TextInput style={styles.input} value={area} onChangeText={setArea}
            placeholder="请输入项目规模或面积" placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>项目位置 *</Text>
          <TouchableOpacity style={styles.locationInput} onPress={openMapPicker} activeOpacity={0.8}>
            <Text style={[styles.locationText, !selectedLocation && styles.locationPlaceholder]} numberOfLines={1}>
              {selectedLocation
                ? `经度: ${selectedLocation.lng.toFixed(6)}, 纬度: ${selectedLocation.lat.toFixed(6)}`
                : '点击选择项目位置'}
            </Text>
            <Text style={{ fontSize: 16 }}>📍</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.bottomButtonContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitButtonText}>创建项目</Text>}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={handleClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: panY }] }]} {...panResponder.panHandlers}>
          {useKAV
            ? <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>{sheetContent}</KeyboardAvoidingView>
            : <View style={styles.keyboardView}>{sheetContent}</View>}
        </Animated.View>
      </View>

      {/* 地图选择器 - 全屏 */}
      <Modal visible={showMapPicker} transparent={false} animationType="slide" statusBarTranslucent
        onRequestClose={() => setShowMapPicker(false)}>
        <View style={styles.mapPickerFullScreen}>
          <View style={[styles.mapPickerTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.mapPickerBackBtn}>
              <X size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.mapPickerTitle}>选择项目位置</Text>
            <View style={{ width: 34 }} />
          </View>
          <View style={styles.mapPickerMapFull}>
            {pickerCenter ? (
              <>
                <MapLibreGL.MapView style={StyleSheet.absoluteFillObject} mapStyle={PICKER_MAP_STYLE as any}
                  rotateEnabled={false} pitchEnabled={false} compassEnabled={false}
                  onRegionDidChange={(feature: any) => {
                    try {
                      const c = feature?.geometry?.coordinates;
                      const z = feature?.properties?.zoomLevel;
                      if (c?.length >= 2) setPickerCenter({ lat: c[1], lng: c[0] });
                      if (z !== undefined) setPickerZoom(z);
                    } catch {}
                  }}>
                  <MapLibreGL.Camera centerCoordinate={[pickerCenter.lng, pickerCenter.lat]}
                    zoomLevel={pickerZoom} animationMode="moveTo" animationDuration={0} />
                </MapLibreGL.MapView>
                <View style={styles.centerMarker} pointerEvents="none">
                  <View style={styles.centerDot}><View style={styles.centerDotInner} /></View>
                </View>
                <View style={styles.hintOverlay} pointerEvents="none">
                  <Text style={styles.hintText}>拖动地图，将标记定位到项目位置</Text>
                </View>
              </>
            ) : (
              <View style={styles.mapLoading}><Text style={{ fontSize: 14, color: '#999' }}>正在获取位置...</Text></View>
            )}
          </View>
          <View style={[styles.mapPickerBottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
            <TouchableOpacity style={styles.confirmButton}
              onPress={() => { if (pickerCenter) setSelectedLocation(pickerCenter); setShowMapPicker(false); }}>
              <Text style={styles.confirmButtonText}>确认此位置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  overlayTouch: { flex: 1 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: SCREEN_HEIGHT * 0.75, maxHeight: SCREEN_HEIGHT * 0.85 },
  keyboardView: { flex: 1 },
  sheetHeader: { paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  sheetSubtitle: { fontSize: 12, color: '#999', marginTop: 4 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: 'rgba(0,0,0,0.6)', marginBottom: 6 },
  input: {
    backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 0,
    height: 44, fontSize: 15, color: '#000', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    textAlignVertical: 'center',
  },
  locationInput: {
    backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  locationText: { fontSize: 15, color: '#000', flex: 1 },
  locationPlaceholder: { color: '#999' },
  bottomButtonContainer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  submitButton: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  // 地图选择器
  mapPickerFullScreen: { flex: 1, backgroundColor: '#fff' },
  mapPickerTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  mapPickerBackBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  mapPickerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  mapPickerMapFull: { flex: 1, position: 'relative' },
  mapPickerBottomBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  centerMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -10, marginTop: -20, zIndex: 10 },
  centerDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: DayColors.accent,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
    justifyContent: 'center', alignItems: 'center',
  },
  centerDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  hintOverlay: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  hintText: { fontSize: 12, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  confirmButton: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
