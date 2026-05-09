import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Box, Camera, ChevronLeft, RefreshCw, FlipHorizontal, Image as ImageIcon, RotateCcw } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

let RNCamera: any = null;
let RNCameraConstants: any = {};
try {
  const camModule = require('react-native-camera');
  RNCamera = camModule.RNCamera;
  RNCameraConstants = camModule.RNCamera?.Constants || {};
} catch (e) {
  console.warn('react-native-camera not available');
}

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintCamera'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CROP_INITIAL_MARGIN = 0.08;
const HANDLE_SIZE = 28;
const CORNER_SIZE = 14;
const MIN_CROP_SIZE = 80;

const CropOverlay: React.FC<{
  imageWidth: number;
  imageHeight: number;
  onCropChange: (crop: { x: number; y: number; width: number; height: number }) => void;
  resetKey?: number;
}> = ({ imageWidth, imageHeight, onCropChange, resetKey }) => {
  const getInitial = useCallback(() => {
    const minDimension = Math.min(imageWidth, imageHeight);
    const size = minDimension * (1 - 2 * CROP_INITIAL_MARGIN);
    const x = (imageWidth - size) / 2;
    const y = (imageHeight - size) / 2;
    return { x, y, width: size, height: size };
  }, [imageWidth, imageHeight]);

  const [cropRect, setCropRect] = useState(getInitial);

  React.useEffect(() => {
    onCropChange(cropRect);
  }, [cropRect]);

  React.useEffect(() => {
    setCropRect(getInitial());
  }, [resetKey, getInitial]);

  const dragRef = useRef<{
    type: 'none' | 'move' | 'resize';
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; width: number; height: number };
  }>({ type: 'none', startX: 0, startY: 0, startCrop: { x: 0, y: 0, width: 0, height: 0 } });

  const clampCrop = useCallback((crop: { x: number; y: number; width: number; height: number }) => {
    const w = Math.max(MIN_CROP_SIZE, Math.min(crop.width, imageWidth));
    const h = Math.max(MIN_CROP_SIZE, Math.min(crop.height, imageHeight));
    const x = Math.max(0, Math.min(crop.x, imageWidth - w));
    const y = Math.max(0, Math.min(crop.y, imageHeight - h));
    return { x, y, width: w, height: h };
  }, [imageWidth, imageHeight]);

  const handleMoveTouchStart = useCallback((e: any) => {
    const touch = e.nativeEvent.touches[0] || e.nativeEvent;
    dragRef.current = {
      type: 'move',
      startX: touch.pageX,
      startY: touch.pageY,
      startCrop: { ...cropRect },
    };
  }, [cropRect]);

  const handleResizeTouchStart = useCallback((e: any) => {
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
      <View style={{ position: 'absolute', left: 0, top: 0, width: cropRect.x, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x + cropRect.width, top: 0, width: imageWidth - cropRect.x - cropRect.width, height: imageHeight, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x, top: 0, width: cropRect.width, height: cropRect.y, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ position: 'absolute', left: cropRect.x, top: cropRect.y + cropRect.height, width: cropRect.width, height: imageHeight - cropRect.y - cropRect.height, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      
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
          borderColor: '#E67E22',
          zIndex: 10,
        }}
        pointerEvents="box-only"
      />
      
      {/* 左上角装饰点 */}
      <View
        style={{
          position: 'absolute',
          left: cropRect.x - CORNER_SIZE / 2,
          top: cropRect.y - CORNER_SIZE / 2,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          backgroundColor: '#E67E22',
          borderRadius: CORNER_SIZE / 2,
          zIndex: 15,
        }}
        pointerEvents="none"
      />
      
      {/* 右上角装饰点 */}
      <View
        style={{
          position: 'absolute',
          left: cropRect.x + cropRect.width - CORNER_SIZE / 2,
          top: cropRect.y - CORNER_SIZE / 2,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          backgroundColor: '#E67E22',
          borderRadius: CORNER_SIZE / 2,
          zIndex: 15,
        }}
        pointerEvents="none"
      />
      
      {/* 左下角装饰点 */}
      <View
        style={{
          position: 'absolute',
          left: cropRect.x - CORNER_SIZE / 2,
          top: cropRect.y + cropRect.height - CORNER_SIZE / 2,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          backgroundColor: '#E67E22',
          borderRadius: CORNER_SIZE / 2,
          zIndex: 15,
        }}
        pointerEvents="none"
      />
      
      {/* 右下角可拖动拉手点 */}
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
          backgroundColor: '#E67E22',
          borderRadius: HANDLE_SIZE / 2,
          borderWidth: 2,
          borderColor: '#fff',
          zIndex: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="box-only"
      >
        <Image source={require('@/assets/images/move.png')} style={{ width: 16, height: 16, tintColor: '#fff' }} />
      </View>
    </View>
  );
};

