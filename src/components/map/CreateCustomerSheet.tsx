/**
 * 录入建企/厂家 - 底部弹窗表单（V2）
 *
 * 通用组件，通过 title prop 自动判断是建企还是厂家，展示对应的类型选项。
 * 支持：
 *   - 名称（必填）
 *   - 类型标签选择
 *   - 联系人 / 联系电话
 *   - 地图选点经营地址（必填）
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
import { useAuthStore, useMapStore } from '@/stores';

const PICKER_MAP_STYLE = getMapTileStyle();
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 建企类型选项
const ENTERPRISE_TYPE_OPTIONS = [
  { label: '施工单位', value: '8' },
  { label: '设计单位', value: '9' },
  { label: '勘察单位', value: '10' },
  { label: '监理单位', value: '11' },
  { label: '招标代理', value: '12' },
  { label: '造价咨询', value: '13' },
  { label: '审图单位', value: '14' },
  { label: '检测单位', value: '15' },
  { label: '其他企业', value: '16' },
];

// 厂家类型选项
const MANUFACTURER_TYPE_OPTIONS = [
  { label: '材料供应', value: '1' },
  { label: '劳务班组', value: '2' },
  { label: '机械设备', value: '3' },
  { label: '商务服务', value: '4' },
  { label: '智能化', value: '5' },
  { label: '运维服务', value: '6' },
];

export interface CreateCustomerFormData {
  name: string;
  type?: string;
  contact?: string;
  phone?: string;
  regionName?: string;
  address?: string;
  location: { lat: number; lng: number };
}

interface CreateCustomerSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  initialLocation?: { latitude: number; longitude: number };
  onSuccess?: () => void;
  onSubmit?: (data: CreateCustomerFormData) => Promise<void>;
  onRequireLogin?: () => void;
}

export const CreateCustomerSheet: FC<CreateCustomerSheetProps> = ({
  visible,
  onClose,
  title = '新建客户',
  initialLocation,
  onSuccess,
  onSubmit,
  onRequireLogin,
}) => {
  const insets = useSafeAreaInsets();
  const { userLocation } = useMapStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation ? { lat: initialLocation.latitude, lng: initialLocation.longitude } : null,
  );
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerCenter, setPickerCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerZoom, setPickerZoom] = useState<number>(15);

  // 判断类型
  const isEnterprise = title.includes('建企') || title.includes('企业');
  const isManufacturer = title.includes('厂家');
  const typeOptions = isEnterprise ? ENTERPRISE_TYPE_OPTIONS : isManufacturer ? MANUFACTURER_TYPE_OPTIONS : [];
  const nameLabel = isEnterprise ? '建企名称' : isManufacturer ? '厂家名称' : '名称';

  // 拖拽动画
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
    setName(''); setSelectedType(''); setContact(''); setPhone('');
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
    if (!name.trim()) { Alert.alert('提示', `请输入${nameLabel}`); return; }
    if (!selectedLocation) { Alert.alert('提示', '请选择位置'); return; }

    setLoading(true);
    try {
      const payload: CreateCustomerFormData = { name: name.trim(), location: selectedLocation };
      if (selectedType) payload.type = selectedType;
      if (contact.trim()) payload.contact = contact.trim();
      if (phone.trim()) payload.phone = phone.trim();

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        Alert.alert('提示', '普通用户无权限创建企业或工厂，请联系客服 0571-85850875', [{ text: '确定' }]);
      }
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      Alert.alert('错误', error?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  }, [name, selectedType, contact, phone, selectedLocation, onSubmit, onSuccess, handleClose, nameLabel, onRequireLogin]);

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
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.sheetSubtitle}>提交后需等待审核</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{nameLabel} *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder={`请输入${nameLabel}`} placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>

        {/* 类型选择标签 */}
        {typeOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isEnterprise ? '建企类型' : '厂家类型'}</Text>
            <View style={styles.chipGrid}>
              {typeOptions.map(opt => {
                const isSelected = selectedType === opt.value;
                return (
                  <TouchableOpacity key={opt.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelectedType(isSelected ? '' : opt.value)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系人</Text>
          <TextInput style={styles.input} value={contact} onChangeText={setContact}
            placeholder="请输入联系人" placeholderTextColor="rgba(0,0,0,0.4)" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系电话</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="请输入联系电话" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>经营地址 *</Text>
          <TouchableOpacity style={styles.locationInput} onPress={openMapPicker} activeOpacity={0.8}>
            <Text style={[styles.locationText, !selectedLocation && styles.locationPlaceholder]} numberOfLines={1}>
              {selectedLocation
                ? `经度: ${selectedLocation.lng.toFixed(6)}, 纬度: ${selectedLocation.lat.toFixed(6)}`
                : '点击选择经营地址'}
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
            : <Text style={styles.submitButtonText}>提交审核</Text>}
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
            <Text style={styles.mapPickerTitle}>选择经营地址</Text>
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
                  <Text style={styles.hintText}>拖动地图，将标记定位到目标位置</Text>
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
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  chipSelected: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { fontSize: 13, color: '#333', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
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
