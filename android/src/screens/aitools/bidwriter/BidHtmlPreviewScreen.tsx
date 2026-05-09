import React, { FC, useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { ChevronLeft, Upload } from 'lucide-react-native';
import type { RootStackScreenProps } from '@/navigation/types';
import { bidWriterApi } from '@/services/bidWriter';
import { ExportModal } from '@/components/bidwriter/ExportModal';

type Props = RootStackScreenProps<'BidHtmlPreview'>;

const BidHtmlPreviewScreen: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { bidId } = route.params || {};

  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportFilePath, setExportFilePath] = useState('');

  useEffect(() => {
    if (!bidId) {
      setLoading(false);
      setError('标书信息异常');
      return;
    }
    bidWriterApi.previewHtml(bidId)
      .then((res: any) => {
        const html = typeof res === 'string' ? res : res?.data || '';
        if (html) {
          setHtmlContent(html);
          setLoading(false);
        } else {
          setError('预览内容为空');
          setLoading(false);
        }
      })
      .catch((err: any) => {
        setError(err?.message || '加载预览失败');
        setLoading(false);
      });
  }, [bidId]);

  const handleExport = useCallback(async () => {
    if (!bidId || exporting) return;
    setExporting(true);
    try {
      const response = await bidWriterApi.exportDocument(bidId, 'docx');
      let docxData: any = response;
      if (response && typeof response === 'object' && response.data) {
        docxData = response.data;
      }
      const fileName = `标书_${new Date().getTime()}.docx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      let base64Data: string;
      if (typeof docxData === 'string') {
        base64Data = docxData;
      } else if (docxData instanceof ArrayBuffer || ArrayBuffer.isView(docxData)) {
        base64Data = Buffer.from(new Uint8Array(docxData)).toString('base64');
      } else {
        base64Data = Buffer.from(docxData).toString('base64');
      }
      await RNFS.writeFile(filePath, base64Data, 'base64');
      setExportFileName(fileName);
      setExportFilePath(filePath);
      setExportModalVisible(true);
    } catch (err: any) {
      Alert.alert('导出失败', err?.message || '请重试');
    } finally {
      setExporting(false);
    }
  }, [bidId, exporting]);

  const handleRetry = useCallback(() => {
    if (!bidId) return;
    setError('');
    setLoading(true);
    setHtmlContent('');
    bidWriterApi.previewHtml(bidId)
      .then((res: any) => {
        const html = typeof res === 'string' ? res : res?.data || '';
        if (html) {
          setHtmlContent(html);
          setLoading(false);
        } else {
          setError('预览内容为空');
          setLoading(false);
        }
      })
      .catch((err: any) => {
        setError(err?.message || '加载预览失败');
        setLoading(false);
      });
  }, [bidId]);

  return (
    <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <View style={[styles.headerSide, styles.headerSideLeft]}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">标书预览</Text>
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <TouchableOpacity style={styles.exportButton} onPress={handleExport} activeOpacity={0.7} disabled={exporting}>
              <Upload size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.exportText}>{exporting ? '导出中…' : '导出'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.headerDivider} />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.statusText}>加载预览中...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.7}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ html: htmlContent }}
          originWhitelist={['*']}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={true}
          onError={() => setError('页面加载异常')}
        />
      )}

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        fileName={exportFileName}
        filePath={exportFilePath}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerSide: {
    width: 80,
  },
  headerSideLeft: {
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default BidHtmlPreviewScreen;
