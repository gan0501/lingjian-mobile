import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';

export const DotMatrixBackground: React.FC = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* 底层深空背景色，与 Silk 动画背景的基调色保持一致 */}
      <View style={styles.baseColor} />
      
      {/* 采用高性能 SVG Pattern 绘制无限延伸的科技点阵 */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="dotPattern" width="22" height="22" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1.2" fill="rgba(202, 196, 224, 0.2)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dotPattern)" />
      </Svg>
      
      {/* 添加一层极其轻微的径向暗角（用透明边框模拟或上下线性渐变），让它更有屏幕纵深感 */}
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0F19', 
  },
  vignetteTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(11, 15, 25, 0.4)',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(11, 15, 25, 0.6)',
  }
});
