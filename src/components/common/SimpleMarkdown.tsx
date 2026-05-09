/**
 * SimpleMarkdown - 纯 RN 原生 Markdown 渲染器
 * 不依赖任何原生模块，安卓和鸿蒙通用
 * 支持：# 标题、**加粗**、*斜体*、- 列表、> 引用、段落
 */
import React, { FC, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SimpleMarkdownProps {
  content: string;
  /** 基础文字颜色 */
  textColor?: string;
  /** 基础字号 */
  fontSize?: number;
}

interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li' | 'blockquote' | 'blank';
  text: string;
  depth?: number; // 列表缩进层级
}

/** 解析 Markdown 为块结构 */
function parseBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const blocks: ParsedBlock[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      // 空行
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'blank') {
        blocks.push({ type: 'blank', text: '' });
      }
      continue;
    }

    // 标题
    if (line.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: line.slice(5).trim() });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
    }
    // 引用
    else if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', text: line.slice(2).trim() });
    }
    // 无序列表 (-, *, •)
    else if (/^\s*[-*•]\s+/.test(line)) {
      const indent = line.search(/\S/);
      const depth = Math.floor(indent / 2);
      const text = line.replace(/^\s*[-*•]\s+/, '');
      blocks.push({ type: 'li', text, depth });
    }
    // 有序列表 (1. 2. 等)
    else if (/^\s*\d+[.)]\s+/.test(line)) {
      const indent = line.search(/\S/);
      const depth = Math.floor(indent / 2);
      const text = line.replace(/^\s*\d+[.)]\s+/, '');
      blocks.push({ type: 'li', text, depth });
    }
    // 普通段落
    else {
      blocks.push({ type: 'p', text: line.trim() });
    }
  }

  return blocks;
}

/** 渲染行内富文本（支持 **加粗** 和 *斜体*） */
function renderInlineText(
  text: string,
  baseStyle: any,
  boldColor?: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // 匹配 **bold** 和 *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // 匹配前的普通文字
    if (match.index > lastIndex) {
      parts.push(
        <Text key={key++} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text
          key={key++}
          style={[baseStyle, { fontWeight: '700' }, boldColor ? { color: boldColor } : null]}
        >
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={key++} style={[baseStyle, { fontStyle: 'italic' }]}>
          {match[3]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // 剩余的普通文字
  if (lastIndex < text.length) {
    parts.push(
      <Text key={key++} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? parts : [<Text key={0} style={baseStyle}>{text}</Text>];
}

const SimpleMarkdown: FC<SimpleMarkdownProps> = ({
  content,
  textColor = '#333',
  fontSize = 13,
}) => {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'blank':
            return <View key={index} style={{ height: 6 }} />;

          case 'h1':
            return (
              <Text key={index} style={[s.h1, { color: textColor }]}>
                {block.text}
              </Text>
            );

          case 'h2':
            return (
              <Text key={index} style={[s.h2, { color: textColor }]}>
                {block.text}
              </Text>
            );

          case 'h3':
            return (
              <Text key={index} style={[s.h3, { color: textColor }]}>
                {block.text}
              </Text>
            );

          case 'h4':
            return (
              <Text key={index} style={[s.h4, { color: textColor }]}>
                {block.text}
              </Text>
            );

          case 'blockquote':
            return (
              <View key={index} style={s.blockquote}>
                <Text style={[s.blockquoteText, { color: textColor }]}>
                  {renderInlineText(block.text, { fontSize, color: textColor, lineHeight: fontSize * 1.5 })}
                </Text>
              </View>
            );

          case 'li': {
            const depth = block.depth || 0;
            const bullet = depth === 0 ? '•' : depth === 1 ? '◦' : '▪';
            return (
              <View key={index} style={[s.li, { paddingLeft: 12 + depth * 16 }]}>
                <Text style={[s.bullet, { color: textColor }]}>{bullet}</Text>
                <Text style={[s.liText, { color: textColor, fontSize }]}>
                  {renderInlineText(block.text, { fontSize, color: textColor, lineHeight: fontSize * 1.5 }, textColor)}
                </Text>
              </View>
            );
          }

          case 'p':
          default:
            return (
              <Text key={index} style={[s.p, { color: textColor, fontSize }]}>
                {renderInlineText(block.text, { fontSize, color: textColor, lineHeight: fontSize * 1.5 }, textColor)}
              </Text>
            );
        }
      })}
    </View>
  );
};

const s = StyleSheet.create({
  h1: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 24,
  },
  h2: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 5,
    lineHeight: 22,
  },
  h3: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 20,
  },
  h4: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 5,
    marginBottom: 3,
    lineHeight: 18,
  },
  p: {
    marginVertical: 3,
    lineHeight: 20,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#B20000',
    paddingLeft: 12,
    marginVertical: 6,
    opacity: 0.9,
  },
  blockquoteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  li: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingRight: 8,
  },
  bullet: {
    width: 14,
    fontSize: 13,
    lineHeight: 20,
  },
  liText: {
    flex: 1,
    lineHeight: 20,
  },
});

export default SimpleMarkdown;
