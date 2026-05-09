/**
 * 语音模型预下载服务 (V2)
 *
 * 在APP启动时后台下载语音识别模型，避免首次使用时等待。
 * 仅支持 Android 平台（iOS 使用系统语音识别）。
 */
import { Platform, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { API_CONFIG } from '@/constants';

const { SherpaOnnx } = NativeModules;

const MODEL_FILES = [
  'encoder-epoch-99-avg-1.int8.onnx',
  'decoder-epoch-99-avg-1.int8.onnx',
  'joiner-epoch-99-avg-1.int8.onnx',
  'tokens.txt',
];

export interface PredownloadProgress {
  current: number;
  total: number;
  fileName: string;
  status: 'downloading' | 'completed' | 'failed' | 'idle';
  error?: string;
}

type ProgressCallback = (progress: PredownloadProgress) => void;

let isPredownloading = false;

/**
 * 检查模型文件是否已全部下载
 */
export const checkModelsReady = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !SherpaOnnx) return true;

  try {
    const modelDir: string = await SherpaOnnx.getModelDir();
    for (const name of MODEL_FILES) {
      const filePath = `${modelDir}/${name}`;
      const exists = await RNFS.exists(filePath);
      if (!exists) return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * 预下载语音模型（APP 启动时后台调用）
 */
export const predownloadVoiceModels = async (
  token: string,
  onProgress?: ProgressCallback
): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (!SherpaOnnx) {
    console.log('[VoiceModel] SherpaOnnx module not available');
    return false;
  }
  if (!token) {
    console.log('[VoiceModel] No token, skip predownload');
    return false;
  }
  if (isPredownloading) {
    console.log('[VoiceModel] Already predownloading');
    return false;
  }

  isPredownloading = true;
  const total = MODEL_FILES.length;

  try {
    const modelDir: string = await SherpaOnnx.getModelDir();
    await RNFS.mkdir(modelDir);

    const baseUrl = API_CONFIG.BASE_URL.replace(/\/+$/, '');

    for (let i = 0; i < MODEL_FILES.length; i++) {
      const name = MODEL_FILES[i];
      const dest = `${modelDir}/${name}`;
      const exists = await RNFS.exists(dest);

      if (exists) {
        console.log(`[VoiceModel] ${name} already exists, skip`);
        onProgress?.({ current: i + 1, total, fileName: name, status: 'completed' });
        continue;
      }

      console.log(`[VoiceModel] Downloading ${name}...`);
      onProgress?.({ current: i, total, fileName: name, status: 'downloading' });

      const url = `${baseUrl}/api/resource/sherpa-model/${encodeURIComponent(name)}`;

      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          const result = await RNFS.downloadFile({
            fromUrl: url,
            toFile: dest,
            headers: { Authorization: `Bearer ${token}` },
            background: true,
            discretionary: true,
            connectionTimeout: 30000,
            readTimeout: 300000,
          }).promise;

          if (result.statusCode === 200) {
            success = true;
            console.log(`[VoiceModel] ${name} downloaded successfully`);
          } else {
            console.log(`[VoiceModel] ${name} download failed: ${result.statusCode}`);
            const downloaded = await RNFS.exists(dest);
            if (downloaded) await RNFS.unlink(dest);
            retries--;
          }
        } catch (err) {
          console.log(`[VoiceModel] ${name} download error:`, err);
          retries--;
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      if (!success) {
        onProgress?.({
          current: i,
          total,
          fileName: name,
          status: 'failed',
          error: `下载 ${name} 失败`,
        });
        isPredownloading = false;
        return false;
      }

      onProgress?.({ current: i + 1, total, fileName: name, status: 'completed' });
    }

    console.log('[VoiceModel] All models downloaded successfully');
    isPredownloading = false;
    return true;
  } catch (err) {
    console.log('[VoiceModel] Predownload error:', err);
    onProgress?.({
      current: 0,
      total,
      fileName: '',
      status: 'failed',
      error: String(err),
    });
    isPredownloading = false;
    return false;
  }
};

/**
 * 重置预下载状态（用于重试）
 */
export const resetPredownloadState = () => {
  isPredownloading = false;
};
