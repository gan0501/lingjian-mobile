// TextEncoder/TextDecoder polyfill（react-native-qrcode-svg 依赖，RN 环境缺失）
const g: any = global;
if (typeof g.TextEncoder === 'undefined') {
  class TextEncoder {
    encode(input: string = ''): Uint8Array {
      const str = String(input);
      const bytes: number[] = [];
      let i = 0;
      while (i < str.length) {
        let codePoint = str.codePointAt(i) as number;
        if (codePoint > 0xffff) i += 2; else i += 1;
        if (codePoint <= 0x7f) { bytes.push(codePoint); }
        else if (codePoint <= 0x7ff) {
          bytes.push(0xc0 | (codePoint >> 6));
          bytes.push(0x80 | (codePoint & 0x3f));
        } else if (codePoint <= 0xffff) {
          bytes.push(0xe0 | (codePoint >> 12));
          bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
          bytes.push(0x80 | (codePoint & 0x3f));
        } else {
          bytes.push(0xf0 | (codePoint >> 18));
          bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
          bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
          bytes.push(0x80 | (codePoint & 0x3f));
        }
      }
      return new Uint8Array(bytes);
    }
  }
  g.TextEncoder = TextEncoder;
}

if (typeof g.TextDecoder === 'undefined') {
  class TextDecoder {
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const buf = input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array((input as any).buffer, (input as any).byteOffset, (input as any).byteLength);
      let out = '';
      let i = 0;
      while (i < buf.length) {
        const b0 = buf[i++];
        if (b0 < 0x80) { out += String.fromCharCode(b0); continue; }
        if ((b0 & 0xe0) === 0xc0) {
          out += String.fromCharCode(((b0 & 0x1f) << 6) | (buf[i++] & 0x3f)); continue;
        }
        if ((b0 & 0xf0) === 0xe0) {
          const b1 = buf[i++] & 0x3f;
          out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | (buf[i++] & 0x3f)); continue;
        }
        const b1 = buf[i++] & 0x3f, b2 = buf[i++] & 0x3f, b3 = buf[i++] & 0x3f;
        let cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3;
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10));
        out += String.fromCharCode(0xdc00 + (cp & 0x3ff));
      }
      return out;
    }
  }
  g.TextDecoder = TextDecoder;
}

import React, { useEffect, useRef } from 'react';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { OverlayProvider } from '@/components/overlay';
import { CustomAlertProvider } from '@/components/common/CustomAlert';
import { RootNavigator } from '@/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { predownloadVoiceModels, checkModelsReady } from '@/services/voiceModelService';
import { ThemeProvider } from '@/theme/ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const hasTriedPredownload = useRef(false);

  // 语音模型预下载（登录后自动下载）
  useEffect(() => {
    if (!token || hasTriedPredownload.current) return;
    if (Platform.OS !== 'android') return;

    hasTriedPredownload.current = true;

    const doPredownload = async () => {
      const ready = await checkModelsReady();
      if (ready) {
        console.log('[App] Voice models already downloaded');
        return;
      }

      console.log('[App] Starting voice model predownload...');
      const success = await predownloadVoiceModels(token, (progress) => {
        console.log(`[App] Voice model download: ${progress.fileName} (${progress.current}/${progress.total}) - ${progress.status}`);
      });

      if (success) {
        console.log('[App] Voice model predownload completed');
      } else {
        console.log('[App] Voice model predownload failed, will retry on demand');
      }
    };

    // 延迟启动，避免影响 APP 启动性能
    const timer = setTimeout(doPredownload, 3000);
    return () => clearTimeout(timer);
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <PaperProvider>
              <OverlayProvider theme="light">
                <CustomAlertProvider theme="day">
                  <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                  <RootNavigator />
                </CustomAlertProvider>
              </OverlayProvider>
            </PaperProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
};

export default App;
