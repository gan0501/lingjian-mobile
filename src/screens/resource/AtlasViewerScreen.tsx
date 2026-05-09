import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { FileText } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { DayColors, Spacing, TextStyles, API_CONFIG } from '@/constants';
import { Loading } from '@/components/common/Loading';
import { Header } from '@/components/common/Header';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getQuotaStatus, consumeQuota } from '@/utils/viewingQuota';
import { useOverlay } from '@/components/overlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AtlasViewerScreen: FC = () => {
  const route = useRoute<any>();
  const atlasId = route.params?.atlasId;
  const navigation = useNavigation<any>();
  const overlay = useOverlay();
  const webViewRef = useRef<WebView>(null);
  const hasConsumedQuota = useRef(false);

  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPdfUrl = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(`${API_CONFIG.BASE_URL}/api/resource/standards/${atlasId}/pdf`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (data?.code === 200 && data?.result?.pdf_url) {
        setPdfUrl(data.result.pdf_url);
      } else {
        throw new Error(data?.message || '获取PDF地址失败');
      }
    } catch (e: any) {
      setPdfUrl('');
      setError(e?.name === 'AbortError' ? '请求超时' : (e?.message || '获取PDF失败'));
    } finally {
      setLoading(false);
    }
  }, [atlasId]);

  useEffect(() => {
    const quota = getQuotaStatus();
    if (!quota.canView) {
      overlay.alert({
        title: '查看次数已用完',
        message: '今日免费查看次数已用完，上传资源可获得更多查看机会',
        buttons: [{ text: '返回', onPress: () => navigation.goBack() }],
      });
      return;
    }
    if (!hasConsumedQuota.current) {
      hasConsumedQuota.current = true;
      consumeQuota();
    }
    fetchPdfUrl();
  }, [fetchPdfUrl]);

  const viewerHtml = useMemo(() => {
    if (!pdfUrl) return '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#f5f5f5;overflow:hidden}
    #container{width:100%;height:100%;overflow:auto;-webkit-overflow-scrolling:touch}
    #pages{display:flex;flex-direction:column;align-items:center;padding:10px;gap:10px}
    canvas{display:block;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.1)}
    #loading{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;color:#333;font-family:sans-serif}
    .spinner{width:40px;height:40px;border:3px solid rgba(0,0,0,0.1);border-top-color:${DayColors.primary || '#3b82f6'};border-radius:50%;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    #status{margin-top:16px;font-size:14px}
    #error{color:#ef4444}
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div id="status">加载PDF...</div>
  </div>
  <div id="container"><div id="pages"></div></div>

  <script src="file:///android_asset/pdfjs/pdf.min.js"></script>
  <script>
    var pdfUrlRaw = '${pdfUrl}';
    // 如果URL被编码了，解码它
    var pdfUrl = pdfUrlRaw.indexOf('%') !== -1 ? decodeURIComponent(pdfUrlRaw) : pdfUrlRaw;
    var loadingEl = document.getElementById('loading');
    var statusEl = document.getElementById('status');
    var pagesEl = document.getElementById('pages');
    var containerEl = document.getElementById('container');

    function postMsg(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function showError(msg) {
      statusEl.id = 'error';
      statusEl.textContent = msg;
      postMsg({type:'error', message:msg});
    }

    if (!window.pdfjsLib) {
      showError('PDF组件加载失败');
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'file:///android_asset/pdfjs/pdf.worker.min.js';

      var loadingTask = pdfjsLib.getDocument(pdfUrl);
      loadingTask.onProgress = function(p) {
        if (p.total > 0) {
          statusEl.textContent = '下载: ' + Math.round(p.loaded/p.total*100) + '%';
        }
      };

      loadingTask.promise.then(function(pdf) {
        var total = pdf.numPages;
        postMsg({type:'ready', totalPages:total});
        statusEl.textContent = '渲染中...';

        var width = Math.min(containerEl.clientWidth - 20, 800);
        var rendered = 0;

        function renderPage(num) {
          pdf.getPage(num).then(function(page) {
            var vp = page.getViewport({scale:1});
            var scale = width / vp.width;
            var viewport = page.getViewport({scale:scale});

            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pagesEl.appendChild(canvas);

            page.render({canvasContext:canvas.getContext('2d'), viewport:viewport}).promise.then(function() {
              rendered++;
              if (rendered === 1) loadingEl.style.display = 'none';
              if (rendered === total) postMsg({type:'done'});
              if (num < total) renderPage(num + 1);
            });
          });
        }

        renderPage(1);

        var lastPage = 1;
        containerEl.onscroll = function() {
          var canvases = pagesEl.querySelectorAll('canvas');
          var scrollTop = containerEl.scrollTop;
          var page = 1;
          for (var i = 0; i < canvases.length; i++) {
            if (canvases[i].offsetTop <= scrollTop + 100) page = i + 1;
          }
          if (page !== lastPage) {
            lastPage = page;
            postMsg({type:'page', current:page, total:total});
          }
        };
      }).catch(function(err) {
        showError('PDF加载失败: ' + (err.message || '网络错误'));
      });
    }
  </script>
</body>
</html>`;
  }, [pdfUrl]);

  const handleMessage = useCallback((event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData || typeof rawData !== 'string') return;
      const data = JSON.parse(rawData);
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ready' && typeof data.totalPages === 'number') setTotalPages(data.totalPages);
      if (data.type === 'page') {
        if (typeof data.current === 'number') setCurrentPage(data.current);
        if (typeof data.total === 'number') setTotalPages(data.total);
      }
      if (data.type === 'error' && typeof data.message === 'string') setError(data.message);
    } catch (e) {
      if (__DEV__) console.error('[AtlasViewer] 解析WebView消息失败:', e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Header title="图集查看" showBack onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerContainer}>
            <Loading size="large" color={DayColors.primary || '#3b82f6'} />
            <Text style={styles.loadingText}>获取PDF地址...</Text>
          </View>
        ) : pdfUrl ? (
          <View style={styles.webviewContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: viewerHtml, baseUrl: 'file:///android_asset/' }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              mixedContentMode="always"
              onMessage={handleMessage}
              onError={() => setError('WebView加载失败')}
            />
            {totalPages > 0 && (
              <View style={styles.pageIndicator}>
                <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
              </View>
            )}
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIcon}>
              <FileText color={DayColors.textTertiary} size={64} />
            </View>
            <Text style={styles.emptyTitle}>暂无PDF文件</Text>
            <Text style={styles.emptyDesc}>{error || '该图集暂未提供PDF预览'}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DayColors.background },
  content: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  webviewContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingText: { ...TextStyles.body, marginTop: Spacing.md, color: DayColors.textTertiary },
  pageIndicator: {
    position: 'absolute', right: 16, bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15,
  },
  pageText: { color: '#fff', fontSize: 12 },
  errorText: { ...TextStyles.body, color: '#ef4444', padding: Spacing.md, textAlign: 'center' },
  emptyIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: DayColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  emptyTitle: { ...TextStyles.sectionTitle, marginBottom: Spacing.sm, color: DayColors.text },
  emptyDesc: { ...TextStyles.body, color: DayColors.textTertiary, textAlign: 'center' },
});

export default AtlasViewerScreen;
