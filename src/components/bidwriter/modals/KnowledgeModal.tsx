import { Loading } from '@/components/common/Loading';
import React, { FC, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { X, ChevronRight, FileUp, Image as ImageIcon, Table, FileText, Check, Trash2, Edit3, Square, CheckSquare, FolderOpen } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

type KnowledgeType = 'doc' | 'image' | 'table' | 'other';

interface KnowledgeModalProps {
  visible: boolean;
  onClose: () => void;
  docFiles: string[];
  imageFiles: string[];
  tableFiles: string[];
  otherFiles?: string[];
  onSelectType: (type: KnowledgeType) => void;
}

export const KnowledgeModal: FC<KnowledgeModalProps> = ({
  visible,
  onClose,
  docFiles,
  imageFiles,
  tableFiles,
  otherFiles = [],
  onSelectType,
}) => {
  const { colors, isDark } = useTheme();
  const knowledgeTypes = [
    {
      type: 'doc' as KnowledgeType,
      name: '文档类',
      desc: docFiles.length > 0 ? `已上传${docFiles.length} 个文件` : '支持PDF、Word文档',
      icon: FileUp,
      color: '#B20000',
    },
    {
      type: 'image' as KnowledgeType,
      name: '图片类',
      desc: imageFiles.length > 0 ? `已上传${imageFiles.length} 个文件` : '支持JPG、PNG图片',
      icon: ImageIcon,
      color: '#16A34A',
    },
    {
      type: 'table' as KnowledgeType,
      name: '表格类',
      desc: tableFiles.length > 0 ? `已上传${tableFiles.length} 个文件` : '支持Excel、CSV表格',
      icon: Table,
      color: '#FF6B00',
    },
    {
      type: 'other' as KnowledgeType,
      name: '其它类',
      desc: otherFiles.length > 0 ? `已上传${otherFiles.length} 个文件` : '支持TXT、MD、PPT等其它格式',
      icon: FolderOpen,
      color: '#8B5CF6',
    },
  ];

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.bottomSheet, {
          transform: [{ translateY: slideAnim }],
          backgroundColor: colors.surface,
          borderColor: isDark ? 'rgba(178, 0, 0, 0.3)' : colors.border,
        }]}>
          <View style={[styles.bottomSheetHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>私有知识库</Text>
              <Text style={[styles.bottomSheetSubtitle, { color: colors.textMuted }]}>上传资料仅用于LLM私有推理,自主可控</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.bottomSheetContent}>
            {knowledgeTypes.map((item) => {
              const IconComponent = item.icon;
              return (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.knowledgeItem, { borderBottomColor: colors.border }]}
                  onPress={() => onSelectType(item.type)}
                >
                  <View style={[styles.knowledgeUploadIcon, { backgroundColor: item.color }]}>
                    <IconComponent size={20} color="#fff" />
                  </View>
                  <View style={styles.knowledgeInfo}>
                    <Text style={[styles.knowledgeName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.knowledgeDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface KnowledgeUploadModalProps {
  visible: boolean;
  onClose: () => void;
  uploadType: KnowledgeType;
  docFiles: string[];
  imageFiles: string[];
  tableFiles: string[];
  otherFiles?: string[];
  onUpload: (type: KnowledgeType) => void;
  uploading?: boolean;
  selectedFiles?: string[];
  onToggleFile?: (fileName: string) => void;
  onConfirm?: () => void;
  onDeleteFile?: (fileName: string) => void;
  onRenameFile?: (oldName: string, newName: string) => void;
}

export const KnowledgeUploadModal: FC<KnowledgeUploadModalProps> = ({
  visible,
  onClose,
  uploadType,
  docFiles,
  imageFiles,
  tableFiles,
  otherFiles = [],
  onUpload,
  uploading,
  selectedFiles,
  onToggleFile,
  onConfirm,
  onDeleteFile,
  onRenameFile,
}) => {
  const { colors, isDark } = useTheme();
  const [isEditMode, setIsEditMode] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const getTitle = () => {
    switch (uploadType) {
      case 'doc': return '文档知识';
      case 'image': return '图片知识';
      case 'table': return '表格知识';
      case 'other': return '其它知识';
      default: return '知识上传';
    }
  };

  const getFiles = () => {
    switch (uploadType) {
      case 'doc': return docFiles;
      case 'image': return imageFiles;
      case 'table': return tableFiles;
      case 'other': return otherFiles;
      default: return [];
    }
  };

  const files = getFiles();

  const handleDelete = (fileName: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除"${fileName}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => onDeleteFile?.(fileName),
        },
      ]
    );
  };

  const handleStartRename = (fileName: string) => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    setRenamingFile(fileName);
    setNewFileName(nameWithoutExt);
  };

  const handleConfirmRename = () => {
    if (renamingFile && newFileName.trim()) {
      const ext = renamingFile.match(/\.[^/.]+$/)?.[0] || '';
      const fullNewName = newFileName.trim() + ext;
      onRenameFile?.(renamingFile, fullNewName);
    }
    setRenamingFile(null);
    setNewFileName('');
  };

  const handleCancelRename = () => {
    setRenamingFile(null);
    setNewFileName('');
  };

  const handleClose = () => {
    setIsEditMode(false);
    setRenamingFile(null);
    onClose();
  };

  const handleConfirm = () => {
    setIsEditMode(false);
    onConfirm?.();
  };

  const selectedCount = selectedFiles?.length || 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.centerModalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.centerModal, {
              backgroundColor: colors.surface,
              borderColor: isDark ? 'rgba(178, 0, 0, 0.3)' : colors.border,
            }]}>
              <View style={[styles.centerModalHeader, { borderBottomColor: colors.border }]}>
                {files.length > 0 ? (
                  <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)}>
                    <Text style={[styles.headerBtn, { color: isEditMode ? '#B20000' : colors.textMuted }, isEditMode && styles.headerBtnActive]}>
                      {isEditMode ? '完成' : '编辑'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 40 }} />
                )}
                <View style={styles.titleContainer}>
                  <Text style={[styles.centerModalTitle, { color: colors.text }]}>{getTitle()}</Text>
                  <Text style={[styles.centerModalSubtitle, { color: colors.textMuted }]}>文件名改为相应内容效果更好</Text>
                </View>
                <TouchableOpacity disabled={!!uploading} onPress={() => onUpload(uploadType)}>
                  {uploading ? (
                    <Loading size="small" color="#B20000" />
                  ) : (
                    <Text style={styles.uploadBtn}>上传</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.centerModalContent}>
                {files.length > 0 ? (
                  <ScrollView style={styles.fileList} showsVerticalScrollIndicator={false}>
                    {files.map((file, index) => {
                      const isSelected = !!selectedFiles?.includes(file);
                      const isRenaming = renamingFile === file;

                      if (isRenaming) {
                        return (
                          <View key={index} style={[styles.fileItem, styles.fileItemRename, { borderBottomColor: colors.border }]}>
                            <TextInput
                              style={[styles.renameInput, { color: colors.text }]}
                              value={newFileName}
                              onChangeText={setNewFileName}
                              autoFocus
                              selectTextOnFocus
                              onSubmitEditing={handleConfirmRename}
                            />
                            <TouchableOpacity onPress={handleConfirmRename} style={styles.renameAction}>
                              <Check size={18} color="#16A34A" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCancelRename} style={styles.renameAction}>
                              <X size={18} color="#999" />
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[styles.fileItem, { borderBottomColor: colors.border }]}
                          onPress={() => !isEditMode && onToggleFile?.(file)}
                          disabled={isEditMode}
                        >
                          {isEditMode ? (
                            <>
                              <FileText size={16} color={colors.textMuted} />
                              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{file}</Text>
                              <TouchableOpacity onPress={() => handleStartRename(file)} style={styles.editAction}>
                                <Edit3 size={16} color={colors.textMuted} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDelete(file)} style={styles.editAction}>
                                <Trash2 size={16} color="#EF4444" />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <FileText size={16} color={colors.textMuted} />
                              <Text style={[styles.fileName, { color: isSelected ? '#B20000' : colors.text }, isSelected && styles.fileNameSelected]} numberOfLines={1}>
                                {file}
                              </Text>
                              {isSelected ? (
                                <CheckSquare size={18} color="#B20000" />
                              ) : (
                                <Square size={18} color={colors.textMuted} />
                              )}
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyUpload}
                    disabled={!!uploading}
                    onPress={() => onUpload(uploadType)}
                  >
                    <FileUp size={40} color={colors.textMuted} />
                    <Text style={[styles.emptyUploadText, { color: colors.text }]}>点击上传知识</Text>
                    <Text style={[styles.emptyUploadHint, { color: colors.textMuted }]}>知识决定专属标书质量</Text>
                  </TouchableOpacity>
                )}
              </View>

              {files.length > 0 && (
                <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                  {isEditMode ? (
                    <View style={styles.editModeButtons}>
                      <TouchableOpacity
                        style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderColor: colors.border }]}
                        onPress={handleClose}
                      >
                        <Text style={[styles.cancelBtnText, { color: colors.text }]}>取消</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: '#B20000', borderColor: '#B20000' }]}
                        onPress={() => setIsEditMode(false)}
                      >
                        <Text style={styles.saveBtnText}>保存</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.confirmBtn, selectedCount === 0 ? { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderColor: colors.border } : { backgroundColor: '#B20000', borderColor: '#B20000' }]}
                      onPress={handleConfirm}
                    >
                      <Text style={styles.confirmBtnText}>
                        {selectedCount > 0 ? `确定 (${selectedCount})` : '确定'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bottomSheetSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  bottomSheetContent: {
    padding: 20,
  },
  knowledgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  knowledgeUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  knowledgeInfo: {
    flex: 1,
  },
  knowledgeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  knowledgeDesc: {
    fontSize: 13,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerModal: {
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
  },
  centerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  centerModalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  centerModalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  uploadBtn: {
    fontSize: 14,
    color: '#B20000',
    fontWeight: '600',
  },
  centerModalContent: {
    paddingHorizontal: 16,
    minHeight: 200,
  },
  fileList: {
    maxHeight: 306,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  fileItemRename: {
    // 无 paddingVertical,间距由 renameInput 提供
  },
  fileName: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    paddingVertical: 12,
  },
  emptyUpload: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyUploadText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyUploadHint: {
    fontSize: 13,
    marginTop: 8,
  },
  headerBtn: {
    fontSize: 14,
  },
  headerBtnActive: {
    fontWeight: '600',
  },
  editAction: {
    padding: 8,
    marginLeft: 4,
  },
  renameInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,  // 与 fileName 保持一致
    marginRight: 8,
  },
  renameAction: {
    padding: 6,
  },
  fileNameSelected: {
    fontWeight: '500',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  confirmBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editModeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
