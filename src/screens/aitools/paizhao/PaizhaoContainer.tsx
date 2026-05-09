import { Loading } from '@/components/common/Loading';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as CameraIcon, Image as ImageIcon, ChevronLeft, RotateCcw } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { launchImageLibrary } from 'react-native-image-picker';
import { DayColors } from '@/constants';
import { Spacing, BorderRadius } from '@/constants';
import { TextStyles, FontSize } from '@/constants';
import { useOverlay } from '@/components/overlay';
import { SemanticColors } from '@/constants/colors';
import { paizhaoApi } from './paizhaoApi';

let RNCamera: any = null;
let RNCameraConstants: any = {};
try {
  const camModule = require('react-native-camera');
  RNCamera = camModule.RNCamera;
  RNCameraConstants = camModule.RNCamera?.Constants || {};
} catch (e) {
  console.warn('react-native-camera not available');
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const APP_LOGO = require('../../../assets/images/icon-128x128.png');

interface DetectionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class?: string;
}

interface DetectionResult {
  count: number;
  confidence: number;
  boxes: DetectionBox[];
  model: string;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CROP_INITIAL_MARGIN = 0.08;
const HANDLE_SIZE = 28;
const CORNER_SIZE = 14;
const MIN_CROP_SIZE = 80;

// 裁剪覆盖层组件
const CropOverlay: React.FC<{
  imageWidth: number;
  imageHeight: number;
  onCropChange: (crop: CropRect) => void;
  disabled?: boolean;
}> = ({ imageWidth, imageHeight, onCropChange, disabled }) => {
  const getInitial = useCallback(() => {
    const minDimension = Math.min(imageWidth, imageHeight);
    const size = minDimension * (1 - 2 * CROP_INITIAL_MARGIN);
    const x = (imageWidth - size) / 2;
    const y = (imageHeight - size) / 2;
    return { x, y, width: size, height: size };
  }, [imageWidth, imageHeight]);

  const [cropRect, setCropRect] = useState<CropRect>(getInitial);

  useEffect(() => {
    onCropChange(cropRect);
  }, [cropRect, onCropChange]);

  const dragRef = useRef<{
    type: 'none' | 'move' | 'resize';
    startX: number;
    startY: number;
    startCrop: CropRect;
  }>({ type: 'none', startX: 0, startY: 0, startCrop: { x: 0, y: 0, width: 0, height: 0 } });

  const clampCrop = useCallback((crop: CropRect): CropRect => {
    const w = Math.max(MIN_CROP_SIZE, Math.min(crop.width, imageWidth));
    const h = Math.max(MIN_CROP_SIZE, Math.min(crop.height, imageHeight));
    const x = Math.max(0, Math.min(crop.x, imageWidth - w));
    const y = Math.max(0, Math.min(crop.y, imageHeight - h));
    return { x, y, width: w, height: h };
  }, [imageWidth, imageHeight]);

  const handleMoveTouchStart = useCallback((e: any) => {
    if (disabled) return;
    const touch = e.nativeEvent.touches[0] || e.nativeEvent;
    dragRef.current = {
      type: 'move',
      startX: touch.pageX,
      startY: touch.pageY,
      startCrop: { ...cropRect },
    };
  }, [cropRect]);

  const handleResizeTouchStart = useCallback((e: any) => {
    if (disabled) return;
    const touch = e.nativeEvent.touches[0] || e.nativeEvent;
    dragRef.current = {
      type: 'resize',
      startX: touch.pageX,
      startY: touch.pageY,
      startCrop: { ...cropRect },
    };
  }, [cropRect]);

  const handleTouchMove = useCallback((e: any) => {
    const drag = dragRef.current;
    if (drag.type === 'none') return;
    const touch = e.nativeEvent.touches[0] || e.nativeEvent;
    const dx = touch.pageX - drag.startX;
    const dy = touch.pageY - drag.startY;
    const sc = drag.startCrop;

    if (drag.type === 'move') {
      setCropRect(clampCrop({
        x: sc.x + dx,
        y: sc.y + dy,
        width: sc.width,
        height: sc.height,
      }));
    } else if (drag.type === 'resize') {
      setCropRect(clampCrop({
        x: sc.x,
        y: sc.y,
        width: sc.width + dx,
        height: sc.height + dy,
      }));
    }
  }, [clampCrop]);

  const handleTouchEnd = useCallback(() => {
    dragRef.current = { ...dragRef.current, type: 'none' };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 暗色遮罩 */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: cropRect.x, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x + cropRect.width, top: 0, width: imageWidth - cropRect.x - cropRect.width, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x, top: 0, width: cropRect.width, height: cropRect.y, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x, top: cropRect.y + cropRect.height, width: cropRect.width, height: imageHeight - cropRect.y - cropRect.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      
      {/* 可拖动的裁剪框 */}
      <View
        onTouchStart={handleMoveTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          position: 'absolute',
          left: cropRect.x,
          top: cropRect.y,
          width: cropRect.width,
          height: cropRect.height,
          borderWidth: 2,
          borderColor: SemanticColors.success,
          zIndex: 10,
        }}
        pointerEvents="box-only"
      />
      
      {/* 四个角装饰点 */}
      <View style={{ position: 'absolute', left: cropRect.x - CORNER_SIZE / 2, top: cropRect.y - CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE, backgroundColor: SemanticColors.success, borderRadius: CORNER_SIZE / 2, zIndex: 15 }} pointerEvents="none" />
      <View style={{ position: 'absolute', left: cropRect.x + cropRect.width - CORNER_SIZE / 2, top: cropRect.y - CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE, backgroundColor: SemanticColors.success, borderRadius: CORNER_SIZE / 2, zIndex: 15 }} pointerEvents="none" />
      <View style={{ position: 'absolute', left: cropRect.x - CORNER_SIZE / 2, top: cropRect.y + cropRect.height - CORNER_SIZE / 2, width: CORNER_SIZE, height: CORNER_SIZE, backgroundColor: SemanticColors.success, borderRadius: CORNER_SIZE / 2, zIndex: 15 }} pointerEvents="none" />
      
      {/* 右下角可拖动拉手 */}
      <View
        onTouchStart={handleResizeTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          position: 'absolute',
          left: cropRect.x + cropRect.width - HANDLE_SIZE / 2,
          top: cropRect.y + cropRect.height - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          backgroundColor: SemanticColors.success,
          borderRadius: HANDLE_SIZE / 2,
          borderWidth: 2,
          borderColor: '#fff',
          zIndex: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="box-only"
      >
        <Image source={require('../../../assets/images/move.png')} style={{ width: 16, height: 16, tintColor: '#fff' }} />
      </View>
    </View>
  );
};

const PaizhaoContainer: FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const overlay = useOverlay();

  // 页面状态: 'camera' | 'crop' | 'result'
  const [pageState, setPageState] = useState<'camera' | 'crop' | 'result'>('camera');
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropArea, setCropArea] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [targetShape, setTargetShape] = useState<'circle' | 'rect'>('circle');
  const [detectMethod, setDetectMethod] = useState<'cv' | 'yolo'>('yolo');

