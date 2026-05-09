import { create } from 'zustand';
import { Alert } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { bidWriterApi } from '@/services/bidWriter';
import type { KnowledgeListItem } from '@/services/bidWriter';

export type KnowledgeType = 'doc' | 'image' | 'table' | 'other';

interface KnowledgeFile {
  name: string;
  file_path: string;
}

interface BidWriterState {
  // 知识库文件
  docFiles: KnowledgeFile[];
  imageFiles: KnowledgeFile[];
  tableFiles: KnowledgeFile[];
  otherFiles: KnowledgeFile[];
  selectedKnowledgeFilePaths: string[];
  knowledgeUploading: boolean;

  // 配置状态
  selectedModel: string;
  selectedCover: string;
  selectedLayout: string;
  hasImages: boolean;
  hasPageBorder: boolean;
  selectedColor: string;
  wordCount: number;
  autoWebImage: boolean;
  generateFlowchart: boolean;
  autoProofread: boolean;
  darkBidMode: boolean;

  // Actions
  refreshKnowledgeList: () => Promise<void>;
  uploadKnowledge: (type: KnowledgeType) => Promise<boolean>;
  importSharedFiles: (files: Array<{ uri: string; name: string; mimeType?: string }>) => Promise<boolean>;
  deleteKnowledge: (fileName: string, type: KnowledgeType) => Promise<boolean>;
  renameKnowledge: (oldName: string, newName: string, type: KnowledgeType) => Promise<boolean>;
  toggleKnowledgeFile: (filePath: string) => void;
  setSelectedKnowledgeFilePaths: (paths: string[]) => void;
  getFilePathByName: (fileName: string, type: KnowledgeType) => string | undefined;

  // Config setters
  setSelectedModel: (model: string) => void;
  setSelectedCover: (cover: string) => void;
  setSelectedLayout: (layout: string, hasImages?: boolean, hasPageBorder?: boolean) => void;
  setHasImages: (value: boolean) => void;
  setHasPageBorder: (value: boolean) => void;
  setSelectedColor: (color: string) => void;
  setWordCount: (count: number) => void;
  setAutoWebImage: (value: boolean) => void;
  setGenerateFlowchart: (value: boolean) => void;
  setAutoProofread: (value: boolean) => void;
  setDarkBidMode: (value: boolean) => void;

  // Load user config from backend
  loadUserConfig: (userId: number) => Promise<void>;
}