const ViewfinderOverlay = () => (
  <View style={styles.viewfinderContainer} pointerEvents="none">
    <View style={styles.viewfinderBorder}>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
    </View>
    <Text style={styles.viewfinderHint}>将图纸对准取景框</Text>
  </View>
);

const CameraScreen: React.FC<Props> = ({ navigation, route }) => {
  const initialImage = route.params?.imageBase64 || null;
  const [isPreviewing, setIsPreviewing] = useState(!!initialImage);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage);
  const [imageSource, setImageSource] = useState<'camera' | 'gallery'>('camera');
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const [cameraType, setCameraType] = useState(RNCameraConstants.Type?.back ?? 0);
  const [cropResetKey, setCropResetKey] = useState(0);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<RNCamera>(null);
  const insets = useSafeAreaInsets();

  const zoomShared = useSharedValue(0);
  const startZoomShared = useSharedValue(0);

  useEffect(() => {
    zoomShared.value = zoom;
  }, [zoom]);

  const updateZoom = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const pinchGesture = useMemo(() => 
    Gesture.Pinch()
      .onStart(() => {
        'worklet';
        startZoomShared.value = zoomShared.value;
      })
      .onUpdate((event) => {
        'worklet';
        const DAMPING = 0.3;
        const scaleDelta = (event.scale - 1) * DAMPING;
        const newZoom = Math.min(1, Math.max(0, startZoomShared.value + scaleDelta));
        runOnJS(updateZoom)(newZoom);
      }),
    [updateZoom, zoomShared, startZoomShared]
  );

  const composedGesture = useMemo(() => 
    Gesture.Simultaneous(
      pinchGesture,
      Gesture.Tap().onEnd(() => {
        'worklet';
      })
    ),
    [pinchGesture]
  );

  // 请求相机权限
  React.useEffect(() => {
    const requestCameraPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: '相机权限',
              message: '需要相机权限来拍摄建筑图纸',
              buttonNeutral: '稍后',
              buttonNegative: '取消',
              buttonPositive: '确定',
            }
          );
          setHasCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        } catch (err) {
          console.warn('Camera permission error:', err);
          setHasCameraPermission(false);
        }
      }
    };
    requestCameraPermission();
  }, []);

  const onCropChange = useCallback((crop: { x: number; y: number; width: number; height: number }) => {
    setCropArea(crop);
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const options = {
        quality: 0.9,
        base64: true,
        width: 1920,
        height: 1080,
      };
      const data = await cameraRef.current.takePictureAsync(options);
      if (data?.base64) {
        const sizeBytes = data.base64.length * 3 / 4;
        if (sizeBytes > 10 * 1024 * 1024) {
          Alert.alert('提示', '图片过大，请重新拍摄');
          setIsCapturing(false);
          return;
        }
        setCapturedImage(data.base64);
        setImageSource('camera');
        setIsPreviewing(true);
      }
    } catch (e) {
      Alert.alert('拍摄失败', '请重试');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setIsPreviewing(false);
  }, []);

  const flipCamera = useCallback(() => {
    setCameraType(prev =>
      prev === (RNCameraConstants.Type?.back ?? 0)
        ? (RNCameraConstants.Type?.front ?? 1)
        : (RNCameraConstants.Type?.back ?? 0)
    );
  }, []);

  const resetCrop = useCallback(() => {
    setCropResetKey(prev => prev + 1);
  }, []);

  const openGallery = useCallback(async () => {
    try {
      // 请求存储权限
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: '存储权限',
            message: '需要访问相册来选择图纸图片',
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
        includeBase64: true,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      console.log('Gallery result:', JSON.stringify(result, null, 2));

      if (result.didCancel) {
        console.log('User cancelled image picker');
        return;
      }

      if (result.errorCode) {
        console.log('Image picker error:', result.errorCode, result.errorMessage);
        Alert.alert('选择图片失败', result.errorMessage || '请重试');
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Selected asset:', asset.fileName, asset.type, asset.width, asset.height);
        
        if (asset.base64) {
          const sizeBytes = asset.base64.length * 3 / 4;
          console.log('Image size:', (sizeBytes / 1024 / 1024).toFixed(2), 'MB');
          if (sizeBytes > 10 * 1024 * 1024) {
            Alert.alert('提示', '图片过大，请选择较小的图片');
            return;
          }
          setCapturedImage(asset.base64);
          setImageSource('gallery');
          setIsPreviewing(true);
        } else {
          console.log('No base64 data in asset');
          Alert.alert('提示', '无法读取图片数据，请重试');
        }
      } else {
        console.log('No assets in result');
      }
    } catch (e) {
      console.log('Gallery error:', e);
      Alert.alert('选择图片失败', '请重试');
    }
  }, []);

  const generateModel = useCallback(() => {
    if (!capturedImage) return;
    navigation.navigate('BlueprintLoading', {
      imageBase64: capturedImage,
      cropArea: {
        x: cropArea.x / SCREEN_WIDTH,
        y: cropArea.y / SCREEN_HEIGHT,
        width: cropArea.width / SCREEN_WIDTH,
        height: cropArea.height / SCREEN_HEIGHT,
      },
    });
  }, [capturedImage, cropArea, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!RNCamera) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>相机模块加载失败</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => navigation.goBack()}>
          <Text style={styles.permissionButtonText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasCameraPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>需要相机权限才能拍摄图纸</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Alert.alert('提示', '请在系统设置中开启相机权限');
            } else {
              Alert.alert('提示', '请在应用设置中开启相机权限');
            }
          }}
        >
          <Text style={styles.permissionButtonText}>去设置</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isPreviewing ? (
          <>
            <GestureDetector gesture={composedGesture}>
              <View style={styles.cameraContainer}>
                <RNCamera
                  ref={cameraRef}
                  style={styles.camera}
                  type={cameraType}
                  zoom={zoom}
                  flashMode={RNCameraConstants.FlashMode?.auto || 0}
                  autoFocus={RNCameraConstants.AutoFocus?.on || 1}
                  captureAudio={false}
                  androidCameraPermissionOptions={{
                    title: '相机权限',
                    message: '需要相机权限来拍摄建筑图纸',
                    buttonPositive: '确定',
                    buttonNegative: '取消',
                  }}
                  onStatusChange={(event) => {
                    if (event.cameraStatus === 'NOT_AUTHORIZED') {
                      setHasCameraPermission(false);
                    } else if (event.cameraStatus === 'READY') {
                      setHasCameraPermission(true);
                    }
                  }}
                >
                  <ViewfinderOverlay />
                  {/* 缩放指示器 */}
                  <View style={styles.zoomIndicator}>
                    <Text style={styles.zoomText}>{Math.round((1 + zoom) * 100)}%</Text>
                  </View>
                </RNCamera>
              </View>
            </GestureDetector>
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>拍摄图纸</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity style={styles.sideButton} onPress={openGallery}>
              <ImageIcon size={22} color="#333" />
              <Text style={styles.sideButtonText}>相册</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isCapturing} activeOpacity={0.8}>
              <View style={styles.captureButtonInner}>
                {isCapturing ? (
                  <ActivityIndicator color="#E67E22" size="small" />
                ) : (
                  <Camera size={24} color="#E67E22" />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sideButton, styles.sideButtonDisabled]}>
              <Icon name="file" size={22} color="#666" />
              <Text style={[styles.sideButtonText, styles.sideButtonTextDisabled]}>CAD</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.previewContainer}>
          {capturedImage && (
            <Image
              style={styles.previewImage}
              source={{ uri: `data:image/jpeg;base64,${capturedImage}` }}
              resizeMode={imageSource === 'camera' ? 'cover' : 'contain'}
            />
          )}
          <CropOverlay
            imageWidth={SCREEN_WIDTH}
            imageHeight={SCREEN_HEIGHT}
            onCropChange={onCropChange}
            resetKey={cropResetKey}
          />
          <Text style={styles.cropHint}>拖拽橙色角标调整选区，框选图纸区域</Text>
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>裁剪图纸</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity style={styles.sideButton} onPress={retake}>
              <RefreshCw size={22} color="#333" />
              <Text style={styles.sideButtonText}>重新拍摄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={generateModel} activeOpacity={0.8}>
              <View style={styles.captureButtonInner}>
                <Box size={24} color="#E67E22" />
              </View>
            </TouchableOpacity>
            <View style={styles.sideButton} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  zoomIndicator: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewfinderContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBorder: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.6,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#E67E22',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  viewfinderHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 10,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  backButton: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    minWidth: 44,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sideButton: { alignItems: 'center', gap: 4, minWidth: 60 },
  sideButtonDisabled: { opacity: 0.4 },
  sideButtonText: { fontSize: 11, color: '#333' },
  sideButtonTextDisabled: { color: '#666' },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E67E22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(230,126,34,0.3)',
  },
  captureButtonInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  previewContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  previewImage: { flex: 1, width: '100%' },
  cropHint: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    zIndex: 30,
  },

  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  permissionText: { color: '#fff', fontSize: 16, marginBottom: 16 },
  permissionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E67E22',
  },
  permissionButtonText: { color: '#fff', fontSize: 16 },
});

export default CameraScreen;
