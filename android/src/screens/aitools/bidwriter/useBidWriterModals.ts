/**
 * BidWriter Modal 状态管理 Hook
 * 统一管理所有弹窗的显示/隐藏状态
 */
import { useState, useCallback } from 'react';
import { useBidWriterStore } from '@/stores/useBidWriterStore';

export type KnowledgeUploadType = 'doc' | 'image' | 'table' | 'other';

export interface ModalState {
  modelModalVisible: boolean;
  styleModalVisible: boolean;
  configModalVisible: boolean;
  knowledgeModalVisible: boolean;
  knowledgeUploadModalVisible: boolean;
  knowledgeUploadType: KnowledgeUploadType;
}

export interface ModalActions {
  // 模型选择弹窗
  openModelModal: () => void;
  closeModelModal: () => void;
  
  // 样式选择弹窗
  openStyleModal: () => void;
  closeStyleModal: () => void;
  
  // 配置弹窗
  openConfigModal: () => void;
  closeConfigModal: () => void;
  
  // 知识库弹窗
  openKnowledgeModal: () => void;
  closeKnowledgeModal: () => void;
  
  // 知识库上传弹窗
  openKnowledgeUploadModal: (type: KnowledgeUploadType) => void;
  closeKnowledgeUploadModal: () => void;
}

export interface KnowledgeHelpers {
  docFiles: string[];
  imageFiles: string[];
  tableFiles: string[];
  otherFiles: string[];
  getSelectedFileNames: (type: KnowledgeUploadType) => string[];
  handleToggleFileByName: (fileName: string) => void;
  handleDeleteKnowledge: (fileName: string) => void;
  handleRenameKnowledge: (oldName: string, newName: string) => void;
  handleKnowledgeUpload: (type: KnowledgeUploadType) => Promise<void>;
  knowledgeUploading: boolean;
}

export const useBidWriterModals = (): ModalState & ModalActions & KnowledgeHelpers => {
  // Modal 可见状态
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [styleModalVisible, setStyleModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false);
  const [knowledgeUploadModalVisible, setKnowledgeUploadModalVisible] = useState(false);
  const [knowledgeUploadType, setKnowledgeUploadType] = useState<KnowledgeUploadType>('doc');

  // 从 store 获取知识库相关数据
  const {
    docFiles: docFilesRaw,
    imageFiles: imageFilesRaw,
    tableFiles: tableFilesRaw,
    otherFiles: otherFilesRaw,
    selectedKnowledgeFilePaths,
    knowledgeUploading,
    refreshKnowledgeList,
    uploadKnowledge,
    deleteKnowledge,
    renameKnowledge,
    toggleKnowledgeFile,
    getFilePathByName,
  } = useBidWriterStore();

  // 转换为文件名数组（添加空值保护）
  const docFiles = (docFilesRaw || []).map(f => f.name);
  const imageFiles = (imageFilesRaw || []).map(f => f.name);
  const tableFiles = (tableFilesRaw || []).map(f => f.name);
  const otherFiles = (otherFilesRaw || []).map(f => f.name);

  // ==================== Modal Actions ====================

  const openModelModal = useCallback(() => setModelModalVisible(true), []);
  const closeModelModal = useCallback(() => setModelModalVisible(false), []);

  const openStyleModal = useCallback(() => setStyleModalVisible(true), []);
  const closeStyleModal = useCallback(() => setStyleModalVisible(false), []);

  const openConfigModal = useCallback(() => setConfigModalVisible(true), []);
  const closeConfigModal = useCallback(() => setConfigModalVisible(false), []);

  const openKnowledgeModal = useCallback(() => {
    refreshKnowledgeList();
    setKnowledgeModalVisible(true);
  }, [refreshKnowledgeList]);
  const closeKnowledgeModal = useCallback(() => setKnowledgeModalVisible(false), []);

  const openKnowledgeUploadModal = useCallback((type: KnowledgeUploadType) => {
    setKnowledgeUploadType(type);
    setKnowledgeUploadModalVisible(true);
  }, []);
  const closeKnowledgeUploadModal = useCallback(() => setKnowledgeUploadModalVisible(false), []);

  // ==================== Knowledge Helpers ====================

  const getSelectedFileNames = useCallback((type: KnowledgeUploadType): string[] => {
    const filesRaw = type === 'doc' ? docFilesRaw : type === 'image' ? imageFilesRaw : type === 'table' ? tableFilesRaw : otherFilesRaw;
    return filesRaw
      .filter(f => selectedKnowledgeFilePaths.includes(f.file_path))
      .map(f => f.name);
  }, [docFilesRaw, imageFilesRaw, tableFilesRaw, otherFilesRaw, selectedKnowledgeFilePaths]);

  const handleToggleFileByName = useCallback((fileName: string) => {
    const filePath = getFilePathByName(fileName, knowledgeUploadType);
    if (filePath) {
      toggleKnowledgeFile(filePath);
    }
  }, [getFilePathByName, knowledgeUploadType, toggleKnowledgeFile]);

  const handleDeleteKnowledge = useCallback((fileName: string) => {
    deleteKnowledge(fileName, knowledgeUploadType);
  }, [deleteKnowledge, knowledgeUploadType]);

  const handleRenameKnowledge = useCallback((oldName: string, newName: string) => {
    renameKnowledge(oldName, newName, knowledgeUploadType);
  }, [renameKnowledge, knowledgeUploadType]);

  const handleKnowledgeUpload = useCallback(async (type: KnowledgeUploadType) => {
    await uploadKnowledge(type);
  }, [uploadKnowledge]);

  return {
    // State
    modelModalVisible,
    styleModalVisible,
    configModalVisible,
    knowledgeModalVisible,
    knowledgeUploadModalVisible,
    knowledgeUploadType,
    
    // Actions
    openModelModal,
    closeModelModal,
    openStyleModal,
    closeStyleModal,
    openConfigModal,
    closeConfigModal,
    openKnowledgeModal,
    closeKnowledgeModal,
    openKnowledgeUploadModal,
    closeKnowledgeUploadModal,
    
    // Knowledge Helpers
    docFiles,
    imageFiles,
    tableFiles,
    otherFiles,
    getSelectedFileNames,
    handleToggleFileByName,
    handleDeleteKnowledge,
    handleRenameKnowledge,
    handleKnowledgeUpload,
    knowledgeUploading,
  };
};

export default useBidWriterModals;
