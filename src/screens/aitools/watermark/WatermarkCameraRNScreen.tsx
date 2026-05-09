import React, { FC, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  Animated,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RNCamera } from 'react-native-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Geolocation from 'react-native-geolocation-service';
import { getAMapCurrentLocation } from '@/services/AMapLocationService';
import { launchImageLibrary } from 'react-native-image-picker';
import { DayColors, Spacing, BorderRadius, FontSize, TextStyles, MAP_CONFIG } from '@/constants';
import { SemanticColors } from '@/constants/colors';
import { useOverlay } from '@/components/overlay';
import { Icon } from '@/components/common';

const APP_LOGO = require('../../../assets/images/icon-128x128.png');
const SHARE_ICON = require('../../../assets/images/share.png');
const { width, height } = Dimensions.get('window');

interface InfoField {
  label: string;
  value: string;
  show: boolean;
  disabled?: boolean;
}

interface WatermarkConfig {
  title: string;
  time: string;
  date: string;
  weather: string;
  location: string;
  coordinates: string;
  altitude: string;
  antiFakeCode: string;
  userLogo: string | null;
  showLogo: boolean;
  showAd: boolean;
  showTime: boolean;
  showCoordinates: boolean;
  showAltitude: boolean;
  showMap: boolean;
  showQRCode: boolean;
  licensePlateMode: boolean;
  signatureMode: boolean;
  displayMode: 'weather' | 'count';
  countValue: string;
  countUnit: string;
  leftFields: InfoField[];
  rightFields: InfoField[];
  colorStyleEnabled: boolean;
  brandColor: string;
  lineStyle: 'double' | 'thick' | 'envelope';
}

interface LogoUploadModalProps {
  visible: boolean;
  currentLogo: string | null;
  onClose: () => void;
  onConfirm: (logoUri: string | null) => void;
}