  const [previewLayout, setPreviewLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [shareMode, setShareMode] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [manualBoxes, setManualBoxes] = useState<DetectionBox[]>([]);
  const manualBoxesRef = useRef<DetectionBox[]>([]);

  const cameraRef = useRef<any>(null);
  const [cameraType, setCameraType] = useState(RNCameraConstants.Type?.back || 'back');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    manualBoxesRef.current = manualBoxes;
  }, [manualBoxes]);

  const detectedCount = manualBoxes.length;

  // 获取图片尺寸
  useEffect(() => {
    if (!selectedImage) {
      setImageSize(null);
      return;
    }

    Image.getSize(
      selectedImage,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT })
    );
  }, [selectedImage]);

  // 从相册选择图片
  const handleSelectImage = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: '存储权限',
            message: '需要访问相册来选择图片',
            buttonNeutral: '稍后',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('提示', '需要存储权限才能访问相册');
          return;
        }
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        includeBase64: false,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.uri) {
        setSelectedImage(asset.uri);
        setPageState('crop');
        setResult(null);
        setError(null);
        setManualBoxes([]);
        setEditMode(false);
      }
    } catch (err: any) {
      overlay.alert({ title: '错误', message: err.message || '选择图片失败' });
    }
  }, [overlay]);

  // 拍照
  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) {
      overlay.alert({ title: '错误', message: '相机未就绪' });
      return;
    }
    try {
      const options = { quality: 0.8, base64: false, doNotSave: false };
      const data = await cameraRef.current.takePictureAsync(options);
      if (data?.uri) {
        setSelectedImage(data.uri);
        setPageState('crop');
        setResult(null);
        setError(null);
        setManualBoxes([]);
        setEditMode(false);
        setShowInstructions(false);
      }
    } catch (err: any) {
      overlay.alert({ title: '错误', message: err.message || '拍照失败' });
    }
  }, [overlay]);

  // 重新拍摄
  const handleRetake = useCallback(() => {
    setSelectedImage(null);
    setPageState('camera');
    setResult(null);
    setError(null);
    setManualBoxes([]);
    setEditMode(false);
    setSaved(false);
  }, []);

  // 开始识别
  const handleDetect = useCallback(async () => {
    if (!selectedImage || detecting) return;

    setDetecting(true);
    setError(null);
    setEditMode(false);
    setSaved(false);

    try {
      let imageCropArea: { x: number; y: number; width: number; height: number } | null = null;

      if (imageSize && previewLayout.width > 0 && previewLayout.height > 0 && cropArea.width > 0 && cropArea.height > 0) {
        const iw = imageSize.width;
        const ih = imageSize.height;
        const cw = previewLayout.width;
        const ch = previewLayout.height;

        const scale = Math.max(cw / iw, ch / ih);
        const drawnW = iw * scale;
        const drawnH = ih * scale;
        const offsetX = (cw - drawnW) / 2;
        const offsetY = (ch - drawnH) / 2;

        const imgX = Math.max(0, (cropArea.x - offsetX) / scale);
        const imgY = Math.max(0, (cropArea.y - offsetY) / scale);
        const imgW = Math.min(cropArea.width / scale, iw - imgX);
        const imgH = Math.min(cropArea.height / scale, ih - imgY);

        if (imgW > 10 && imgH > 10) {
          imageCropArea = { x: imgX, y: imgY, width: imgW, height: imgH };
        }
      }

      console.log('[PaizhaoContainer] 开始识别:', { targetShape, detectMethod, cropArea, imageCropArea });
      const detectionResult = await paizhaoApi.detectPipes(selectedImage, targetShape, detectMethod, imageCropArea);
      console.log('[PaizhaoContainer] 识别结果:', JSON.stringify(detectionResult).substring(0, 500));
      setResult(detectionResult as any);
      
      if (detectionResult.boxes && detectionResult.boxes.length > 0) {
        const boxesWithId = detectionResult.boxes.map((box: any, index: number) => ({
          ...box,
          id: `detected-${index}-${Date.now()}`,
        }));
        setManualBoxes(boxesWithId);
      } else {
        console.warn('[PaizhaoContainer] 未检测到任何物体');
        setManualBoxes([]);
        overlay.alert({ title: '提示', message: `未检测到${targetShape === 'circle' ? '圆形' : '矩形'}物体，请尝试：\n1. 确保照片中有清晰的物体\n2. 切换轮廓类型（圆形/矩形）\n3. 重新拍照` });
      }

      setPageState('result');
    } catch (err: any) {
      console.error('[PaizhaoContainer] 识别失败:', err);
      setError(err.message || '检测失败，请重试');
      overlay.alert({ title: '识别失败', message: err.message || '检测失败，请检查网络连接后重试' });
    } finally {
      setDetecting(false);
    }
  }, [selectedImage, targetShape, detectMethod, detecting, overlay, imageSize, previewLayout, cropArea]);

  // 切换轮廓形状
  const toggleTargetShape = useCallback(() => {
    setTargetShape((prev) => (prev === 'rect' ? 'circle' : 'rect'));
  }, []);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  // 删除标记
  const handleRemoveBox = useCallback((index: number) => {
    setManualBoxes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 添加标记
  const handleAddBox = useCallback((event: any) => {
    if (!editMode || !previewLayout.width || !previewLayout.height || !imageSize) return;

    const { locationX, locationY } = event.nativeEvent;
    const cw = previewLayout.width;
    const ch = previewLayout.height;
    const iw = imageSize.width;
    const ih = imageSize.height;

    const scale = Math.max(cw / iw, ch / ih);
    const drawnW = iw * scale;
    const drawnH = ih * scale;
    const offsetX = (cw - drawnW) / 2;
    const offsetY = (ch - drawnH) / 2;
    const sx = drawnW / iw;
    const sy = drawnH / ih;

    const imgX = (locationX - offsetX) / sx;
    const imgY = (locationY - offsetY) / sy;
    const defaultSize = 40;

    const newBox: DetectionBox = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: imgX - defaultSize / 2,
      y: imgY - defaultSize / 2,
      width: defaultSize,
      height: defaultSize,
      confidence: 1.0,
      class: 'manual',
    };

    const currentBoxes = manualBoxesRef.current;
    setManualBoxes([...currentBoxes, newBox]);
  }, [editMode, previewLayout, imageSize]);

  // 分享
  const viewShotRef = React.useRef<ViewShot>(null);
  const handleShare = useCallback(async () => {
    if (sharing || pageState !== 'result') return;
    setSharing(true);
    setShareMode(true);

    try {
      await new Promise((r) => setTimeout(r, 80));
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('截图失败');
      await Share.open({ url: uri, type: 'image/png', failOnCancel: false });
    } catch (e: any) {
      const msg = String(e?.message || '').trim();
      if (msg && /User did not share|cancel/i.test(msg)) return;
      overlay.alert({ title: '提示', message: '分享失败，请重试' });
    } finally {
      setShareMode(false);
      setSharing(false);
    }
  }, [sharing, pageState, overlay]);

  // 保存到相册
  const handleSaveToGallery = useCallback(async () => {
    if (saving || saved || pageState !== 'result') return;
    setSaving(true);
    setShareMode(true);

    try {
      await new Promise((r) => setTimeout(r, 80));
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('截图失败');

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: '存储权限',
            message: '需要存储权限来保存照片到相册',
            buttonNeutral: '稍后',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          overlay.alert({ title: '提示', message: '需要存储权限才能保存到相册' });
          return;
        }
      }

      await CameraRoll.save(uri, { type: 'photo', album: '拍照计数' });
      setSaved(true);
      overlay.alert({ title: '成功', message: '照片已保存到相册' });
    } catch (e: any) {
      const msg = String(e?.message || '').trim();
      if (!msg || !/cancel/i.test(msg)) {
        overlay.alert({ title: '提示', message: msg || '保存失败，请重试' });
      }
    } finally {
      setShareMode(false);
      setSaving(false);
    }
  }, [saving, saved, pageState, overlay]);

  // 渲染检测标记
  const renderDetectionMarks = () => {
    if (pageState !== 'result' || manualBoxes.length === 0 || previewLayout.width === 0 || !imageSize) return null;

    const cw = previewLayout.width;
    const ch = previewLayout.height;
    const iw = imageSize.width;
    const ih = imageSize.height;

    const scale = Math.max(cw / iw, ch / ih);
    const drawnW = iw * scale;
    const drawnH = ih * scale;
    const offsetX = (cw - drawnW) / 2;
    const offsetY = (ch - drawnH) / 2;
    const sx = drawnW / iw;
    const sy = drawnH / ih;

    return manualBoxes.map((b, idx) => {
      const cx = offsetX + (b.x + b.width / 2) * sx;
      const cy = offsetY + (b.y + b.height / 2) * sy;
      if (!isFinite(cx) || !isFinite(cy)) return null;

      const isManual = b.class === 'manual';
      const numberText = String(idx + 1);
      const fontSize = numberText.length > 3 ? 8 : numberText.length > 2 ? 9 : 11;

      if (targetShape === 'rect') {
        const bw = Math.max(18, b.width * sx);
        const bh = Math.max(18, b.height * sy);
        return (
          <TouchableOpacity
            key={b.id}
            style={[styles.detectMark, isManual && styles.detectMarkManual, { left: cx - bw / 2, top: cy - bh / 2, width: bw, height: bh, borderRadius: 6 }]}
            onPress={() => editMode && handleRemoveBox(idx)}
            activeOpacity={0.7}
            disabled={!editMode}
          >
            <Text style={[styles.detectMarkText, { fontSize }]}>{numberText}</Text>
          </TouchableOpacity>
        );
      }

      const circleSize = Math.max(18, Math.max(b.width * sx, b.height * sy));
      return (
        <TouchableOpacity
          key={b.id}
          style={[styles.detectMark, isManual && styles.detectMarkManual, { left: cx - circleSize / 2, top: cy - circleSize / 2, width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
          onPress={() => editMode && handleRemoveBox(idx)}
          activeOpacity={0.7}
          disabled={!editMode}
        >
          <Text style={[styles.detectMarkText, { fontSize }]}>{numberText}</Text>
        </TouchableOpacity>
      );
    });
  };

  // 渲染底部栏
  const renderBottomBar = () => {
    // 分享模式
    if (shareMode) {
      return (
        <View style={styles.brandBar}>
          <Image source={APP_LOGO} style={styles.brandLogo} resizeMode="contain" />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>领建</Text>
            <Text style={styles.brandSlogan}>智能建筑行业信息平台</Text>
          </View>
        </View>
      );
    }

    // 相机页面
    if (pageState === 'camera') {
      return (
        <>
          <TouchableOpacity style={styles.sideButton} onPress={handleSelectImage} activeOpacity={0.8}>
            <ImageIcon size={22} color={DayColors.text} />
            <Text style={styles.sideButtonText}>相册</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto} activeOpacity={0.8}>
            <View style={styles.captureButtonInner}>
              <CameraIcon size={24} color={SemanticColors.success} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideButton} onPress={toggleTargetShape} activeOpacity={0.8}>
            <View style={[styles.shapeIcon, targetShape === 'circle' ? styles.shapeIconCircle : styles.shapeIconRect]} />
            <Text style={styles.sideButtonText}>{targetShape === 'circle' ? '圆形' : '矩形'}</Text>
          </TouchableOpacity>
        </>
      );
    }

    // 裁剪页面
    if (pageState === 'crop') {
      return (
        <>
          <TouchableOpacity style={styles.sideButton} onPress={handleRetake} activeOpacity={0.8}>
            <RotateCcw size={22} color={DayColors.text} />
            <Text style={styles.sideButtonText}>重拍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, detecting && styles.captureButtonDisabled]}
            onPress={handleDetect}
            disabled={detecting}
            activeOpacity={0.8}
          >
            <View style={styles.captureButtonInner}>
              {detecting ? (
                <ActivityIndicator size="small" color={SemanticColors.success} />
              ) : (
                <Text style={styles.captureButtonInnerText}>识别</Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.sideButton} />
        </>
      );
    }

    // 结果页面
    return (
      <>
        <TouchableOpacity style={styles.sideButton} onPress={handleRetake} activeOpacity={0.8}>
          <RotateCcw size={22} color={DayColors.text} />
          <Text style={styles.sideButtonText}>重拍</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, (saving || saved) && styles.captureButtonDisabled]}
          onPress={handleSaveToGallery}
          disabled={saving || saved}
          activeOpacity={0.8}
        >
          <View style={styles.captureButtonInner}>
            {saving ? (
              <ActivityIndicator size="small" color={SemanticColors.success} />
            ) : (
              <Text style={[styles.captureButtonInnerText, saved && styles.captureButtonInnerTextSaved]}>
                {saved ? '已保存' : '保存'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sideButton, editMode && styles.editModeButton]} onPress={toggleEditMode} activeOpacity={0.8}>
          <Text style={[styles.sideButtonText, editMode && styles.sideButtonTextSuccess]}>{editMode ? '完成' : '编辑'}</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.container}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.goBack()}>
              <ChevronLeft size={28} color={DayColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>拍照计数</Text>
            <View style={styles.headerRight}>
              {pageState === 'result' && (
                <TouchableOpacity onPress={handleShare} disabled={sharing}>
                  <ImageIcon size={22} color={DayColors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 相机页面 */}
        {pageState === 'camera' && (
          <View style={styles.cameraContainer}>
            {RNCamera ? (
              <RNCamera
                ref={cameraRef}
                style={styles.camera}
                type={cameraType}
                flashMode={RNCameraConstants.FlashMode?.auto || 0}
                autoFocus={RNCameraConstants.AutoFocus?.on || 1}
                captureAudio={false}
                androidCameraPermissionOptions={{
                  title: '相机权限',
                  message: '需要相机权限来拍照计数',
                  buttonPositive: '确定',
                  buttonNegative: '取消',
                }}
                onStatusChange={(event: any) => {
                  if (event.cameraStatus === 'NOT_AUTHORIZED') {
                    setHasCameraPermission(false);
                  } else if (event.cameraStatus === 'READY') {
                    setHasCameraPermission(true);
                  }
                }}
              >
                {showInstructions && (
                  <View style={styles.instructionOverlay}>
                    <View style={styles.instructionCard}>
                      <TouchableOpacity style={styles.instructionClose} onPress={() => setShowInstructions(false)}>
                        <Text style={{ color: '#fff', fontSize: 20 }}>×</Text>
                      </TouchableOpacity>
                      <Text style={styles.instructionTitle}>使用说明</Text>
                      <Text style={styles.instructionText}>
                        {'1. 拍照前，请先选择待识别物体的轮廓\n2. 拍照后，调整选区并点击"识别"\n3. 识别后，可点击"编辑"按钮增删纠错'}
                      </Text>
                    </View>
                  </View>
                )}
              </RNCamera>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraPlaceholderText}>相机加载中...</Text>
              </View>
            )}
          </View>
        )}

        {/* 裁剪页面 */}
        {pageState === 'crop' && selectedImage && (
          <View style={styles.previewContainer}>
            <View 
              style={styles.fullImageContainer}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setPreviewLayout({ width, height });
              }}
            >
              <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="cover" />
              {previewLayout.width > 0 && (
                <CropOverlay 
                  imageWidth={previewLayout.width} 
                  imageHeight={previewLayout.height} 
                  onCropChange={setCropArea}
                  disabled={detecting}
                />
              )}
            </View>
            <Text style={styles.cropHint}>拖动框选识别区域，右下角调整大小</Text>
          </View>
        )}

        {/* 结果页面 */}
        {pageState === 'result' && selectedImage && (
          <View style={styles.previewContainer}>
            <TouchableOpacity
              style={styles.fullImageContainer}
              activeOpacity={1}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setPreviewLayout({ width, height });
              }}
              onPress={editMode ? handleAddBox : undefined}
              disabled={!editMode}
            >
              <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="cover" />
              <View style={styles.boxOverlay}>{renderDetectionMarks()}</View>
              
              {editMode && (
                <View style={styles.editModeHint}>
                  <Text style={styles.editModeHintText}>点击空白处添加标记，点击标记删除</Text>
                </View>
              )}
            </TouchableOpacity>

            {!detecting && result && (
              <View style={styles.countRow}>
                <Text style={styles.countLabel}>识别数量</Text>
                <Text style={styles.countValue}>{detectedCount}</Text>
                {manualBoxes.length !== (result.boxes?.length || 0) && (
                  <Text style={styles.countModified}>已修改</Text>
                )}
              </View>
            )}

            {error && (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            )}
          </View>
        )}

        {/* 底部栏 */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {renderBottomBar()}
        </View>
      </View>
    </ViewShot>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DayColors.background,
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
    right: 0,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  cameraPlaceholderText: {
    color: '#fff',
    fontSize: 16,
  },
  instructionOverlay: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: 110,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  instructionCard: {
    gap: 8,
  },
  instructionClose: {
    position: 'absolute',
    top: 4,
    right: 8,
    zIndex: 10,
  },
  instructionTitle: {
    ...TextStyles.title,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  instructionText: {
    ...TextStyles.body,
    color: '#FFFFFF',
    lineHeight: 22,
    fontSize: FontSize.sm,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  fullImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cropHint: {
    position: 'absolute',
    top: 16,
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  boxOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  detectMark: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.50)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detectMarkManual: {
    backgroundColor: 'rgba(16, 185, 129, 0.50)',
  },
  detectMarkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  editModeHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editModeHintText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  countLabel: {
    ...TextStyles.body,
    color: DayColors.textSecondary,
  },
  countValue: {
    ...TextStyles.title,
    color: SemanticColors.success,
    fontSize: 28,
  },
  countModified: {
    ...TextStyles.caption,
    color: SemanticColors.warning,
    marginLeft: Spacing.sm,
  },
  inlineError: {
    marginTop: Spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  inlineErrorText: {
    ...TextStyles.body,
    color: SemanticColors.error,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: DayColors.surface,
    borderTopWidth: 1,
    borderTopColor: DayColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  brandBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandTextWrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  brandName: {
    ...TextStyles.title,
    color: DayColors.text,
  },
  brandSlogan: {
    ...TextStyles.caption,
    color: DayColors.textSecondary,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  sideButtonText: {
    fontSize: 11,
    color: DayColors.textSecondary,
  },
  sideButtonTextSuccess: {
    color: SemanticColors.success,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SemanticColors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
    color: SemanticColors.success,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInnerTextSaved: {
    color: '#999',
  },
  editModeButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingVertical: 4,
  },
  shapeIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: DayColors.text,
    backgroundColor: 'transparent',
  },
  shapeIconCircle: {
    borderRadius: 11,
  },
  shapeIconRect: {
    borderRadius: 4,
  },
});

export default PaizhaoContainer;
