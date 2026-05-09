import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/common';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { useAuthStore } from '@/stores';
import { API_CONFIG } from '@/constants/config';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintList'>;

interface ComponentItem {
  id: string;
  component_name: string;
  component_type: string;
  thumbnail_url: string | null;
  created_at: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 48) / 2;

const BlueprintListScreen: React.FC<Props> = ({ navigation }) => {
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const fetchComponents = useCallback(async () => {
    try {
      const userId = String(user?.id || 'anonymous');
      const url = `${API_CONFIG.BASE_URL}/api/blueprint/components?user_id=${userId}&limit=50`;
      const res = await authenticatedFetch(url);
      const data = await res.json();
      if (data.code === 200) {
        setComponents(data.result || []);
      }
    } catch (e) {
      console.warn('构件列表加载失败', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      fetchComponents();
    });
    return unsubscribe;
  }, [navigation, fetchComponents]);

  const handlePickFromGallery = useCallback(() => {
    try {
      const { launchImageLibrary } = require('react-native-image-picker');
      launchImageLibrary(
        { mediaType: 'photo', quality: 0.9, includeBase64: true, maxWidth: 1920, maxHeight: 1080 },
        (response: any) => {
          if (response.didCancel) return;
          if (response.errorCode) {
            Alert.alert('提示', '相册选择失败');
            return;
          }
          if (response.base64) {
            navigation.navigate('BlueprintCamera', {
              imageBase64: response.base64,
            });
          }
        }
      );
    } catch (e) {
      Alert.alert('提示', '相册功能暂不可用');
    }
  }, [navigation]);

  const handleTakePhoto = useCallback(() => {
    navigation.navigate('BlueprintCamera');
  }, [navigation]);

  const handleOpenItem = useCallback((item: ComponentItem) => {
    navigation.navigate('BlueprintPreview', {
      componentParams: { fromSaved: true, componentId: item.id },
    });
  }, [navigation]);

  const handleDeleteItem = useCallback((item: ComponentItem) => {
    Alert.alert('删除', `确定删除"${item.component_name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = String(user?.id || 'anonymous');
            const url = `${API_CONFIG.BASE_URL}/api/blueprint/components/${item.id}?user_id=${userId}`;
            await authenticatedFetch(url, { method: 'DELETE' });
            setComponents(prev => prev.filter(c => c.id !== item.id));
          } catch (e) {
            Alert.alert('提示', '删除失败');
          }
        },
      },
    ]);
  }, [user]);

  const renderItem = useCallback(({ item }: { item: ComponentItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleOpenItem(item)}
      onLongPress={() => handleDeleteItem(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardThumb}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Icon name={item.component_type === 'column' ? 'box' : 'layers'} size={32} color="#666" />
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.component_name}</Text>
      <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </TouchableOpacity>
  ), [handleOpenItem, handleDeleteItem]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>图纸转3D</Text>
        <View style={styles.headerRight} />
      </View>

      {components.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="cube" size={48} color="#666" />
          <Text style={styles.emptyTitle}>暂无3D构件</Text>
          <Text style={styles.emptySubtitle}>拍摄建筑图纸，AI生成3D钢筋模型</Text>
        </View>
      ) : (
        <FlatList
          data={components}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto} activeOpacity={0.8}>
          <View style={styles.captureButtonInner}>
            <Camera size={24} color="#E67E22" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backButton: { minWidth: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center', flex: 1 },
  headerRight: { minWidth: 44 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, color: '#999', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#bbb' },
  listContent: { padding: 16 },
  row: { gap: 16, marginBottom: 16 },
  card: { width: CARD_SIZE, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  cardThumb: { width: CARD_SIZE, height: CARD_SIZE * 0.75, backgroundColor: '#eee' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#333', paddingHorizontal: 10, paddingTop: 8 },
  cardDate: { fontSize: 11, color: '#999', paddingHorizontal: 10, paddingBottom: 8 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sideButton: { alignItems: 'center', gap: 4, minWidth: 60 },
  sideButtonDisabled: { opacity: 0.4 },
  sideButtonText: { fontSize: 11, color: '#333' },
  sideButtonTextDisabled: { color: '#666' },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E67E22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(230,126,34,0.3)',
  },
  captureButtonInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
});

export default BlueprintListScreen;
