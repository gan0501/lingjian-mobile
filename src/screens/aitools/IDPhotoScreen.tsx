import React, { FC, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Platform,
  PanResponder,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'react-native-image-picker';
import { API_CONFIG } from '@/constants';
import { useAuthStore } from '@/stores';
import { useAIToolGuard } from '@/hooks';
import { Loading } from '@/components/common/Loading';
import type { RootStackScreenProps } from '@/navigation/types';
import { Save, X, ChevronLeft, RotateCcw, Camera as CameraIcon, ImageIcon } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = RootStackScreenProps<'IDPhoto'>;

// ── 照片墙尺寸配置 ──
interface PhotoSizeItem {
  id: string;
  name: string;
  subtitle: string;
  sizeKey: string;
  color: string;
  emoji: string;
}

// 尺寸配置（毫米和像素）
interface SizeConfig {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

const SIZE_CONFIGS: Record<string, SizeConfig> = {
  one_inch: { widthMm: 25, heightMm: 35, widthPx: 295, heightPx: 413 },
  two_inch: { widthMm: 35, heightMm: 49, widthPx: 413, heightPx: 579 },
  portrait: { widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  id_card: { widthMm: 26, heightMm: 32, widthPx: 358, heightPx: 441 },
  driver_license: { widthMm: 22, heightMm: 32, widthPx: 260, heightPx: 378 },
  social_security: { widthMm: 26, heightMm: 32, widthPx: 358, heightPx: 441 },
  passport: { widthMm: 33, heightMm: 48, widthPx: 390, heightPx: 567 },
  resume: { widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  exam: { widthMm: 25, heightMm: 35, widthPx: 295, heightPx: 413 },
};

const PHOTO_SIZES: PhotoSizeItem[] = [
  { id: '1', name: '一寸照', subtitle: '25×35mm', sizeKey: 'one_inch', color: '#438EDB', emoji: '🪪' },
  { id: '2', name: '二寸照', subtitle: '35×49mm', sizeKey: 'two_inch', color: '#E91E63', emoji: '📸' },
  { id: '3', name: '职业写真', subtitle: '35×45mm', sizeKey: 'portrait', color: '#9C27B0', emoji: '💼' },
  { id: '4', name: '身份证', subtitle: '26×32mm', sizeKey: 'id_card', color: '#FF5722', emoji: '🆔' },
  { id: '5', name: '驾驶证', subtitle: '22×32mm', sizeKey: 'driver_license', color: '#4CAF50', emoji: '🚗' },
  { id: '6', name: '社保卡', subtitle: '26×32mm', sizeKey: 'social_security', color: '#00BCD4', emoji: '🏥' },
  { id: '7', name: '护照', subtitle: '33×48mm', sizeKey: 'passport', color: '#3F51B5', emoji: '✈️' },
  { id: '8', name: '简历', subtitle: '35×45mm', sizeKey: 'resume', color: '#FF9800', emoji: '📝' },
  { id: '9', name: '考试报名', subtitle: '25×35mm', sizeKey: 'exam', color: '#795548', emoji: '📋' },
];

// 照片墙散乱布局预设 — 紧凑、不可滚动
const WALL_LAYOUT = [
  // Row 1: 3 cards, staggered
  { left: 12, top: 0, rotation: -6, scale: 1.0 },
  { left: SCREEN_WIDTH * 0.33, top: 15, rotation: 3, scale: 0.95 },
  { left: SCREEN_WIDTH * 0.64, top: -5, rotation: -4, scale: 1.02 },
  // Row 2: 3 cards
  { left: 24, top: 0, rotation: 5, scale: 0.98 },
  { left: SCREEN_WIDTH * 0.35, top: 10, rotation: -7, scale: 1.0 },
  { left: SCREEN_WIDTH * 0.62, top: -8, rotation: 4, scale: 0.96 },
  // Row 3: 3 cards
  { left: 8, top: 5, rotation: -3, scale: 1.0 },
  { left: SCREEN_WIDTH * 0.30, top: -5, rotation: 6, scale: 0.97 },
  { left: SCREEN_WIDTH * 0.60, top: 12, rotation: -5, scale: 1.01 },
];

const CARD_W = (SCREEN_WIDTH - 64) / 3;
const CARD_H = CARD_W * 1.35;
const ROW_H = CARD_H + 12;

// 背景色配置
const BACKGROUND_COLORS = [
  { key: 'blue', name: '蓝色', color: '#438EDB', gradient: ['#438EDB', '#2E5A8C'] as [string, string] },
  { key: 'white', name: '白色', color: '#FFFFFF', gradient: ['#FFFFFF', '#F0F0F0'] as [string, string] },
  { key: 'red', name: '红色', color: '#FF0000', gradient: ['#FF0000', '#CC0000'] as [string, string] },
  { key: 'blue_grad', name: '蓝渐变', color: '#5B9BD5', gradient: ['#87CEEB', '#2E5A8C'] as [string, string] },
  { key: 'gray_grad', name: '灰渐变', color: '#808080', gradient: ['#A0A0A0', '#404040'] as [string, string] },
];

const IDPhotoScreen: FC<Props> = ({ navigation }) => {
  const guard = useAIToolGuard('id_photo');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    guard().then((result) => {
      if (!result) navigation.goBack();
      setAllowed(result);
    }).catch(() => {
      navigation.goBack();
      setAllowed(false);
    });
  }, [guard]);

  const { token } = useAuthStore();

  // 状态
  const [selectedSize, setSelectedSize] = useState<PhotoSizeItem | null>(null);
  const selectedSizeRef = useRef<PhotoSizeItem | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const originalImageRef = useRef<string | null>(null);
  // 5张不同背景色的证件照
  const [processedImages, setProcessedImages] = useState<string[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const currentCardIndexRef = useRef(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 卡片滑动动画
  const animatedIndex = useRef(new Animated.Value(0)).current;

  // 滑动手势控制
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: any, gs: any) => Math.abs(gs.dx) > 10,
      onPanResponderGrant: () => {
        animatedIndex.stopAnimation();
      },
      onPanResponderMove: (_: any, gs: any) => {
        const curIdx = currentCardIndexRef.current;
        // 拖拽比例控制
        animatedIndex.setValue(Math.max(-0.5, Math.min(BACKGROUND_COLORS.length - 0.5, curIdx - gs.dx / 150)));
      },
      onPanResponderRelease: (_: any, gs: any) => {
        const curIdx = currentCardIndexRef.current;
        let targetIdx = curIdx;
        
        // 判定滑动阈值
        if (gs.dx < -40 && curIdx < BACKGROUND_COLORS.length - 1) {
          targetIdx = curIdx + 1;
        } else if (gs.dx > 40 && curIdx > 0) {
          targetIdx = curIdx - 1;
        }
        
        setCurrentCardIndex(targetIdx);
        currentCardIndexRef.current = targetIdx;
        
        Animated.spring(animatedIndex, {
          toValue: targetIdx,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // 如果从外部（如点击/归位）改变了 index，执行动画跟随
  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: currentCardIndex,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [currentCardIndex, animatedIndex]);

  // 照片墙动画
  const photoAnimations = useRef(
    PHOTO_SIZES.map(() => ({
      scale: new Animated.Value(1),
    }))
  ).current;

  // ── 请求相机权限 ──
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: '相机权限',
          message: '需要使用相机拍摄证件照',
          buttonPositive: '允许',
          buttonNegative: '取消',
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          '权限被拒绝',
          '相机权限已被永久拒绝，请在系统设置中手动开启',
          [
            { text: '取消', style: 'cancel' },
            { text: '去设置', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return false;
    } catch {
      return false;
    }
  };

  // ── 拍照/选图 ──
  const launchCamera = async () => {
    const sizeItem = selectedSize;
    if (!sizeItem) return;

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setSelectedSize(null);
      return;
    }

    setShowGuide(false);
    ImagePicker.launchCamera(
      { mediaType: 'photo', quality: 1, includeBase64: true },
      (response) => {
        if (response.didCancel) { setSelectedSize(null); return; }
        if (response.errorCode) {
          Alert.alert('错误', response.errorMessage || '拍照失败');
          setSelectedSize(null);
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.base64) {
          const imageUri = `data:image/jpeg;base64,${asset.base64}`;
          setOriginalImage(imageUri);
          originalImageRef.current = imageUri;
          processAllPhotos(imageUri, sizeItem);
        }
      }
    );
  };

  const launchAlbum = () => {
    const sizeItem = selectedSize;
    if (!sizeItem) return;
    setShowGuide(false);
    ImagePicker.launchImageLibrary(
      { mediaType: 'photo', quality: 1, includeBase64: true },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('错误', response.errorMessage || '选择图片失败');
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.base64) {
          const imageUri = `data:image/jpeg;base64,${asset.base64}`;
          setOriginalImage(imageUri);
          originalImageRef.current = imageUri;
          processAllPhotos(imageUri, sizeItem);
        }
      }
    );
  };

  // 点击尺寸卡片 → 显示拍照引导页
  const handleSizePress = (item: PhotoSizeItem, index: number) => {
    setSelectedSize(item);
    selectedSizeRef.current = item;
    Animated.sequence([
      Animated.timing(photoAnimations[index].scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(photoAnimations[index].scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setShowGuide(true);
    });
  };

  // ── 一次性生成5张不同背景色的照片 ──
  const processAllPhotos = async (imageUri: string, sizeItem: PhotoSizeItem) => {
    setIsProcessing(true);
    try {
      const base64Data = imageUri.split(',')[1];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      // 并行请求5种背景色
      const promises = BACKGROUND_COLORS.map(bg =>
        fetch(`${API_CONFIG.BASE_URL}/api/idphoto/process/base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            image_base64: base64Data,
            size_key: sizeItem.sizeKey,
            background_key: bg.key,
            beauty_level: 0,
            dpi: 300,
          }),
          signal: controller.signal,
        }).then(r => r.json())
      );

      const results = await Promise.all(promises);
      clearTimeout(timeoutId);

      const images: string[] = [];
      for (const result of results) {
        if (result.success && result.data?.image_base64) {
          images.push(`data:image/png;base64,${result.data.image_base64}`);
        }
      }

      if (images.length > 0) {
        setProcessedImages(images);
        setCurrentCardIndex(0);
        currentCardIndexRef.current = 0;
        setShowEditor(true);
      } else {
        Alert.alert('处理失败', '请稍后重试');
      }
    } catch (error) {
      console.error('Process error:', error);
      Alert.alert('处理失败', '网络连接异常，请稍后重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── 保存当前选中的照片到相册 ──
  const saveToAlbum = async () => {
    const imageToSave = processedImages[currentCardIndex];
    if (!imageToSave) return;

    setIsSaving(true);
    try {
      const base64Data = imageToSave.split(',')[1];
      const tempFilePath = `${RNFS.TemporaryDirectoryPath}/idphoto_${Date.now()}.png`;
      await RNFS.writeFile(tempFilePath, base64Data, 'base64');
      await CameraRoll.saveAsset(tempFilePath, { type: 'photo' });
      await RNFS.unlink(tempFilePath);
      Alert.alert('保存成功', `${BACKGROUND_COLORS[currentCardIndex]?.name || ''}证件照已保存到相册`);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('保存失败', '请检查相册权限后重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 关闭编辑器
  const closeEditor = () => {
    setShowEditor(false);
    setProcessedImages([]);
    setOriginalImage(null);
    setSelectedSize(null);
    setCurrentCardIndex(0);
  };

  // ── 照片墙 ──
  const renderPhotoWall = () => (
    <View style={styles.photoWallContainer}>
      <Text style={styles.photoWallTitle}>选择证件照尺寸</Text>
      <Text style={styles.photoWallSubtitle}>点击卡片开始拍摄</Text>

      <View style={[styles.photoWall, { height: ROW_H * 3 + 20 }]}>
        {PHOTO_SIZES.map((item, index) => {
          const layout = WALL_LAYOUT[index];
          const row = Math.floor(index / 3);
          const top = row * ROW_H + (layout?.top || 0);

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.photoCard,
                {
                  left: layout?.left || 0,
                  top,
                  width: CARD_W,
                  height: CARD_H,
                  transform: [
                    { rotate: `${layout?.rotation || 0}deg` },
                    { scale: Animated.multiply(
                      photoAnimations[index].scale,
                      new Animated.Value(layout?.scale || 1)
                    ) },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.photoCardTouch}
                onPress={() => handleSizePress(item, index)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[item.color, adjustColor(item.color, -40)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.photoCardGradient}
                >
                  <Text style={styles.photoCardEmoji}>{item.emoji}</Text>
                  <Text style={styles.photoCardName}>{item.name}</Text>
                  <Text style={styles.photoCardSize}>{item.subtitle}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );

  // ── 编辑器 ──
  // 网格背景组件
  const GridBackground = () => {
    const gridSize = 20;
    const lines = [];
    const numLines = Math.ceil(SCREEN_WIDTH / gridSize);

    for (let i = 0; i <= numLines; i++) {
      lines.push(
        <View
          key={`v-${i}`}
          style={{
            position: 'absolute',
            left: i * gridSize,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(180, 180, 190, 0.3)',
          }}
        />
      );
    }

    for (let i = 0; i <= 50; i++) {
      lines.push(
        <View
          key={`h-${i}`}
          style={{
            position: 'absolute',
            top: i * gridSize,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(180, 180, 190, 0.3)',
          }}
        />
      );
    }

    return <View style={styles.gridBackground} pointerEvents="none">{lines}</View>;
  };

  const renderEditor = () => {
    // 将多背景色卡片整体缩小10%：由 0.58 降为 0.48
    const CARD_W = SCREEN_WIDTH * 0.48;
    const CARD_H = CARD_W * 1.35;

    // 解析尺寸并计算像素值
    const subtitle = selectedSize?.subtitle || '25×35mm';
    const [wMmStr, hMmStr] = subtitle.replace('mm', '').split('×');
    const wMm = parseInt(wMmStr) || 25;
    const hMm = parseInt(hMmStr) || 35;
    const pxW = Math.round((wMm / 25.4) * 300);
    const pxH = Math.round((hMm / 25.4) * 300);

    return (
      <View style={[styles.editorContainer, { paddingTop: insets.top }]}>
        <GridBackground />
        {/* 顶部栏 */}
        <View style={styles.editorTopBar}>
          <TouchableOpacity style={styles.editorCircleBtn} onPress={closeEditor}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.editorTitle}>{selectedSize?.name || '证件照'}</Text>
          <TouchableOpacity style={styles.editorCircleBtn} onPress={() => {
            setProcessedImages([]);
            launchCamera();
          }}>
            <RotateCcw size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* 堆叠卡片预览区 — 可滑动 */}
        <View style={styles.previewArea} {...panResponder.panHandlers}>
          {processedImages.map((img, idx) => {
            const inputRange = [idx - 2, idx - 1, idx, idx + 1, idx + 2];
            
            // 使用内插值保证顺滑过渡
            const translateX = animatedIndex.interpolate({
              inputRange,
              outputRange: [36, 18, 0, -18, -36],
              extrapolate: 'clamp'
            });
            const translateY = animatedIndex.interpolate({
              inputRange,
              outputRange: [16, 8, 0, 8, 16],
              extrapolate: 'clamp'
            });
            const scaleVal = animatedIndex.interpolate({
              inputRange,
              outputRange: [0.85, 0.92, 1, 0.92, 0.85],
              extrapolate: 'clamp'
            });
            const rotation = animatedIndex.interpolate({
              inputRange,
              outputRange: ['8deg', '4deg', '0deg', '-4deg', '-8deg'],
              extrapolate: 'clamp'
            });
            const opacityVal = animatedIndex.interpolate({
              inputRange,
              outputRange: [0.6, 0.8, 1, 0.8, 0.6],
              extrapolate: 'clamp'
            });

            // Android 下依靠 zIndex，选中的靠前
            const zIdx = 10 - Math.abs(currentCardIndex - idx);

            return (
              <Animated.View
                key={BACKGROUND_COLORS[idx]?.key || idx}
                style={[
                  styles.stackCard,
                  {
                    width: CARD_W,
                    height: CARD_H,
                    zIndex: zIdx,
                    elevation: zIdx,
                    transform: [
                      { translateX },
                      { translateY },
                      { scale: scaleVal },
                      { rotate: rotation },
                    ],
                    opacity: opacityVal,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.95}
                  style={{ width: '100%', height: '100%' }}
                  onPress={() => {
                    setCurrentCardIndex(idx);
                    currentCardIndexRef.current = idx;
                  }}
                >
                  <Image
                    source={{ uri: img }}
                    style={styles.stackCardImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* 底部预览比对与信息区 */}
        <View style={styles.previewCompareArea}>
          <View style={styles.previewCompareRow}>
            {/* 左侧：原图 */}
            <View style={styles.previewCompareItem}>
              <Image source={{ uri: originalImage || '' }} style={styles.previewCompareImage} />
              <Text style={styles.previewCompareLabel}>原照片</Text>
            </View>

            {/* 右侧：8宫格排版照片 */}
            <View style={styles.previewCompareItem}>
              <View style={styles.previewCompareGrid}>
                {Array(8).fill(processedImages[currentCardIndex]).map((imgUri, idx) => (
                  <Image key={(imgUri || 'img') + idx} source={{ uri: imgUri || '' }} style={styles.previewCompareGridImg} />
                ))}
              </View>
              <Text style={styles.previewCompareLabel}>排版照片</Text>
            </View>
          </View>

          {/* 规格文字信息 - 总是居中 */}
          <View style={styles.previewTextInfo}>
            <Text style={styles.previewTextLine}>
              规格：{selectedSize?.name || '一寸照'} | {BACKGROUND_COLORS[currentCardIndex]?.name || ''}
            </Text>
            <Text style={styles.previewTextLine}>
              尺寸：{subtitle} | {pxW}*{pxH}像素
            </Text>
          </View>
        </View>

        {/* 底部按钮区 */}
        <View style={[styles.editorBottom, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>

          {/* 保存按钮 — 纯红背景 + 纯白外圈 */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveToAlbum}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <View style={styles.saveButtonInner}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>保存到相册</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── 带尺寸标注的人像框组件 ──
  const PhotoFrameWithLabels = () => {
    const sizeConfig = selectedSize ? SIZE_CONFIGS[selectedSize.sizeKey] : SIZE_CONFIGS.one_inch;
    if (!sizeConfig) return null;

    const { widthMm, heightMm, widthPx, heightPx } = sizeConfig;
    const aspectRatio = widthMm / heightMm;

    // 计算容器内最大显示尺寸
    const maxContainerWidth = SCREEN_WIDTH * 0.6;
    const maxContainerHeight = 280;

    let frameWidth = maxContainerWidth;
    let frameHeight = frameWidth / aspectRatio;

    if (frameHeight > maxContainerHeight) {
      frameHeight = maxContainerHeight;
      frameWidth = frameHeight * aspectRatio;
    }

    return (
      <View style={[styles.photoFrameContainer, { width: frameWidth + 80, height: frameHeight + 80 }]}>
        {/* 左侧毫米标注 */}
        <View style={[styles.dimensionLabelLeft, { height: frameHeight }]}>
          <View style={styles.dimensionLineVertical} />
          <Text style={[styles.dimensionText, styles.dimensionTextVertical]}>{heightMm}毫米</Text>
          <View style={styles.dimensionLineVertical} />
        </View>

        {/* 中间区域：顶部标注 + 相框 + 底部标注 */}
        <View style={styles.frameCenterColumn}>
          {/* 顶部像素标注 */}
          <View style={[styles.dimensionLabelTop, { width: frameWidth }]}>
            <View style={styles.dimensionLine} />
            <Text style={styles.dimensionText}>{widthPx}像素</Text>
            <View style={styles.dimensionLine} />
          </View>

          {/* 主框架 */}
          <View style={[styles.photoFrame, { width: frameWidth, height: frameHeight }]}>
            {/* 内部人像图片 */}
            <Image
              source={require('@/assets/images/zhengjianzhao.jpg')}
              style={styles.portraitImage}
              resizeMode="contain"
            />

            {/* 四角标记 */}
            <View style={[styles.frameCorner, { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.frameCorner, { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 }]} />
            <View style={[styles.frameCorner, { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.frameCorner, { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 }]} />
          </View>

          {/* 底部毫米标注 */}
          <View style={[styles.dimensionLabelBottom, { width: frameWidth }]}>
            <View style={styles.dimensionLine} />
            <Text style={styles.dimensionText}>{widthMm}毫米</Text>
            <View style={styles.dimensionLine} />
          </View>
        </View>

        {/* 右侧像素标注 */}
        <View style={[styles.dimensionLabelRight, { height: frameHeight }]}>
          <View style={styles.dimensionLineVertical} />
          <Text style={[styles.dimensionText, styles.dimensionTextVertical]}>{heightPx}像素</Text>
          <View style={styles.dimensionLineVertical} />
        </View>
      </View>
    );
  };

  // ── 拍照引导页 ──
  const renderGuide = () => (
    <View style={[styles.guideOverlay, { paddingTop: insets.top }]}>
      {/* 关闭按钮 */}
      <TouchableOpacity
        style={styles.guideCloseBtn}
        onPress={() => { setShowGuide(false); setSelectedSize(null); }}
      >
        <X size={22} color="#fff" />
      </TouchableOpacity>

      {/* 标题区域 */}
      <View style={styles.guideHeader}>
        <Text style={styles.guideTitle}>{selectedSize?.name || '证件照'}</Text>
      </View>

      {/* 中间内容区域 - 带标注的人像框 */}
      <View style={styles.guideCenterArea}>
        <PhotoFrameWithLabels />
      </View>

      {/* 底部区域 - 拍照说明和按钮 */}
      <View style={styles.guideBottomArea}>
        {/* 拍照注意事项 */}
        <View style={styles.guideTipsContainer}>
          {[
            { icon: '👤', text: '正面免冠，表情自然' },
            { icon: '💡', text: '光线均匀，避免阴影' },
            { icon: '👔', text: '着深色有领上装' },
            { icon: '🚫', text: '勿戴帽子、墨镜等饰品' },
            { icon: '📐', text: '头部居中，肩部水平' },
          ].map((tip, i) => (
            <View key={i} style={styles.guideTipRow}>
              <Text style={styles.guideTipIcon}>{tip.icon}</Text>
              <Text style={styles.guideTipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* 底部按钮组 */}
        <View style={styles.guideButtonRow}>
          <TouchableOpacity style={styles.guideAlbumBtn} onPress={launchAlbum} activeOpacity={0.85}>
            <ImageIcon size={20} color="#fff" />
            <Text style={styles.guideAlbumBtnText}>相册</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guideShootBtn} onPress={launchCamera} activeOpacity={0.85}>
            <CameraIcon size={22} color="#fff" />
            <Text style={styles.guideShootBtnText}>开始拍照</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
      {!showEditor ? (
        <>
          {/* 顶部栏 */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}><ChevronLeft size={24} color="#fff" /></TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.topBarTitle}>智能证件照</Text>
            <View style={{ flex: 1 }} />
            <View style={{ width: 40 }} />
          </View>

          {renderPhotoWall()}
        </>
      ) : (
        renderEditor()
      )}

      {/* 拍照引导蒙版 */}
      {showGuide && renderGuide()}

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#B20000" />
            <Text style={styles.processingText}>AI 处理中...</Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );
};

// ── 工具函数：调整颜色深浅 ──
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  let g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  let b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },

  // ── 拍照引导页 ──
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 200,
    paddingHorizontal: 24,
  },
  guideCloseBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  guideHeader: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 20,
  },
  guideTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guideSizeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },
  // 中间人像区域
  guideCenterArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 20,
  },
  // 照片框容器（带标注）
  photoFrameContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  // 中间列（顶部标注+相框+底部标注）
  frameCenterColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 主照片框
  photoFrame: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  frameInner: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    opacity: 0.6,
  },
  frameHead: {
    width: 80,
    height: 100,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameFace: {
    width: 48,
    height: 56,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  frameNeck: {
    width: 28,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: -2,
  },
  frameShoulders: {
    width: 120,
    height: 40,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    borderBottomWidth: 0,
    marginTop: -2,
  },
  // 四角标记
  frameCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#B20000',
  },
  // 人像图片
  portraitImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  // 尺寸标注
  dimensionLabelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    marginBottom: 8,
  },
  dimensionLabelBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    marginTop: 8,
  },
  dimensionLabelLeft: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    marginRight: 8,
  },
  dimensionLabelRight: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    marginLeft: 8,
  },
  dimensionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 6,
  },
  dimensionLineVertical: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginVertical: 4,
  },
  dimensionText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  dimensionTextVertical: {
    writingDirection: 'rtl',
    transform: [{ rotate: '-90deg' }],
    width: 60,
    textAlign: 'center',
  },
  // 底部区域
  guideBottomArea: {
    paddingBottom: 40,
  },
  guideTipsContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  guideTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  guideTipIcon: {
    fontSize: 16,
    width: 28,
    textAlign: 'center',
  },
  guideTipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  guideShootBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B20000',
    paddingVertical: 16,
    borderRadius: 28,
    gap: 10,
  },
  guideShootBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guideButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  guideAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  guideAlbumBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // ── 顶部栏 ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── 照片墙 ──
  photoWallContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  photoWallTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 24,
  },
  photoWallSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  photoWall: {
    position: 'relative',
    marginTop: 20,
  },
  photoCard: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  photoCardTouch: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  photoCardEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  photoCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  photoCardSize: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },

  // ── 编辑器 ──
  editorContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  editorTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editorCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 预览区
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  previewImage: {
    width: SCREEN_WIDTH * 0.55,
    aspectRatio: 0.75,
    borderRadius: 4,
  },

  // ── 堆叠卡片 ──
  stackCard: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackCardImage: {
    width: '100%',
    height: '100%',
  },
  stackCardBadge: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  stackCardBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stackCardLoading: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },

  // ── 底部比对与描述区 ──
  previewCompareArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: 'center',
  },
  previewCompareRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 40,
    marginBottom: 20,
  },
  previewCompareItem: {
    alignItems: 'center',
    gap: 8,
  },
  previewCompareImage: {
    width: 50,
    height: 50 * 1.35, // 保持常用尺寸比例
    borderRadius: 4,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  // 排版8宫格（模拟在一张 3:2 相纸上排4x2）
  previewCompareGrid: {
    width: 90,
    height: 60,
    backgroundColor: '#FFFFFF',
    padding: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 2,
  },
  previewCompareGridImg: {
    width: '23%',
    height: '46%',
    margin: '1%',
    resizeMode: 'cover',
  },
  previewCompareLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  previewTextInfo: {
    alignItems: 'center',
    gap: 6,
  },
  previewTextLine: {
    fontSize: 13,
    color: '#E0E0E0',
    fontWeight: '500',
  },

  // ── 底部控制区（保存按钮） ──
  editorBottom: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  
  // 保存按钮（纯红 + 纯白外框）
  saveButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  saveButtonInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#B20000',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },


  // 处理中遮罩
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  processingText: {
    color: '#333',
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default IDPhotoScreen;
