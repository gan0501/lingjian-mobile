/**
 * NoteTab V2 - 笔记Tab
 *
 * 功能：
 * - 笔记时间线（与跟进类似布局）
 * - 初始默认卡片（提示用户可以记录笔记）
 * - Markdown 渲染笔记内容
 * - 标签系统（重要/紧急）
 * - 新增/编辑/删除笔记
 * - 下拉刷新
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Trash2,
  FileText,
} from 'lucide-react-native';
import { DayColors } from '@/constants';
import { projectAgentApi, type Note } from '@/services';
import { useOverlay } from '@/components/overlay';

interface NoteTabProps {
  projectId: string;
  onRefreshRef: React.MutableRefObject<(() => void) | null>;
}

const NoteTab: React.FC<NoteTabProps> = ({ projectId, onRefreshRef }) => {
  const overlay = useOverlay();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const loadNotes = useCallback(async () => {
    try {
      const res = await projectAgentApi.getNotes(projectId);
      if (res?.data) {
        setNotes(res.data);
      }
    } catch (err) {
      console.warn('[NoteTab] 加载失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    onRefreshRef.current = loadNotes;
  }, [onRefreshRef, loadNotes]);

  const handleDelete = async (noteId: string) => {
    overlay.confirm({
      title: '删除笔记',
      message: '确定要删除这条笔记吗？',
      confirmText: '删除',
      onConfirm: async () => {
        try {
          await projectAgentApi.deleteNote({ note_id: noteId, project_id: projectId });
          overlay.toast.success('已删除');
          loadNotes();
        } catch (err) {
          overlay.toast.error('删除失败');
        }
      },
    });
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    try {
      await projectAgentApi.updateNote({
        note_id: noteId,
        project_id: projectId,
        content: editContent.trim(),
        tags: editTags,
      });
      overlay.toast.success('已更新');
      setEditingId(null);
      loadNotes();
    } catch (err) {
      overlay.toast.error('更新失败');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const getTypeInfo = (note: Note) => {
    const type = note.knowledge_type || 'note';
    if (type === 'daily_report') return { label: '日报', color: '#3B82F6', bg: '#EFF6FF' };
    if (type === 'weekly_report') return { label: '周报', color: '#8B5CF6', bg: '#F5F3FF' };
    return { label: '笔记', color: DayColors.accent, bg: '#E0F7F6' };
  };

  const getTags = (note: Note) => {
    const tags: Array<{ label: string; color: string; bg: string }> = [];
    const metaTags = note.metadata?.tags || [];
    if (metaTags.includes('important')) tags.push({ label: '重要', color: '#111827', bg: '#F3F4F6' });
    if (metaTags.includes('urgent')) tags.push({ label: '紧急', color: '#DC2626', bg: '#FEF2F2' });
    return tags;
  };

  const renderInitialCard = () => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <Text style={styles.timelineDate}>{formatDate(new Date().toISOString())}</Text>
        <View style={[styles.timelineDot, styles.dotInitial]} />
        <View style={styles.timelineLine} />
      </View>
      <View style={[styles.card, styles.cardInitial]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.typeText, { color: '#6B7280' }]}>提示</Text>
          </View>
          <Text style={styles.cardTime}>{formatTime(new Date().toISOString())}</Text>
        </View>
        <View style={styles.initialContent}>
          <Text style={styles.initialText}>你可以在此记录笔记，AI 会为你自动生成日报</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardSource}>来源：系统生成</Text>
        </View>
      </View>
    </View>
  );

  const renderNote = (note: Note) => {
    const typeInfo = getTypeInfo(note);
    const tags = getTags(note);
    const isEditing = editingId === note.id;
    const source = note.metadata?.source === 'ai' ? 'AI生成' : note.metadata?.source === 'file_upload' ? '文件上传' : '用户输入';

    return (
      <View key={note.id} style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <Text style={styles.timelineDate}>{formatDate(note.created_at)}</Text>
          <View style={[styles.timelineDot, { backgroundColor: typeInfo.color, borderColor: typeInfo.bg }]} />
          <View style={styles.timelineLine} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
              <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
            </View>
            {tags.map((tag, i) => (
              <View key={i} style={[styles.tagBadge, { backgroundColor: tag.bg }]}>
                <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
              </View>
            ))}
            <View style={{ flex: 1 }} />
            <Text style={styles.cardTime}>{formatTime(note.created_at)}</Text>
          </View>

          {note.title ? <Text style={styles.cardTitle}>{note.title}</Text> : null}

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                autoFocus
              />
              <View style={styles.editTagRow}>
                <Text style={styles.editTagLabel}>选择标签</Text>
                <TouchableOpacity
                  style={[
                    styles.editTagBtn,
                    editTags.includes('important') && styles.editTagBtnActive,
                  ]}
                  onPress={() => {
                    setEditTags(prev =>
                      prev.includes('important')
                        ? prev.filter(t => t !== 'important')
                        : [...prev, 'important']
                    );
                  }}
                >
                  <Text style={styles.editTagBtnText}>重要</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.editTagBtn,
                    editTags.includes('urgent') && styles.editTagBtnActiveRed,
                  ]}
                  onPress={() => {
                    setEditTags(prev =>
                      prev.includes('urgent')
                        ? prev.filter(t => t !== 'urgent')
                        : [...prev, 'urgent']
                    );
                  }}
                >
                  <Text style={styles.editTagBtnText}>紧急</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.editDeleteBtn}
                  onPress={() => {
                    setEditingId(null);
                    handleDelete(note.id);
                  }}
                >
                  <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                  <Text style={styles.editDeleteText}>删除</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingId(null)}>
                  <Text style={styles.editCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={() => handleSaveEdit(note.id)}>
                  <Text style={styles.editSaveText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.cardContent} numberOfLines={6}>{note.content}</Text>
          )}

          {note.metadata?.file_url && !isEditing && (
            <View style={styles.fileRow}>
              <FileText size={14} color={DayColors.accent} strokeWidth={2} />
              <Text style={styles.fileName} numberOfLines={1}>
                {note.metadata.original_filename || '附件'}
              </Text>
            </View>
          )}

          {!isEditing && (
            <View style={styles.cardFooter}>
              <Text style={styles.cardSource}>来源：{source}</Text>
              <TouchableOpacity
                style={styles.editOutlineBtn}
                onPress={() => {
                  setEditingId(note.id);
                  setEditContent(note.content);
                  setEditTags(note.metadata?.tags || []);
                }}
              >
                <Text style={styles.editOutlineText}>编辑</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DayColors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadNotes(); }}
          tintColor={DayColors.accent}
        />
      }
    >
      {renderInitialCard()}

      {notes.map(renderNote)}

      {notes.length === 0 && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>在下方输入框中记录项目笔记</Text>
          <Text style={styles.emptyHintSub}>和 AI 对话时，系统也会自动提取关键信息生成笔记</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 10, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineLeft: { width: 44, alignItems: 'center', paddingTop: 0, marginRight: 3 },
  timelineDate: {
    fontSize: 11,
    fontWeight: '500',
    color: DayColors.textSecondary,
    marginBottom: 4,
  },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2,
  },
  dotInitial: {
    backgroundColor: '#9CA3AF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: DayColors.border, marginTop: 4 },

  card: {
    flex: 1,
    marginLeft: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    paddingBottom: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
  },
  cardInitial: {
    backgroundColor: '#FFFFFF',
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '600' },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '600' },
  cardTime: { fontSize: 11, color: DayColors.textTertiary },

  initialContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  initialText: {
    fontSize: 13,
    color: DayColors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 4,
    paddingBottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
  },
  cardSource: {
    fontSize: 11,
    color: DayColors.textTertiary,
  },

  cardTitle: { fontSize: 14, fontWeight: '600', color: DayColors.text, marginBottom: 4 },
  cardContent: { fontSize: 13, lineHeight: 20, color: DayColors.textSecondary },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 8,
  },
  fileName: { fontSize: 12, color: DayColors.accent, flex: 1 },

  editOutlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DayColors.textTertiary,
  },
  editOutlineText: { fontSize: 10, color: DayColors.textSecondary },

  editContainer: { gap: 8 },
  editInput: {
    backgroundColor: DayColors.surfaceSecondary,
    borderRadius: 8, padding: 10, fontSize: 13,
    color: DayColors.text, minHeight: 80, textAlignVertical: 'top',
  },
  editTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editTagLabel: { fontSize: 11, color: DayColors.textTertiary, marginRight: 2 },
  editTagBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  editTagBtnActive: {
    backgroundColor: '#E5E7EB',
    borderColor: '#111827',
  },
  editTagBtnActiveRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  editTagBtnText: { fontSize: 10, color: DayColors.text, fontWeight: '500' },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editDeleteText: { fontSize: 12, color: '#EF4444' },
  editCancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: DayColors.surfaceSecondary },
  editCancelText: { fontSize: 12, color: DayColors.textSecondary },
  editSaveBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#111827' },
  editSaveText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  emptyHint: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyHintText: {
    fontSize: 13,
    color: DayColors.textTertiary,
    textAlign: 'center',
  },
  emptyHintSub: {
    fontSize: 12,
    color: DayColors.textTertiary,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default NoteTab;