const LogoUploadModal: FC<LogoUploadModalProps> = ({ visible, currentLogo, onClose, onConfirm }) => {
  const [selectedLogo, setSelectedLogo] = useState<string | null>(currentLogo);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const pickImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('提示', '选择图片失败');
          return;
        }
        if (response.assets && response.assets[0]?.uri) {
          setSelectedLogo(response.assets[0].uri);
        }
      }
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedLogo);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={styles.modalOverlayTouchable} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalOverlayBackground} />
      </TouchableOpacity>
      <Animated.View style={[styles.modalContentWrapper, styles.logoModalContent, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>设置Logo</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.logoModalBody}>
          <TouchableOpacity style={styles.logoUploadArea} onPress={pickImage}>
            {selectedLogo ? (
              <Image source={{ uri: selectedLogo }} style={styles.logoPreview} resizeMode="contain" />
            ) : (
              <View style={styles.logoUploadPlaceholder}>
                <Icon name="upload" size={32} color="#999" />
                <Text style={styles.logoUploadText}>点击上传Logo</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.logoHint}>建议上传正方形Logo图片</Text>
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSaveButton} onPress={handleConfirm}>
            <Text style={styles.modalSaveText}>确认</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

interface WatermarkEditModalProps {
  visible: boolean;
  config: WatermarkConfig;
  onClose: () => void;
  onSave: (config: WatermarkConfig) => void;
}

const UNIT_OPTIONS = ['个', '件', '套', '米', '平方米', '立方米', '吨', '千克', '台', '批', '组', '根', '块', '片', '卷', '箱', '包', '袋', '桶', '瓶'];

const UnitPickerModal: FC<{ visible: boolean; selected: string; onSelect: (unit: string) => void; onClose: () => void }> = ({ visible, selected, onSelect, onClose }) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[styles.modalOverlay, styles.secondLevelModalOverlay]}>
      <TouchableOpacity style={styles.modalOverlayTouchable} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalOverlayBackground} />
      </TouchableOpacity>
      <Animated.View style={[styles.modalContentWrapper, styles.secondLevelModalContent, styles.unitPickerContent, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>选择单位</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.unitPickerBody}>
          {UNIT_OPTIONS.map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[styles.unitOption, selected === unit && styles.unitOptionActive]}
              onPress={() => { onSelect(unit); onClose(); }}
            >
              <Text style={[styles.unitOptionText, selected === unit && styles.unitOptionTextActive]}>{unit}</Text>
              {selected === unit && <Icon name="check" size={20} color="#EF4444" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const WatermarkEditModal: FC<WatermarkEditModalProps> = ({ visible, config, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'fields'>('config');
  const [editConfig, setEditConfig] = useState(config);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    setEditConfig(config);
  }, [config]);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const updateField = (index: number, side: 'left' | 'right', field: Partial<InfoField>) => {
    const fields = side === 'left' ? [...editConfig.leftFields] : [...editConfig.rightFields];
    fields[index] = { ...fields[index], ...field };
    if (side === 'left') {
      setEditConfig({ ...editConfig, leftFields: fields });
    } else {
      setEditConfig({ ...editConfig, rightFields: fields });
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={styles.modalOverlayTouchable} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalOverlayBackground} />
      </TouchableOpacity>
      <Animated.View style={[styles.modalContentWrapper, styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.tabHeader}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'config' && styles.tabItemActive]}
              onPress={() => setActiveTab('config')}
            >
              <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>水印配置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'fields' && styles.tabItemActive]}
              onPress={() => setActiveTab('fields')}
            >
              <Text style={[styles.tabText, activeTab === 'fields' && styles.tabTextActive]}>编辑信息项</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'config' ? (
            <ScrollView style={styles.modalBody}>
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>一、右上角区域</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>启用右上角区域</Text>
                  <Switch value={true} onValueChange={() => {}} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>标题</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editConfig.title}
                    onChangeText={(text) => setEditConfig({ ...editConfig, title: text })}
                    placeholder="记录标题"
                  />
                </View>
                <Text style={styles.editSubLabel}>显示模式</Text>
                <View style={styles.radioRow}>
                  <TouchableOpacity
                    style={styles.radioItem}
                    onPress={() => setEditConfig({ ...editConfig, displayMode: 'weather' })}
                  >
                    <View style={[styles.radioCircle, editConfig.displayMode === 'weather' && styles.radioCircleActive]} />
                    <Text style={styles.radioText}>天气</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioItem}
                    onPress={() => setEditConfig({ ...editConfig, displayMode: 'count' })}
                  >
                    <View style={[styles.radioCircle, editConfig.displayMode === 'count' && styles.radioCircleActive]} />
                    <Text style={styles.radioText}>计数</Text>
                  </TouchableOpacity>
                  <View style={[styles.countInputContainer, editConfig.displayMode !== 'count' && styles.countInputHidden]}>
                    <TextInput
                      style={styles.countInputWithUnit}
                      value={editConfig.countValue}
                      onChangeText={(text) => setEditConfig({ ...editConfig, countValue: text })}
                      placeholder="数量"
                      keyboardType="numeric"
                      editable={editConfig.displayMode === 'count'}
                    />
                    <TouchableOpacity 
                      style={[styles.countUnitInnerButton, editConfig.displayMode !== 'count' && styles.countUnitHidden]} 
                      onPress={() => setShowUnitPicker(true)}
                      disabled={editConfig.displayMode !== 'count'}
                    >
                      <Text style={styles.countUnitInnerText}>{editConfig.countUnit}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示时间</Text>
                  <Switch value={editConfig.showTime} onValueChange={(v) => setEditConfig({ ...editConfig, showTime: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示经纬度</Text>
                  <Switch value={editConfig.showCoordinates} onValueChange={(v) => setEditConfig({ ...editConfig, showCoordinates: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示海拔</Text>
                  <Switch value={editConfig.showAltitude} onValueChange={(v) => setEditConfig({ ...editConfig, showAltitude: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>二、右下角区域</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示地图缩略图</Text>
                  <Switch value={editConfig.showMap} onValueChange={(v) => setEditConfig({ ...editConfig, showMap: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示二维码</Text>
                  <Switch value={editConfig.showQRCode} onValueChange={(v) => setEditConfig({ ...editConfig, showQRCode: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>三、左下角特殊场景</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>显示品牌Logo</Text>
                  <Switch value={editConfig.showLogo} onValueChange={(v) => setEditConfig({ ...editConfig, showLogo: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>车牌识别模式</Text>
                  <Switch value={editConfig.licensePlateMode} onValueChange={(v) => setEditConfig({ ...editConfig, licensePlateMode: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>签名模式</Text>
                  <Switch value={editConfig.signatureMode} onValueChange={(v) => setEditConfig({ ...editConfig, signatureMode: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>四、色系风格</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>启用色系风格</Text>
                  <Switch value={editConfig.colorStyleEnabled} onValueChange={(v) => setEditConfig({ ...editConfig, colorStyleEnabled: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                </View>
                {editConfig.colorStyleEnabled && (
                  <>
                    <Text style={styles.editSubLabel}>品牌色系</Text>
                    <View style={styles.colorPickerRow}>
                      {[
                        { color: '#EF4444', name: '红' },
                        { color: '#000000', name: '黑' },
                        { color: '#3B82F6', name: '蓝' },
                        { color: '#22C55E', name: '绿' },
                        { color: '#06B6D4', name: '青' },
                        { color: '#F97316', name: '橙' },
                        { color: '#EAB308', name: '黄' },
                        { color: '#A855F7', name: '紫' },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.color}
                          style={[styles.colorCircle, { backgroundColor: item.color }, editConfig.brandColor === item.color && styles.colorCircleActive]}
                          onPress={() => setEditConfig({ ...editConfig, brandColor: item.color })}
                        >
                          {editConfig.brandColor === item.color && (
                            <Icon name="check" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.editSubLabel}>分隔线段</Text>
                    <View style={styles.lineStyleRow}>
                      {[
                        { style: 'double' as const, label: '双线' },
                        { style: 'thick' as const, label: '粗线' },
                        { style: 'envelope' as const, label: '信封边' },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.style}
                          style={[styles.lineStyleItem, editConfig.lineStyle === item.style && styles.lineStyleItemActive]}
                          onPress={() => setEditConfig({ ...editConfig, lineStyle: item.style })}
                        >
                          <View style={[styles.lineStylePreview, editConfig.lineStyle === item.style && { borderColor: editConfig.brandColor }]}>
                            {item.style === 'double' && (
                              <View style={styles.lineDoublePreview}>
                                <View style={[styles.lineThickBar, { backgroundColor: editConfig.brandColor }]} />
                                <View style={[styles.lineThinBar, { backgroundColor: editConfig.brandColor }]} />
                              </View>
                            )}
                            {item.style === 'thick' && (
                              <View style={[styles.lineSingleThick, { backgroundColor: editConfig.brandColor }]} />
                            )}
                            {item.style === 'envelope' && (
                              <View style={styles.lineEnvelopePreview}>
                                {[...Array(10)].map((_, i) => (
                                  <View
                                    key={i}
                                    style={[
                                      styles.lineEnvelopeDash,
                                      {
                                        backgroundColor: editConfig.brandColor,
                                        left: `${8 + (i / 9) * 84}%`,
                                      }
                                    ]}
                                  />
                                ))}
                              </View>
                            )}
                          </View>
                          <Text style={[styles.lineStyleLabel, editConfig.lineStyle === item.style && { color: editConfig.brandColor }]}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.modalBody}>
              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>第一列信息（最多6项）</Text>
                {editConfig.leftFields.map((field, index) => (
                  <View key={`left-${index}`} style={styles.fieldRow}>
                    <Switch 
                      value={field.show} 
                      onValueChange={(v) => !field.disabled && updateField(index, 'left', { show: v })} 
                      trackColor={{ false: '#E5E5E5', true: field.disabled ? '#999999' : '#EF4444' }} 
                      thumbColor="#FFFFFF"
                      disabled={field.disabled}
                    />
                    <TextInput
                      style={[styles.fieldLabelInput, field.disabled && styles.fieldInputDisabled]}
                      value={field.label}
                      onChangeText={(text) => !field.disabled && updateField(index, 'left', { label: text })}
                      placeholder="标签"
                      editable={!field.disabled}
                    />
                    <TextInput
                      style={[styles.fieldValueInput, field.disabled && styles.fieldInputDisabled]}
                      value={field.value}
                      onChangeText={(text) => !field.disabled && updateField(index, 'left', { value: text })}
                      placeholder="内容"
                      editable={!field.disabled}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>第二列信息（最多6项）</Text>
                {editConfig.rightFields.map((field, index) => (
                  <View key={`right-${index}`} style={styles.fieldRow}>
                    <Switch value={field.show} onValueChange={(v) => updateField(index, 'right', { show: v })} trackColor={{ false: '#E5E5E5', true: '#EF4444' }} thumbColor="#FFFFFF" />
                    <TextInput
                      style={styles.fieldLabelInput}
                      value={field.label}
                      onChangeText={(text) => updateField(index, 'right', { label: text })}
                      placeholder="标签"
                    />
                    <TextInput
                      style={styles.fieldValueInput}
                      value={field.value}
                      onChangeText={(text) => updateField(index, 'right', { value: text })}
                      placeholder="内容"
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={() => {
                const autoEnableFields = (fields: InfoField[]) =>
                  fields.map(f => f.value?.trim() ? { ...f, show: true } : f);
                const configToSave = {
                  ...editConfig,
                  leftFields: autoEnableFields(editConfig.leftFields),
                  rightFields: autoEnableFields(editConfig.rightFields),
                };
                onSave(configToSave);
                onClose();
              }}
            >
              <Text style={styles.modalSaveText}>确认</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <UnitPickerModal
          visible={showUnitPicker}
          selected={editConfig.countUnit}
          onSelect={(unit) => setEditConfig({ ...editConfig, countUnit: unit })}
          onClose={() => setShowUnitPicker(false)}
        />
    </View>
  );
};

const getWeatherEmoji = (weather: string): string => {
  if (weather.includes('雨')) return '🌧️';
  if (weather.includes('晴')) return '☀️';
  if (weather.includes('多云') || weather.includes('阴')) return '⛅';
  if (weather.includes('雪')) return '❄️';
  if (weather.includes('雷')) return '⚡';
  if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
  if (weather.includes('风')) return '💨';
  return '🌤️';
};

const TopRightWatermark: FC<{ config: WatermarkConfig; alpha?: number }> = ({ config, alpha = 1 }) => (
  <View style={[styles.topRightWatermark, { opacity: alpha }]}>
    <View>
      <Text style={styles.topRightTitle}>{config.title}</Text>
      {config.colorStyleEnabled && <View style={[styles.topRightTitleLine, { backgroundColor: config.brandColor }]} />}
    </View>
    {config.displayMode === 'weather' ? (
      <View style={styles.topRightWeatherRow}>
        <Text style={styles.topRightWeatherEmoji}>{getWeatherEmoji(config.weather)}</Text>
        <Text style={styles.topRightWeather}>{config.weather}</Text>
      </View>
    ) : (
      <View style={styles.topRightCountRow}>
        <Text style={styles.topRightCountBox}>📦</Text>
        <Text style={[styles.topRightCountValue, config.colorStyleEnabled && { color: config.brandColor }]}>{config.countValue}</Text>
        <Text style={styles.topRightCountUnit}>{config.countUnit}</Text>
      </View>
    )}
    {config.showTime && <Text style={styles.topRightTime}>{config.time}</Text>}
    <Text style={styles.topRightDate}>{config.date}</Text>
    {config.showCoordinates && <Text style={styles.topRightCoords}>{config.coordinates}</Text>}
    {config.showAltitude && <Text style={styles.topRightCoords}>海拔: {config.altitude}</Text>}
  </View>
);

const BottomWatermark: FC<{ config: WatermarkConfig; alpha?: number }> = ({ config, alpha = 1 }) => {
  const leftItems = config.leftFields.filter(f => f.show);
  const rightItems = config.rightFields.filter(f => f.show);

  return (
    <View style={[styles.bottomWatermark, { opacity: alpha }]}>
      <View style={styles.bottomWatermarkContent}>
        <View style={styles.bottomWatermarkColumns}>
          {leftItems.length > 0 && (
            <View style={styles.bottomWatermarkColumn}>
              {leftItems.map((field, index) => (
                <View key={`left-${index}`} style={styles.bottomWatermarkRow}>
                  <Text style={styles.bottomWatermarkLabel}>{field.label}</Text>
                  <Text style={field.label === '地点' ? styles.bottomWatermarkValueLocation : styles.bottomWatermarkValue} numberOfLines={field.label === '地点' ? 2 : 1}>{field.value}</Text>
                </View>
              ))}
            </View>
          )}
          {rightItems.length > 0 && (
            <View style={styles.bottomWatermarkColumn}>
              {rightItems.map((field, index) => (
                <View key={`right-${index}`} style={styles.bottomWatermarkRow}>
                  <Text style={styles.bottomWatermarkLabel}>{field.label}</Text>
                  <Text style={field.label === '地点' ? styles.bottomWatermarkValueLocation : styles.bottomWatermarkValue} numberOfLines={field.label === '地点' ? 2 : 1}>{field.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const ColorLine: FC<{ color: string; lineStyle: 'double' | 'thick' | 'envelope' }> = ({ color, lineStyle }) => {
  if (lineStyle === 'double') {
    return (
      <View style={styles.colorLineContainer}>
        <View style={[styles.colorLineThick, { backgroundColor: color }]} />
        <View style={[styles.colorLineThin, { backgroundColor: color }]} />
      </View>
    );
  }
  if (lineStyle === 'envelope') {
    return (
      <View style={[styles.colorLineEnvelopeContainer, { width: '100%' }]}>
        {[...Array(40)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.colorLineEnvelopeStripe,
              {
                backgroundColor: color,
                left: `${(i / 40) * 100}%`,
              }
            ]}
          />
        ))}
      </View>
    );
  }
  return <View style={[styles.colorLineSingle, { backgroundColor: color }]} />;
};

const BottomSection: FC<{ config: WatermarkConfig; alpha?: number }> = ({ config, alpha = 1 }) => (
  <View style={[styles.bottomSection, { opacity: alpha }]}>
    <BottomOverlay config={config} />
    {config.colorStyleEnabled && <ColorLine color={config.brandColor} lineStyle={config.lineStyle} />}
    <BottomWatermark config={config} />
</View>
);

const BottomOverlay: FC<{ config: WatermarkConfig }> = ({ config }) => (
  <View style={styles.bottomOverlay}>
    {config.showLogo && config.userLogo ? (
      <View style={styles.bottomLogoContainer}>
        <Image source={{ uri: config.userLogo }} style={styles.bottomLogo} resizeMode="contain" />
      </View>
    ) : (
      <View style={styles.bottomOverlaySpacer} />
    )}
    {config.showAd && (
      <View style={styles.bottomAdContainer}>
        <View style={styles.bottomAdLogo}>
          <Image source={APP_LOGO} style={styles.bottomAdLogoImage} resizeMode="contain" />
          <Text style={styles.bottomAdLogoText}>领建APP</Text>
        </View>
        <Text style={styles.bottomAdAntiFake}>防伪码:{config.antiFakeCode}</Text>
      </View>
    )}
  </View>
);

const CaptureButton: FC<{ onPress: () => void; disabled?: boolean; loading?: boolean }> = ({ onPress, disabled, loading }) => (
  <TouchableOpacity
    style={[styles.captureButton, disabled && styles.captureButtonDisabled]}
    onPress={onPress}
    activeOpacity={0.85}
    disabled={disabled}
  >
    <View style={styles.captureButtonInner} />
  </TouchableOpacity>
);

const SideButton: FC<{ iconName: any; label: string; onPress: () => void }> = ({ iconName, label, onPress }) => (
  <TouchableOpacity style={styles.sideButton} onPress={onPress} activeOpacity={0.8}>
    <Icon name={iconName} size={22} color={DayColors.text} />
    <Text style={styles.sideButtonLabel}>{label}</Text>
  </TouchableOpacity>
);

const WatermarkCameraRNScreen: FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const overlay = useOverlay();
  const cameraRef = useRef<RNCamera>(null);
  const captureShotRef = useRef<ViewShot>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState(RNCamera.Constants.Type.back);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [watermarkedImagesList, setWatermarkedImagesList] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isCapturing, setIsCapturing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [watermarkAlpha, setWatermarkAlpha] = useState(0.3);

  const leftDefaultFields: InfoField[] = [
    { label: '工程名称', value: '', show: true },
    { label: '施工内容', value: '', show: true },
    { label: '备注', value: '', show: false },
    { label: '自定义1', value: '', show: false },
    { label: '自定义2', value: '', show: false },
    { label: '地点', value: '', show: true, disabled: true },
  ];

  const rightDefaultFields: InfoField[] = [
    { label: '建设单位', value: '', show: true },
    { label: '施工单位', value: '', show: true },
    { label: '监理单位', value: '', show: true },
    { label: '备注', value: '', show: false },
    { label: '自定义1', value: '', show: false },
    { label: '自定义2', value: '', show: false },
  ];

  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    title: '打卡记录',
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    weather: '晴 25℃',
    location: '正在获取位置...',
    coordinates: '',
    altitude: '',
    antiFakeCode: generateAntiFakeCode(),
    userLogo: null,
    showLogo: true,
    showAd: true,
    showTime: true,
    showCoordinates: false,
    showAltitude: false,
    showMap: false,
    showQRCode: false,
    licensePlateMode: false,
    signatureMode: false,
    displayMode: 'weather',
    countValue: '',
    countUnit: '个',
    leftFields: leftDefaultFields,
    rightFields: [...rightDefaultFields],
    colorStyleEnabled: false,
    brandColor: '#EF4444',
    lineStyle: 'double',
  });

  function generateAntiFakeCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  useEffect(() => {
    requestPermissions();
    updateTime();
    const timer = setInterval(updateTime, 60000);
    loadWatermarkConfig();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!capturedImage) return;
    const timer = setTimeout(async () => {
      try {
        const watermarkedUri = await captureShotRef.current?.capture?.();
        if (watermarkedUri) {
          setWatermarkedImagesList((prev) => [...prev, watermarkedUri]);
          CameraRoll.save(watermarkedUri, { type: 'photo', album: 'WatermarkPhoto' }).catch(() => {});
        }
      } catch (err) {
        console.error('Capture watermarked image error:', err);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [capturedImage]);

  const loadWatermarkConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem('watermark_camera_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setWatermarkConfig((prev) => ({
          ...prev,
          ...parsed,
          time: prev.time,
          date: prev.date,
          weather: prev.weather,
          location: prev.location,
          coordinates: prev.coordinates,
          altitude: prev.altitude,
          antiFakeCode: prev.antiFakeCode,
        }));
      }
    } catch (err) {
      console.warn('加载水印配置失败:', err);
    }
  };

  const saveWatermarkConfig = useCallback(async (config: WatermarkConfig) => {
    try {
      await AsyncStorage.setItem('watermark_camera_config', JSON.stringify({
        title: config.title,
        userLogo: config.userLogo,
        showLogo: config.showLogo,
        showAd: config.showAd,
        showTime: config.showTime,
        showCoordinates: config.showCoordinates,
        showAltitude: config.showAltitude,
        showMap: config.showMap,
        showQRCode: config.showQRCode,
        licensePlateMode: config.licensePlateMode,
        signatureMode: config.signatureMode,
        displayMode: config.displayMode,
        countValue: config.countValue,
        countUnit: config.countUnit,
        leftFields: config.leftFields,
        rightFields: config.rightFields,
        colorStyleEnabled: config.colorStyleEnabled,
        brandColor: config.brandColor,
        lineStyle: config.lineStyle,
      }));
    } catch (err) {
      console.warn('保存水印配置失败:', err);
    }
  }, []);

  const requestPermissions = async () => {
    try {
      const cameraGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const coarseLocation = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
      const fineLocation = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const storageGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      setHasPermission(cameraGranted === PermissionsAndroid.RESULTS.GRANTED);
      if (fineLocation === PermissionsAndroid.RESULTS.GRANTED || coarseLocation === PermissionsAndroid.RESULTS.GRANTED) {
        getLocation();
      }
    } catch (err) {
      console.warn(err);
      setHasPermission(false);
    }
  };

  const updateTime = () => {
    setWatermarkConfig((prev) => ({
      ...prev,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    }));
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const amapKey = MAP_CONFIG.AMAP_KEY_ANDROID || MAP_CONFIG.AMAP_KEY_IOS || '';
      if (amapKey && !amapKey.includes('YOUR_AMAP')) {
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(amapKey)}&location=${encodeURIComponent(`${longitude},${latitude}`)}&radius=1000&extensions=base`;
        const resp = await fetch(url);
        const json: any = await resp.json();
        if (json && json.status === '1' && json.regeocode) {
          const formatted = json.regeocode.formatted_address || '';
          const comp = json.regeocode.addressComponent || {};
          const aoiName = comp.aoiName || '';
          const addr = aoiName || formatted;
          if (addr) return addr;
        }
      }
      const tdtKey = MAP_CONFIG.TIANDITU_SERVER_KEY || MAP_CONFIG.TIANDITU_BROWSER_KEY || '';
      if (tdtKey) {
        const postStr = JSON.stringify({ lon: longitude, lat: latitude, ver: 1 });
        const tdtUrl = `http://api.tianditu.gov.cn/geocoder?postStr=${encodeURIComponent(postStr)}&type=geocode&tk=${tdtKey}`;
        const tdtResp = await fetch(tdtUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 'Referer': 'http://lbs.tianditu.gov.cn/' },
        });
        const tdtJson: any = await tdtResp.json();
        if (tdtJson && tdtJson.status === '0' && tdtJson.result) {
          const addr = tdtJson.result.formatted_address || '';
          if (addr) return addr;
        }
      }
    } catch (e) {
      console.log('Reverse geocode failed:', e);
    }
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  const getLocation = () => {
    getAMapCurrentLocation()
      .then((loc) => {
        console.log('AMap Location success:', loc.latitude, loc.longitude, loc.address);
        const readableAddress = loc.aoiName || loc.address || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
        setWatermarkConfig((prev) => ({
          ...prev,
          location: readableAddress,
          coordinates: `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`,
          altitude: loc.altitude ? `${loc.altitude.toFixed(1)}m` : '',
        }));
        setWatermarkConfig((prev) => {
          const newLeftFields = [...prev.leftFields];
          const locationIndex = newLeftFields.findIndex(f => f.label === '地点');
          if (locationIndex >= 0) {
            newLeftFields[locationIndex].value = readableAddress;
          }
          return { ...prev, leftFields: newLeftFields };
        });
      })
      .catch((err) => {
        console.log('AMap Location failed, fallback to Geolocation:', err.message);
        Geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, altitude } = position.coords;
            console.log('Geolocation fallback success:', latitude, longitude);
            const readableAddress = await reverseGeocode(latitude, longitude);
            setWatermarkConfig((prev) => ({
              ...prev,
              location: readableAddress,
              coordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              altitude: altitude ? `${altitude.toFixed(1)}m` : '',
            }));
            setWatermarkConfig((prev) => {
              const newLeftFields = [...prev.leftFields];
              const locationIndex = newLeftFields.findIndex(f => f.label === '地点');
              if (locationIndex >= 0) {
                newLeftFields[locationIndex].value = readableAddress;
              }
              return { ...prev, leftFields: newLeftFields };
            });
          },
          (error) => {
            console.log('All location methods failed:', error.code, error.message);
            let errorMsg = '位置获取失败';
            if (error.code === 3) errorMsg = '定位超时，请检查GPS/网络';
            else if (error.code === 2) errorMsg = '位置服务未开启';
            else if (error.code === 1) errorMsg = '定位权限被拒绝';
            else if (error.code === 4) errorMsg = '无法获取位置，请确认GPS已开启';
            setWatermarkConfig((prev) => {
              const newLeftFields = [...prev.leftFields];
              const locationIndex = newLeftFields.findIndex(f => f.label === '地点');
              if (locationIndex >= 0) {
                newLeftFields[locationIndex].value = errorMsg;
              }
              return { ...prev, leftFields: newLeftFields, location: errorMsg };
            });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, showLocationDialog: true }
        );
      });
  };

  const pickFromGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          overlay.alert({ title: '提示', message: '选择图片失败' });
          return;
        }
        if (response.assets && response.assets[0]?.uri) {
          setCapturedImage(response.assets[0].uri);
          setWatermarkAlpha(1);
        }
      }
    );
  };

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const options = { quality: 1, base64: false, doNotSave: false };
      const data = await cameraRef.current.takePictureAsync(options);
      if (data?.uri) {
        setCapturedImage(data.uri);
        setThumbnailUri(data.uri);
        setPhotoCount((prev) => prev + 1);
        // 带水印的照片将在预览视图的 Image onLoad 回调中生成并添加到列表
      }
    } catch (err) {
      console.error('Take picture error:', err);
      overlay.alert({ title: '提示', message: '拍照失败，请重试' });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const saveToGallery = useCallback(async () => {
    if (!capturedImage) return;
    try {
      const uri = await captureShotRef.current?.capture?.();
      if (!uri) throw new Error('截图失败');
      await CameraRoll.save(uri, { type: 'photo', album: 'WatermarkPhoto' });
      overlay.alert({ title: '提示', message: '照片已保存到相册' });
    } catch (err) {
      console.error('Save error:', err);
      overlay.alert({ title: '提示', message: '保存失败，请重试' });
    }
  }, [capturedImage]);

  const handleShare = useCallback(async () => {
    const urlsToShare = selectedImages.size > 0 
      ? Array.from(selectedImages).map(index => watermarkedImagesList[index]).filter(Boolean)
      : [watermarkedImagesList[currentPreviewIndex]].filter(Boolean);
    
    if (urlsToShare.length === 0) return;
    
    try {
      if (urlsToShare.length === 1) {
        await Share.open({ url: urlsToShare[0], type: 'image/png', failOnCancel: false });
      } else {
        await Share.open({ urls: urlsToShare, type: 'image/png', failOnCancel: false });
      }
    } catch (err: any) {
      const msg = String(err?.message || '').trim();
      if (msg && /User did not share|cancel/i.test(msg)) return;
      overlay.alert({ title: '提示', message: '分享失败，请重试' });
    }
  }, [watermarkedImagesList, currentPreviewIndex, selectedImages]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setWatermarkAlpha(0.3);
    setWatermarkConfig((prev) => ({
      ...prev,
      antiFakeCode: generateAntiFakeCode(),
    }));
  }, []);

  const handleThumbnailPress = useCallback(() => {
    if (thumbnailUri) {
      setShowPreviewModal(true);
    } else {
      pickFromGallery();
    }
  }, [thumbnailUri]);

  const toggleCameraType = useCallback(() => {
    setType((current) =>
      current === RNCamera.Constants.Type.back ? RNCamera.Constants.Type.front : RNCamera.Constants.Type.back
    );
  }, []);

  const handleLogoConfirm = (logoUri: string | null) => {
    setWatermarkConfig((prev) => ({ ...prev, userLogo: logoUri }));
  };

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>正在请求权限...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>相机权限被拒绝</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>重新请求权限</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.goBack()}>
              <Icon name="chevronLeft" size={28} color={DayColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>水印相机</Text>
            <TouchableOpacity style={styles.headerRight} onPress={() => setShowLogoModal(true)}>
              <Text style={styles.logoButtonText}>Logo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerFlipButton} onPress={toggleCameraType}>
              <Icon name="switchCamera" size={24} color={DayColors.text} />
            </TouchableOpacity>
          </View>
        </View>

      <View style={styles.cameraContainer}>
        {capturedImage ? (
          <ViewShot ref={captureShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.previewContainer}>
            <Image 
              source={{ uri: capturedImage }} 
              style={styles.previewImage} 
              resizeMode="cover"
            />
            <View style={styles.watermarkLayer}>
              <TopRightWatermark config={watermarkConfig} alpha={1} />
              <BottomSection config={watermarkConfig} alpha={1} />
            </View>
          </ViewShot>
        ) : (
          <RNCamera ref={cameraRef} style={styles.camera} type={type} captureAudio={false}>
            <View style={styles.watermarkLayer}>
              <TopRightWatermark config={watermarkConfig} alpha={watermarkAlpha} />
              <BottomSection config={watermarkConfig} alpha={watermarkAlpha} />
            </View>
          </RNCamera>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.captureControls}>
          <TouchableOpacity style={styles.sideButton} onPress={handleThumbnailPress}>
            <View style={styles.iconWithBadge}>
              <Icon name="image" size={22} color={DayColors.text} />
              {photoCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{photoCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.sideButtonLabel}>相册</Text>
          </TouchableOpacity>
          {capturedImage ? (
            <TouchableOpacity style={styles.retakeButton} onPress={retake}>
              <View style={styles.retakeButtonInner}>
                <Text style={styles.retakeButtonText}>再拍</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <CaptureButton onPress={takePicture} disabled={isCapturing} loading={isCapturing} />
          )}
          <SideButton
            iconName="droplets"
            label="水印"
            onPress={() => setShowEditModal(true)}
          />
        </View>
      </View>

      <WatermarkEditModal
        visible={showEditModal}
        config={watermarkConfig}
        onClose={() => setShowEditModal(false)}
        onSave={(config) => {
          setWatermarkConfig(config);
          saveWatermarkConfig(config);
        }}
      />

      <LogoUploadModal
        visible={showLogoModal}
        currentLogo={watermarkConfig.userLogo}
        onClose={() => setShowLogoModal(false)}
        onConfirm={handleLogoConfirm}
      />

      {/* 照片预览模态框 */}
      <Modal
        visible={showPreviewModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewModalContainer}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
              <Icon name="chevronLeft" size={28} color={DayColors.text} />
            </TouchableOpacity>
            <Text style={styles.previewModalTitle}>照片预览 ({currentPreviewIndex + 1}/{photoCount})</Text>
            <TouchableOpacity onPress={handleShare}>
              <Image source={SHARE_ICON} style={{ width: 24, height: 24, tintColor: DayColors.text }} />
            </TouchableOpacity>
          </View>
          <View style={styles.previewModalImageContainer}>
            {watermarkedImagesList.length > 0 ? (
              <>
                <ScrollView
                  ref={(ref) => { this.scrollView = ref; }}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                    setCurrentPreviewIndex(index);
                  }}
                  contentContainerStyle={styles.previewScrollContent}
                >
                  {watermarkedImagesList.map((uri, index) => (
                    <View key={index} style={styles.previewPage}>
                      <View style={styles.previewImageWrapper}>
                        <TouchableOpacity 
                          style={[
                            styles.previewSelectCircle,
                            selectedImages.has(index) && styles.previewSelectCircleActive
                          ]}
                          onPress={() => {
                            const newSelected = new Set(selectedImages);
                            if (newSelected.has(index)) {
                              newSelected.delete(index);
                            } else {
                              newSelected.add(index);
                            }
                            setSelectedImages(newSelected);
                          }}
                        >
                          {selectedImages.has(index) && <Icon name="check" size={14} color="#FFFFFF" />}
                        </TouchableOpacity>
                        <Image source={{ uri }} style={styles.previewModalImage} resizeMode="contain" />
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {/* 底部缩略图区域 */}
                <View style={styles.thumbnailContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbnailScrollContent}
                  >
                    {watermarkedImagesList.map((uri, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={[
                          styles.thumbnailItem,
                          currentPreviewIndex === index && styles.thumbnailItemActive
                        ]}
                        onPress={() => {
                          this.scrollView?.scrollTo({ x: index * width, animated: true });
                          setCurrentPreviewIndex(index);
                        }}
                      >
                        <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                        <TouchableOpacity 
                          style={[
                            styles.thumbnailSelectCircle,
                            selectedImages.has(index) && styles.thumbnailSelectCircleActive
                          ]}
                          onPress={() => {
                            const newSelected = new Set(selectedImages);
                            if (newSelected.has(index)) {
                              newSelected.delete(index);
                            } else {
                              newSelected.add(index);
                            }
                            setSelectedImages(newSelected);
                          }}
                        >
                          {selectedImages.has(index) && <Icon name="check" size={10} color="#FFFFFF" />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            ) : capturedImage ? (
              <Image source={{ uri: capturedImage }} style={styles.previewModalImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: FontSize.lg,
    color: '#333333',
  },
  permissionButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.md,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
    backgroundColor: DayColors.surface,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    position: 'absolute',
    left: 0,
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TextStyles.title,
    color: DayColors.text,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerFlipButton: {
    position: 'absolute',
    right: 0,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoButtonText: {
    fontSize: FontSize.base,
    color: DayColors.text,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  watermarkLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  topRightWatermark: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  topRightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  topRightTitleLine: {
    height: 1.5,
    width: '100%',
    marginTop: 2,
    borderRadius: 0.5,
  },
  topRightTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  topRightWeather: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  topRightWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  topRightWeatherEmoji: {
    fontSize: 24,
    marginRight: 4,
  },
  topRightCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  topRightCountBox: {
    fontSize: 12,
    marginRight: 4,
  },
  topRightCountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 4,
  },
  topRightCountUnit: {
    fontSize: 12,
    color: '#666666',
  },
  topRightDate: {
    fontSize: 12,
    color: '#666666',
  },
  topRightCoords: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
  },
  bottomSection: {
    justifyContent: 'flex-end',
  },
  colorLineContainer: {
    flexDirection: 'column',
    gap: 2,
    width: '100%',
  },
  colorLineThick: {
    height: 6,
    width: '100%',
    borderRadius: 2,
  },
  colorLineThin: {
    height: 1,
    width: '100%',
    borderRadius: 0.5,
  },
  colorLineSingle: {
    height: 6,
    width: '100%',
    borderRadius: 2,
  },
  colorLineEnvelopeContainer: {
    height: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  colorLineEnvelopeStripe: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 12,
    transform: [{ rotate: '45deg' }],
  },
  bottomWatermark: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bottomWatermarkContent: {},
  bottomWatermarkColumns: {
    flexDirection: 'row',
    gap: 16,
  },
  bottomWatermarkColumn: {
    flex: 1,
  },
  bottomWatermarkRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bottomWatermarkLabel: {
    fontSize: 10,
    color: '#666666',
    width: 50,
  },
  bottomWatermarkValue: {
    fontSize: 11,
    color: '#333333',
    flex: 1,
  },
  bottomWatermarkValueLocation: {
    fontSize: 11,
    color: '#333333',
    flex: 1,
  },
  bottomOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 10,
    paddingBottom: 8,
  },
  bottomOverlaySpacer: {
    flex: 1,
  },
  bottomLogoContainer: {
    alignItems: 'center',
  },
  bottomLogo: {
    width: 50,
    height: 50,
  },
  bottomLogoText: {
    fontSize: 10,
    color: '#333333',
    marginTop: 2,
  },
  bottomAdContainer: {
    alignItems: 'flex-end',
  },
  bottomAdLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bottomAdLogoImage: {
    width: 18,
    height: 18,
  },
  bottomAdLogoText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  bottomAdAntiFake: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  bottomBar: {
    backgroundColor: DayColors.surface,
    borderTopWidth: 1,
    borderTopColor: DayColors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  captureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  iconWithBadge: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  sideButtonLabel: {
    fontSize: 11,
    color: DayColors.textSecondary,
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B20000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(178, 0, 0, 0.3)',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInnerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B20000',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  retakeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B20000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(178, 0, 0, 0.3)',
  },
  retakeButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B20000',
  },
  capturedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#333333',
    borderRadius: 24,
  },
  actionButtonPrimary: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  modalOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalOverlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentWrapper: {
    zIndex: 11,
  },
  secondLevelModalOverlay: {
    zIndex: 20,
  },
  secondLevelModalContent: {
    zIndex: 21,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  logoModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#EF4444',
  },
  tabText: {
    fontSize: FontSize.base,
    color: '#666666',
  },
  tabTextActive: {
    color: '#EF4444',
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: '#333333',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  editSection: {
    marginBottom: 20,
  },
  editSectionTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  editLabel: {
    fontSize: FontSize.sm,
    color: '#666666',
    width: 80,
  },
  editSubLabel: {
    fontSize: FontSize.sm,
    color: '#666666',
    marginTop: 8,
    marginBottom: 8,
  },
  editInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    color: '#333333',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: FontSize.sm,
    color: '#333333',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginRight: 8,
  },
  radioCircleActive: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  radioText: {
    fontSize: FontSize.sm,
    color: '#333333',
  },
  countInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  countInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  countInputHidden: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  countInputWithUnit: {
    flex: 1,
    height: 34,
    paddingHorizontal: 8,
    fontSize: FontSize.sm,
    color: '#333333',
  },
  countUnitInnerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5E5',
  },
  countUnitHidden: {
    opacity: 0,
  },
  countUnitInnerText: {
    fontSize: FontSize.sm,
    color: '#666666',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabelInput: {
    width: 80,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: FontSize.sm,
    color: '#333333',
    marginLeft: 8,
  },
  fieldValueInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: FontSize.sm,
    color: '#333333',
    marginLeft: 8,
  },
  fieldInputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999999',
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: '#333333',
    borderWidth: 2.5,
  },
  lineStyleRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  lineStyleItem: {
    alignItems: 'center',
    flex: 1,
  },
  lineStyleItemActive: {
    opacity: 1,
  },
  lineStylePreview: {
    width: '100%',
    height: 32,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    marginBottom: 4,
  },
  lineDoublePreview: {
    flexDirection: 'column',
    gap: 2,
    width: '80%',
  },
  lineThickBar: {
    height: 3,
    borderRadius: 1,
  },
  lineThinBar: {
    height: 1,
    borderRadius: 0.5,
  },
  lineSingleThick: {
    height: 6,
    width: '80%',
    borderRadius: 2,
  },
  lineEnvelopePreview: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  lineEnvelopeDash: {
    position: 'absolute',
    top: 8,
    width: 4,
    height: 12,
    transform: [{ rotate: '45deg' }],
  },
  lineStyleLabel: {
    fontSize: FontSize.xs,
    color: '#666666',
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  modalCancelButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  modalCancelText: {
    fontSize: FontSize.base,
    color: '#666666',
  },
  modalSaveButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  modalSaveText: {
    fontSize: FontSize.base,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logoModalBody: {
    padding: 24,
    alignItems: 'center',
  },
  logoUploadArea: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoPreview: {
    width: 180,
    height: 180,
    borderRadius: 8,
  },
  logoUploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoUploadText: {
    fontSize: FontSize.sm,
    color: '#999999',
    marginTop: 8,
  },
  logoHint: {
    fontSize: FontSize.xs,
    color: '#999999',
  },
  unitPickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  unitPickerBody: {
    padding: 16,
    maxHeight: 400,
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  unitOptionActive: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  unitOptionText: {
    fontSize: FontSize.base,
    color: '#333333',
  },
  unitOptionTextActive: {
    color: '#EF4444',
    fontWeight: '600',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DayColors.border,
    backgroundColor: DayColors.surface,
  },
  previewModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: '#333333',
  },
  previewModalImageContainer: {
    flex: 1,
    position: 'relative',
  },
  previewScrollContent: {
    flexGrow: 1,
  },
  previewPage: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  previewImageWrapper: {
    width: width - 32,
    flex: 1,
    position: 'relative',
  },
  previewModalImage: {
    width: '100%',
    height: '100%',
  },
  previewSelectCircle: {
    position: 'absolute',
    top: 32,
    left: 16,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  previewSelectCircleActive: {
    backgroundColor: '#EF4444',
  },
  previewCircleInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewCircleSelected: {
    backgroundColor: '#EF4444',
  },
  thumbnailContainer: {
    height: 100,
    backgroundColor: '#000000',
    paddingVertical: 8,
  },
  thumbnailScrollContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  thumbnailItem: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailItemActive: {
    borderColor: '#EF4444',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailSelectCircle: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  thumbnailSelectCircleActive: {
    backgroundColor: '#EF4444',
  },
  thumbnailCircleInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailCircleSelected: {
    backgroundColor: '#EF4444',
  },
});

export default WatermarkCameraRNScreen;
