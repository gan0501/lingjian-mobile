import { useState, useCallback, useRef, useEffect } from 'react';
import {
  startRecording,
  stopRecordingAndRecognize,
  requestAudioPermission,
  cleanup,
} from '@/services/BaiduSpeechService';

interface UseVoiceRecognitionResult {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  uiHint: string | null;
  isPreparing: boolean;
  requireLogin: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearTranscript: () => void;
  setRequireLogin: (value: boolean) => void;
}

export const useVoiceRecognition = (): UseVoiceRecognitionResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [uiHint, setUiHint] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);
  
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isRecordingRef.current || isStoppingRef.current) return;
    
    try {
      setError(null);
      setTranscript('');
      cancelledRef.current = false;
      
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        setError('需要麦克风权限才能使用语音输入');
        return;
      }
      
      if (cancelledRef.current) {
        console.log('[BaiduSpeech] 用户已取消，放弃录音');
        return;
      }
      
      isRecordingRef.current = true;
      setIsListening(true);
      setIsPreparing(false);
      
      await startRecording();
      console.log('[BaiduSpeech] 开始录音');
    } catch (err: any) {
      console.error('[BaiduSpeech] startListening error:', err);
      setError(err?.message || '启动录音失败');
      setIsListening(false);
      setIsPreparing(false);
      isRecordingRef.current = false;
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!isRecordingRef.current) {
      cancelledRef.current = true;
      return;
    }
    
    isStoppingRef.current = true;
    
    try {
      setIsPreparing(true);
      
      const result = await stopRecordingAndRecognize();
      console.log('[BaiduSpeech] 识别结果:', result);
      
      if (result && result.trim().length >= 2) {
        setTranscript(result);
      } else {
        setTranscript('');
      }
      setError(null);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('3307') || errMsg.includes('语音太短') || errMsg.includes('recognition error') || errMsg.includes('No audio data')) {
        console.log('[BaiduSpeech] 语音太短或未检测到语音，请重试');
        setError(null);
      } else {
        console.error('[BaiduSpeech] stopListening error:', err);
        setError(err?.message || '语音识别失败');
      }
    } finally {
      setIsListening(false);
      setIsPreparing(false);
      isRecordingRef.current = false;
      isStoppingRef.current = false;
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    uiHint,
    isPreparing,
    requireLogin,
    startListening,
    stopListening,
    clearTranscript,
    setRequireLogin,
  };
};
