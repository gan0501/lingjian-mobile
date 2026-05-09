/**
 * 图片选择侧边栏组件
 * 玻璃质感背景，支持网络图片搜索和自有知识库图片
 */
import React, { FC, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { Check, Upload, ImageIcon } from 'lucide-react-native';
import type { ImageMarker } from './ImagePlaceholder';
import { GlassSidebar } from '@/components/common';

type TabType = 'web' | 'knowledge';

interface ImageSelectorSidebarProps {
  visible: boolean;
  marker: ImageMarker | null;
  candidateImages: string[];
  knowledgeImages?: string[];
  loading: boolean;
  onSelectImage: (imageUrl: string) => void;
  onClose: () => void;
  onOpenKnowledgeBase?: () => void;
}

export const ImageSelectorSidebar: FC<ImageSelectorSidebarProps> = ({
  visible,
  marker,
  candidateImages,
  knowledgeImages = [],
  loading,
  onSelectImage,
  onClose,
  onOpenKnowledgeBase,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('web');

  return (
    <GlassSidebar
      visible={visible}
      onClose={onClose}
      title={marker?.keywords || '选择图片'}
      width="40%"
      theme="day"
    >
      <View style={{ flex: 1, paddingTop: 10 }}>

          {/* Tabs 切换 */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'web' && styles.tabActive]}
              onPress={() => setActiveTab('web')}
            >
              <Text style={[styles.tabText, activeTab === 'web' && styles.tabTextActive]}>
                网络图片
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'knowledge' && styles.tabActive]}
              onPress={() => setActiveTab('knowledge')}
            >
              <Text style={[styles.tabText, activeTab === 'knowledge' && styles.tabTextActive]}>
                自有知识
              </Text>
            </TouchableOpacity>
          </View>

          {/* 图片列表 */}
          <ScrollView
            style={styles.imageList}
            contentContainerStyle={styles.imageListContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'web' ? (
              // 网络图片 Tab
              loading ? (
                <View style={styles.loadingContainer}>
                  <Loading size="large" color="#fff" />
                  <Text style={styles.loadingText}>搜索图片中...</Text>
                </View>
              ) : candidateImages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>未找到相关图片</Text>
                </View>
              ) : (
                candidateImages.map((url, index) => {
                  const isSelected = marker?.imageUrl === url;
                  return (
                    <TouchableOpacity
                      key={`web-${url}-${index}`}
                      style={[
                        styles.imageItem,
                        isSelected && styles.imageItemSelected,
                      ]}
                      onPress={() => onSelectImage(url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <Check size={24} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              // 自有知识 Tab
              knowledgeImages.length === 0 ? (
                <View style={styles.emptyKnowledgeContainer}>
                  <ImageIcon size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyKnowledgeText}>你的知识图库为空</Text>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={onOpenKnowledgeBase}
                  >
                    <Upload size={16} color="#fff" />
                    <Text style={styles.uploadButtonText}>去上传</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                knowledgeImages.map((url, index) => {
                  const isSelected = marker?.imageUrl === url;
                  return (
                    <TouchableOpacity
                      key={`kb-${url}-${index}`}
                      style={[
                        styles.imageItem,
                        isSelected && styles.imageItemSelected,
                      ]}
                      onPress={() => onSelectImage(url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <Check size={24} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )
            )}
          </ScrollView>
      </View>
    </GlassSidebar>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#000000',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  imageList: {
    flex: 1,
  },
  imageListContent: {
    padding: 12,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  emptyKnowledgeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyKnowledgeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(178, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(178, 0, 0, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  imageItem: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageItemSelected: {
    borderColor: '#B20000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(178, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImageSelectorSidebar;