export const useBidWriterStore = create<BidWriterState>((set, get) => ({
  // Initial state
  docFiles: [],
  imageFiles: [],
  tableFiles: [],
  otherFiles: [],
  selectedKnowledgeFilePaths: [],
  knowledgeUploading: false,

  selectedModel: 'qwen',
  selectedCover: 'cover1',
  selectedLayout: 'image',
  hasImages: true,
  hasPageBorder: false,
  selectedColor: 'black',
  wordCount: 30000,
  autoWebImage: true,
  generateFlowchart: true,
  autoProofread: false,
  darkBidMode: false,

  refreshKnowledgeList: async () => {
    try {
      console.log('[BidWriterStore] Refreshing knowledge list...');
      const list = await bidWriterApi.knowledgeList();
      console.log('[BidWriterStore] Knowledge list response:', JSON.stringify(list));
      console.log('[BidWriterStore] Response type:', typeof list, 'keys:', list ? Object.keys(list) : 'null');

      // 兼容可能的嵌套结构
      const data = (list as any)?.data || list;
      console.log('[BidWriterStore] Extracted data:', JSON.stringify(data));

      const docFiles = (data?.doc || []).map((i: KnowledgeListItem) => ({
        name: i.name,
        file_path: i.file_path,
      }));
      const imageFiles = (data?.image || []).map((i: KnowledgeListItem) => ({
        name: i.name,
        file_path: i.file_path,
      }));
      const tableFiles = (data?.table || []).map((i: KnowledgeListItem) => ({
        name: i.name,
        file_path: i.file_path,
      }));
      const otherFiles = (data?.other || []).map((i: KnowledgeListItem) => ({
        name: i.name,
        file_path: i.file_path,
      }));

      console.log('[BidWriterStore] Parsed files:', { docFiles, imageFiles, tableFiles, otherFiles });
      console.log('[BidWriterStore] Setting state with docFiles count:', docFiles.length);
      set({ docFiles, imageFiles, tableFiles, otherFiles });
    } catch (err) {
      console.error('[BidWriterStore] 获取知识库列表失败:', err);
      console.error('[BidWriterStore] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      // 出错时重置为空数组，避免 undefined 导致渲染错误
      set({ docFiles: [], imageFiles: [], tableFiles: [], otherFiles: [] });
    }
  },

  importSharedFiles: async (files: Array<{ uri: string; name: string; mimeType?: string }>) => {
    if (!files || files.length === 0) return false;

    const pickType = (f: { name: string; mimeType?: string }): KnowledgeType => {
      const name = (f.name || '').toLowerCase();
      const mime = (f.mimeType || '').toLowerCase();
      if (mime.startsWith('image/')) return 'image';
      if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'table';
      return 'doc';
    };

    try {
      set({ knowledgeUploading: true });
      for (const f of files) {
        const knowledgeType = pickType(f);
        const uri = f.uri;
        if (!uri) {
          throw new Error('无法读取文件路径');
        }
        await bidWriterApi.knowledgeUpload(
          {
            uri,
            name: f.name || 'document',
            type: f.mimeType || 'application/octet-stream',
          },
          knowledgeType,
        );
      }

      await get().refreshKnowledgeList();
      await new Promise(resolve => setTimeout(resolve, 100));
      Alert.alert('导入成功', `已导入 ${files.length} 个文件到知识库`);
      return true;
    } catch (err: any) {
      console.error('[BidWriterStore] 导入分享文件失败:', err);
      Alert.alert('导入失败', err?.message || '文件导入失败，请重试');
      return false;
    } finally {
      set({ knowledgeUploading: false });
    }
  },

  uploadKnowledge: async (type: KnowledgeType) => {
    console.log('[BidWriterStore] uploadKnowledge called, type:', type);
    try {
      let fileTypes: string[] = [];
      if (type === 'doc') {
        fileTypes = [DocumentPicker.types.pdf, DocumentPicker.types.docx, DocumentPicker.types.doc];
      } else if (type === 'image') {
        fileTypes = [DocumentPicker.types.images];
      } else if (type === 'table') {
        fileTypes = [DocumentPicker.types.xls, DocumentPicker.types.xlsx, DocumentPicker.types.csv];
      } else {
        // 其它类：txt、md、ppt等
        fileTypes = [DocumentPicker.types.plainText, DocumentPicker.types.ppt, DocumentPicker.types.pptx, DocumentPicker.types.allFiles];
      }

      console.log('[BidWriterStore] Opening DocumentPicker...');
      const result = await DocumentPicker.pick({
        type: fileTypes,
        allowMultiSelection: true,
        copyTo: 'cachesDirectory',
      });
      console.log('[BidWriterStore] DocumentPicker result:', JSON.stringify(result, null, 2));

      if (result && result.length > 0) {
        set({ knowledgeUploading: true });

        for (const f of result) {
          const uri = (f as any).fileCopyUri || f.uri;
          console.log('[BidWriterStore] Uploading file:', f.name, 'uri:', uri);
          if (!uri) {
            throw new Error('无法读取文件路径');
          }
          const uploadResult = await bidWriterApi.knowledgeUpload(
            {
              uri,
              name: f.name || 'document',
              type: f.type || 'application/octet-stream',
            },
            type,
          );
          console.log('[BidWriterStore] Upload result:', JSON.stringify(uploadResult));
        }

        console.log('[BidWriterStore] Refreshing knowledge list after upload...');
        await get().refreshKnowledgeList();
        
        // 等待一个渲染周期后再弹出 Alert，确保列表已更新
        await new Promise(resolve => setTimeout(resolve, 100));
        Alert.alert('上传成功', `已上传 ${result.length} 个文件`);
        return true;
      }
      return false;
    } catch (err: any) {
      // 用户取消选择不算错误，静默处理
      if (DocumentPicker.isCancel(err)) {
        console.log('[BidWriterStore] User cancelled picker');
        return false;
      }
      console.error('[BidWriterStore] Error:', err);
      Alert.alert('上传失败', err?.message || '文件上传失败，请重试');
      return false;
    } finally {
      set({ knowledgeUploading: false });
    }
  },

  toggleKnowledgeFile: (filePath: string) => {
    const { selectedKnowledgeFilePaths } = get();
    if (selectedKnowledgeFilePaths.includes(filePath)) {
      set({
        selectedKnowledgeFilePaths: selectedKnowledgeFilePaths.filter(p => p !== filePath),
      });
    } else {
      set({
        selectedKnowledgeFilePaths: [...selectedKnowledgeFilePaths, filePath],
      });
    }
  },

  setSelectedKnowledgeFilePaths: (paths: string[]) => {
    set({ selectedKnowledgeFilePaths: paths });
  },

  getFilePathByName: (fileName: string, type: KnowledgeType) => {
    const { docFiles, imageFiles, tableFiles, otherFiles } = get();
    const files = type === 'doc' ? docFiles : type === 'image' ? imageFiles : type === 'table' ? tableFiles : otherFiles;
    return files.find(f => f.name === fileName)?.file_path;
  },

  deleteKnowledge: async (fileName: string, type: KnowledgeType) => {
    const filePath = get().getFilePathByName(fileName, type);
    if (!filePath) {
      Alert.alert('错误', '找不到该文件');
      return false;
    }

    try {
      await bidWriterApi.knowledgeDelete(filePath);
      await get().refreshKnowledgeList();

      // 从已选中列表中移除
      const { selectedKnowledgeFilePaths } = get();
      if (selectedKnowledgeFilePaths.includes(filePath)) {
        set({
          selectedKnowledgeFilePaths: selectedKnowledgeFilePaths.filter(p => p !== filePath),
        });
      }
      return true;
    } catch (err: any) {
      console.error('[BidWriterStore] 删除文件失败:', err);
      Alert.alert('删除失败', err?.message || '文件删除失败，请重试');
      return false;
    }
  },

  renameKnowledge: async (oldName: string, newName: string, type: KnowledgeType) => {
    const oldFilePath = get().getFilePathByName(oldName, type);
    if (!oldFilePath) {
      Alert.alert('错误', '找不到该文件');
      return false;
    }

    // 立即更新本地状态(乐观更新)
    const updateLocalState = () => {
      const { docKnowledgeFiles, imageKnowledgeFiles, tableKnowledgeFiles, otherKnowledgeFiles } = get();
      
      const updateFileList = (files: typeof docKnowledgeFiles) => {
        if (!files || !Array.isArray(files)) {
          return [];
        }
        return files.map(f => {
          if (f.name === oldName) {
            // 构造新的文件路径
            const pathParts = f.file_path.split('/');
            pathParts[pathParts.length - 1] = newName;
            return {
              ...f,
              name: newName,
              file_path: pathParts.join('/'),
            };
          }
          return f;
        });
      };

      switch (type) {
        case 'doc':
          set({ docKnowledgeFiles: updateFileList(docKnowledgeFiles) });
          break;
        case 'image':
          set({ imageKnowledgeFiles: updateFileList(imageKnowledgeFiles) });
          break;
        case 'table':
          set({ tableKnowledgeFiles: updateFileList(tableKnowledgeFiles) });
          break;
        case 'other':
          set({ otherKnowledgeFiles: updateFileList(otherKnowledgeFiles) });
          break;
      }

      // 更新已选中列表中的文件路径
      const { selectedKnowledgeFilePaths } = get();
      const pathParts = oldFilePath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newFilePath = pathParts.join('/');
      
      if (selectedKnowledgeFilePaths.includes(oldFilePath)) {
        set({
          selectedKnowledgeFilePaths: selectedKnowledgeFilePaths.map(p => p === oldFilePath ? newFilePath : p),
        });
      }
    };

    // 立即更新本地状态
    updateLocalState();

    try {
      // 调用后端API重命名
      await bidWriterApi.knowledgeRename(oldFilePath, newName);
      // 不需要 refreshKnowledgeList(),因为本地状态已经更新
      return true;
    } catch (err: any) {
      console.error('[BidWriterStore] 重命名文件失败:', err);
      // 回滚:重新获取列表
      await get().refreshKnowledgeList();
      Alert.alert('重命名失败', err?.message || '文件重命名失败，请重试');
      return false;
    }
  },

  // Config setters
  setSelectedModel: (model: string) => set({ selectedModel: model }),
  setSelectedCover: (cover: string) => set({ selectedCover: cover }),
  setSelectedLayout: (layout: string, hasImages?: boolean, hasPageBorder?: boolean) => {
    const updates: Partial<BidWriterState> = { selectedLayout: layout };
    if (hasImages !== undefined) updates.hasImages = hasImages;
    if (hasPageBorder !== undefined) updates.hasPageBorder = hasPageBorder;
    set(updates);
  },
  setHasImages: (value: boolean) => set({ hasImages: value }),
  setHasPageBorder: (value: boolean) => set({ hasPageBorder: value }),
  setSelectedColor: (color: string) => set({ selectedColor: color }),
  setWordCount: (count: number) => set({ wordCount: count }),
  setAutoWebImage: (value: boolean) => set({ autoWebImage: value }),
  setGenerateFlowchart: (value: boolean) => set({ generateFlowchart: value }),
  setAutoProofread: (value: boolean) => set({ autoProofread: value }),
  setDarkBidMode: (value: boolean) => set({ darkBidMode: value }),

  loadUserConfig: async (userId: number) => {
    try {
      const config = await bidWriterApi.getConfig(userId);

      set({
        wordCount: config.default_word_count || 30000,
        darkBidMode: config.default_dark_bid_mode || false,
        autoWebImage: config.auto_web_image !== false,
        generateFlowchart: config.generate_flowchart !== false,
        autoProofread: config.auto_proofread === true,
        selectedCover: config.default_cover_style || 'cover1',
        selectedLayout: config.default_layout_style || 'image',
        hasImages: config.has_images !== false,
        hasPageBorder: config.has_page_border === true,
        selectedColor: config.default_color_scheme || 'black',
      });

      // Model matching logic would need AI_MODELS imported
    } catch (err) {
      console.error('[BidWriterStore] 加载用户配置失败:', err);
    }
  },
}));
