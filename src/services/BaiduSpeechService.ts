import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';

const BAIDU_API_KEY = '5VOFETujF0WOSmt33ozs1Sq5';
const BAIDU_SECRET_KEY = 'JKBiAl4CzFOvbjKBMzDI1ySFgnd3wUrA';

let accessToken: string | null = null;
let tokenExpireTime: number = 0;

export const getBaiduAccessToken = async (): Promise<string> => {
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }

  const response = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`,
    { method: 'POST' }
  );

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`百度Token获取失败: ${data.error_description || data.error}`);
  }

  accessToken = data.access_token;
  tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
  
  return accessToken!;
};

export const requestAudioPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '麦克风权限',
        message: '需要麦克风权限才能进行语音识别',
        buttonNeutral: '稍后询问',
        buttonNegative: '取消',
        buttonPositive: '确定',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

const { BaiduSpeechModule, SpeechModule } = NativeModules;

let iosSpeechEmitter: NativeEventEmitter | null = null;
let iosResultListener: any = null;
let iosErrorListener: any = null;
let iosPartialResult = '';

export const startRecording = async (): Promise<void> => {
  if (Platform.OS === 'ios') {
    if (!SpeechModule) {
      throw new Error('iOS语音识别模块不可用');
    }
    iosPartialResult = '';
    iosSpeechEmitter = new NativeEventEmitter(SpeechModule);
    iosResultListener = iosSpeechEmitter.addListener('onSpeechResults', (event: any) => {
      iosPartialResult = event.value || '';
    });
    iosErrorListener = iosSpeechEmitter.addListener('onSpeechError', (event: any) => {
      console.warn('[SpeechModule] Error:', event.error);
    });
    await SpeechModule.startRecording();
    return;
  }

  if (!BaiduSpeechModule) {
    throw new Error('语音识别模块不可用');
  }
  await BaiduSpeechModule.startRecording();
};

export const stopRecordingAndRecognize = async (): Promise<string> => {
  if (Platform.OS === 'ios') {
    if (!SpeechModule) {
      throw new Error('iOS语音识别模块不可用');
    }
    try {
      const result = await SpeechModule.stopRecordingAndRecognize();
      return result || iosPartialResult || '';
    } finally {
      iosResultListener?.remove();
      iosErrorListener?.remove();
      iosResultListener = null;
      iosErrorListener = null;
      iosSpeechEmitter = null;
    }
  }

  if (!BaiduSpeechModule) {
    throw new Error('语音识别模块不可用');
  }
  const result = await BaiduSpeechModule.stopRecordingAndRecognize();
  return result;
};

export const cleanup = () => {
  if (Platform.OS === 'ios') {
    iosResultListener?.remove();
    iosErrorListener?.remove();
    iosResultListener = null;
    iosErrorListener = null;
    iosSpeechEmitter = null;
    iosPartialResult = '';
  }
};
