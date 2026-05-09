import * as ImagePicker from 'react-native-image-picker';
import type { ImagePickerResponse } from 'react-native-image-picker';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { API_CONFIG } from '@/constants/config';

const getLaunchers = () => {
  const anyPicker = ImagePicker as any;
  const fromNamed = {
    launchCamera: anyPicker.launchCamera,
    launchImageLibrary: anyPicker.launchImageLibrary,
  };
  const fromDefault = {
    launchCamera: anyPicker?.default?.launchCamera,
    launchImageLibrary: anyPicker?.default?.launchImageLibrary,
  };

  const launchCamera = fromNamed.launchCamera || fromDefault.launchCamera;
  const launchImageLibrary = fromNamed.launchImageLibrary || fromDefault.launchImageLibrary;

  if (typeof launchCamera !== 'function' || typeof launchImageLibrary !== 'function') {
    throw new Error('图片选择组件未正确安装或未重新编译，请重新安装 react-native-image-picker 并重新运行 App');
  }

  return { launchCamera, launchImageLibrary };
};

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  cx?: number;
  cy?: number;
  radius?: number;
  contour?: number[][];
  axes?: number[];
  angle?: number;
}

export interface DetectionResult {
  count: number;
  confidence: number;
  boxes: DetectionBox[];
  model: string;
}

const getBaseUrl = (): string => {
  const url = API_CONFIG.BASE_URL;
  console.log('[PaizhaoApi] getBaseUrl:', url, '__DEV__:', __DEV__);
  return url;
};

const imageToBase64 = async (uri: string): Promise<string> => {
  console.log('[PaizhaoApi] 原始 URI:', uri);

  let filePath = uri;

  if (uri.startsWith('file://')) {
    filePath = uri.replace('file://', '');
  } else if (uri.startsWith('content://')) {
    throw new Error('暂不支持 content:// 格式的图片，请从相册选择其他图片');
  }

  console.log('[PaizhaoApi] 处理后路径:', filePath);

  try {
    const exists = await RNFS.exists(filePath);
    console.log('[PaizhaoApi] 文件存在:', exists);

    if (!exists) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const base64 = await RNFS.readFile(filePath, 'base64');
    console.log('[PaizhaoApi] Base64 编码成功, 长度:', base64.length);
    return base64;
  } catch (error: any) {
    console.error('[PaizhaoApi] 读取文件失败:', error);
    throw new Error(`读取图片失败: ${error.message}`);
  }
};

export const paizhaoApi = {
  selectImage: async (): Promise<ImagePickerResponse> => {
    try {
      const { launchImageLibrary } = getLaunchers();
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      if (result.didCancel) {
        return result;
      }

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      return result;
    } catch (error: any) {
      throw error;
    }
  },

  takePhoto: async (): Promise<ImagePickerResponse> => {
    try {
      const { launchCamera } = getLaunchers();
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      if (result.didCancel) {
        return result;
      }

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      return result;
    } catch (error: any) {
      throw error;
    }
  },

  detectPipes: async (
    imageUri: string,
    shape: 'circle' | 'rect' | 'ellipse' = 'circle',
    method: 'cv' | 'yolo' = 'cv',
    cropArea?: { x: number; y: number; width: number; height: number } | null
  ): Promise<DetectionResult> => {
    try {
      console.log('[PaizhaoApi] 开始检测:', { imageUri, shape, method, cropArea });

      const base64 = await imageToBase64(imageUri);

      const url = `${getBaseUrl()}/api/paizhao/detect_base64`;
      console.log('[PaizhaoApi] 请求 URL:', url);

      const requestBody: any = {
        image_base64: base64,
        shape: shape,
        method: method,
      };

      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        requestBody.crop_x = Math.round(cropArea.x);
        requestBody.crop_y = Math.round(cropArea.y);
        requestBody.crop_width = Math.round(cropArea.width);
        requestBody.crop_height = Math.round(cropArea.height);
      }

      const bodyStr = JSON.stringify(requestBody);
      console.log('[PaizhaoApi] 请求体大小:', bodyStr.length, 'bytes');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: bodyStr,
      });

      console.log('[PaizhaoApi] 响应状态:', response.status);

      const responseText = await response.text();
      console.log('[PaizhaoApi] 响应内容:', responseText.substring(0, 500));

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('[PaizhaoApi] 检测完成:', data?.result?.count, '个物体');

      if (data?.result) {
        return {
          count: data.result.count ?? 0,
          confidence: data.result.confidence ?? 0,
          boxes: data.result.boxes ?? [],
          model: data.result.model ?? 'unknown',
        };
      }

      throw new Error('响应格式错误');
    } catch (error: any) {
      console.error('[PaizhaoApi] 检测失败:', error);
      throw error;
    }
  },
};
