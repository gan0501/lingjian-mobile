/**
 * 图片占位框组件
 * 用于显示 [IMAGE:xxx] 标记对应的图片
 */
import React, { FC, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ImageIcon } from 'lucide-react-native';

export interface ImageMarker {
  keywords: string;
  position: number;
  imageUrl?: string;
  candidateUrls?: string[];
  loading?: boolean;
}

interface ImagePlaceholderProps {
  marker: ImageMarker;
  width: number;
  onPress: (marker: ImageMarker) => void;
}

/**
 * 单个图片占位框
 */
export const ImagePlaceholder: FC<ImagePlaceholderProps> = memo(({
  marker,
  width,
  onPress,
}) => {
  // 4:3 比例计算高度
  const height = (width * 3) / 4;

  return (
    <TouchableOpacity
      style={[styles.container, { width, height }]}
      onPress={() => onPress(marker)}
      activeOpacity={0.8}
    >
      {marker.loading ? (
        <View style={styles.loadingContainer}>
          <Loading size="small" color="#fff" />
          <Text style={styles.loadingText}>搜索中...</Text>
        </View>
      ) : marker.imageUrl && marker.imageUrl.trim() !== '' ? (
        <>
          <Image
            source={{ uri: marker.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* 图片上方显示关键词提示 */}
          <View style={styles.keywordsOverlay}>
            <Text style={styles.keywordsOverlayText} numberOfLines={1}>
              {marker.keywords}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <ImageIcon size={24} color="rgba(255,255,255,0.5)" />
          <Text style={styles.keywordsText} numberOfLines={2}>
            {marker.keywords}
          </Text>
        </View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>点击更换</Text>
      </View>
    </TouchableOpacity>
  );
});

interface ImagePlaceholderRowProps {
  markers: ImageMarker[];
  containerWidth: number;
  onImagePress: (marker: ImageMarker) => void;
}

/**
 * 图片占位框行 - 支持1-3张图片的布局
 */
export const ImagePlaceholderRow: FC<ImagePlaceholderRowProps> = memo(({
  markers,
  containerWidth,
  onImagePress,
}) => {
  const count = Math.min(markers.length, 3);
  const gap = 8;
  
  // 根据图片数量计算每张图片的宽度
  let imageWidth: number;
  switch (count) {
    case 1:
      imageWidth = containerWidth;
      break;
    case 2:
      imageWidth = (containerWidth - gap) / 2;
      break;
    case 3:
    default:
      imageWidth = (containerWidth - gap * 2) / 3;
      break;
  }

  return (
    <View style={styles.row}>
      {markers.slice(0, 3).map((marker, index) => (
        <View key={`${marker.keywords}-${index}`} style={{ marginRight: index < count - 1 ? gap : 0 }}>
          <ImagePlaceholder
            marker={marker}
            width={imageWidth}
            onPress={onImagePress}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  keywordsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  overlayText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  keywordsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  keywordsOverlayText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    marginVertical: 12,
  },
});

export default ImagePlaceholder;
