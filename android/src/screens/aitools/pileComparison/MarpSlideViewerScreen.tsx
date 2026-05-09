/**
 * MarpSlideViewerScreen — 全屏幻灯片报告查看器（Android）
 *   - 顶部原生标题栏：左侧返回、右侧导出
 *   - 加载 assets/marp_viewer.html，marked.js 本地离线加载
 *   - onLoadEnd 后通过 injectJavaScript 注入 markdown 内容
 *   - 底部有翻页控件（HTML 内部实现）
 */
import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import WebView from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Upload } from 'lucide-react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import type { PileComparisonStackScreenProps } from './PileComparisonStack';
import { usePileComparisonContext } from './PileComparisonContext';
import { pileComparisonApi } from './pileComparisonApi';

function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() && !c.match(/^[-:\s]+$/));
      if (!cells.length) return '';
      const tag = 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table border="1">$&</table>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\[\[FIGURE:([^|\]]+)\|url=([^\]]+)\]\]/g, '<figure><img src="$2" alt="$1" /><figcaption>$1</figcaption></figure>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  return `<p>${html}</p>`;
}

type Props = PileComparisonStackScreenProps<'ReportViewer'>;

const MarpSlideViewerScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { reportId } = route.params || {};
  const { comparisonReports, attachments, initialReportId, loading: contextLoading, bidId } = usePileComparisonContext();
  const effectiveReportId = reportId || initialReportId;

  const report = (comparisonReports || []).find(r => String(r.id) === String(effectiveReportId));
  const title = String(report?.title || '对比报告');
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const loading = contextLoading || !report;

  // Process [[FIGURE:xxx|kind=yyy]] → [[FIGURE:xxx|url=zzz]]
  const webContent = useMemo(() => {
    const raw = String(report?.markdown || '').trim();
    if (!raw) return '';
    return raw.replace(/\[\[FIGURE:([^|\]]+)\|kind=([^\]]+)\]\]/g, (match, figTitle, kind) => {
      const attArr = Array.isArray(attachments) ? attachments : [];
      const att = attArr.find((a: any) => a?.kind === kind);
      if (!att) return match;
      let url = att.uri || '';
      if ((att as any)?._base64) {
        url = `data:image/jpeg;base64,${(att as any)._base64}`;
      } else if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        url = `file://${url}`;
      }
      return `[[FIGURE:${figTitle}|url=${url}]]`;
    });
  }, [report?.markdown, attachments]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleExport = useCallback(async () => {
    const content = String(webContent || '').trim();
    if (!content) {
      Alert.alert('提示', '暂无可导出的内容');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      console.log('[MarpSlideViewer] 开始导出PDF，内容长度:', content.length);
      const pdfBytes = await pileComparisonApi.exportComparisonReportPdf({ title, markdown: content });
      console.log('[MarpSlideViewer] PDF返回数据类型:', typeof pdfBytes, '长度:', (pdfBytes as any)?.length || 'unknown');
      if (!pdfBytes || (pdfBytes as any).length === 0) {
        throw new Error('PDF 数据为空');
      }
      const fileName = `${String(title || '对比报告')}`.replace(/[\\/:*?"<>|\n\r\t]/g, '_') + '.pdf';
      const cacheDir = RNFS.CachesDirectoryPath;
      const filePath = `${cacheDir}/${fileName}`;
      const base64Data = Buffer.from(pdfBytes as any).toString('base64');
      await RNFS.writeFile(filePath, base64Data, 'base64');
      const fileUrl = Platform.OS === 'android' ? `file://${filePath}` : filePath;
      console.log('[MarpSlideViewer] PDF文件已写入:', filePath);
      await Share.open({
        url: String(fileUrl),
        filename: String(fileName),
        type: 'application/pdf',
        title: String(title),
        failOnCancel: false,
      });
    } catch (e: any) {
      const msg = String(e?.message || e || '').trim();
      console.log('[MarpSlideViewer] PDF导出异常:', msg);
      if (msg && /User did not share|cancel/i.test(msg)) return;
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.6;color:#333}h1,h2,h3{color:#1a1a2e}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5}img{max-width:100%;height:auto}blockquote{border-left:4px solid #ddd;margin:0;padding-left:16px;color:#666}code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:0.9em}</style></head><body>${simpleMarkdownToHtml(content)}</body></html>`;
      const htmlFileName = `${String(title || '对比报告')}`.replace(/[\\/:*?"<>|\n\r\t]/g, '_') + '.html';
      const cacheDir = RNFS.CachesDirectoryPath;
      const htmlFilePath = `${cacheDir}/${htmlFileName}`;
      await RNFS.writeFile(htmlFilePath, htmlContent, 'utf8');
      const htmlFileUrl = Platform.OS === 'android' ? `file://${htmlFilePath}` : htmlFilePath;
      Alert.alert('PDF 导出失败', `${msg || '暂时无法生成PDF'}，已导出为 HTML 文件`, [
        { text: '取消', style: 'cancel' },
        {
          text: '分享 HTML',
          onPress: async () => {
            try {
              await Share.open({
                url: String(htmlFileUrl),
                filename: String(htmlFileName),
                type: 'text/html',
                title: String(title),
                failOnCancel: false,
              });
            } catch {}
          },
        },
      ]);
    } finally {
      setExporting(false);
    }
  }, [webContent, exporting, title]);

  // Inject markdown after WebView loads the local HTML
  const handleLoadEnd = useCallback(() => {
    setWebViewReady(true);
    if (webContent && webViewRef.current) {
      const jsonContent = JSON.stringify(webContent);
      const js = `(function(){
        var md = ${jsonContent};
        var attempts = 0;
        var maxAttempts = 75;
        function tryLoad() {
          attempts++;
          if (typeof marked !== 'undefined' && typeof marked.parse === 'function' && typeof initSlides === 'function') {
            initSlides(md);
            goToSlide(0);
          } else if (attempts < maxAttempts) {
            setTimeout(tryLoad, 200);
          }
        }
        tryLoad();
      })(); true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [webContent]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event?.nativeEvent?.data || '{}');
      if (data.type === 'close') {
        navigation.goBack();
      }
    } catch {}
  }, [navigation]);

  // Load from local assets file — marked.min.js is also in assets
  const source = Platform.OS === 'android'
    ? { uri: 'file:///android_asset/marp_viewer.html' }
    : { uri: 'marp_viewer.html' };

  return (
    <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 顶部标题栏 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
        </View>

        <TouchableOpacity style={styles.exportButton} onPress={handleExport} activeOpacity={0.7} disabled={exporting}>
          <Upload size={16} color="rgba(255,255,255,0.85)" />
          <Text style={styles.exportText}>{exporting ? '导出中…' : '导出'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>加载报告中...</Text>
        </View>
      ) : (
      <>
      {/* WebView */}
      <View style={styles.webviewWrap}>
        <WebView
          ref={webViewRef}
          source={source}
          originWhitelist={['*']}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          style={styles.webview}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
        />
      </View>
      </>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  exportText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  webviewWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});

export default MarpSlideViewerScreen;

