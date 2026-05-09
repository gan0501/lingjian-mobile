import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated, Easing, ScrollView, Image } from 'react-native';
import type { PileComparisonChatMessage } from '../PileComparisonContext';
import RenderHTML, {
  TNodeChildrenRenderer,
  type CustomBlockRenderer,
  HTMLElementModel,
  HTMLContentModel,
} from 'react-native-render-html';
import { marked } from 'marked';

const MARKDOWN_TAG_STYLES = {
  h1: { fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 6 },
  h2: { fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 6 },
  h3: { fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 6 },
  p: { fontSize: 12, lineHeight: 16, marginTop: 0, marginBottom: 4 },
  ul: { paddingLeft: 18, marginTop: 0, marginBottom: 6 },
  ol: { paddingLeft: 18, marginTop: 0, marginBottom: 6 },
  li: { fontSize: 12, lineHeight: 20, marginBottom: 10 },
  strong: { fontWeight: '700' },
  table: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignSelf: 'flex-start' },
  thead: { backgroundColor: 'rgba(255,255,255,0.06)' },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  th: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    flexWrap: 'nowrap',
  },
  td: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.88)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    flexWrap: 'nowrap',
  },
} as const;

const TableRenderer: CustomBlockRenderer = ({ tnode }) => {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      style={styles.tableScroll}
      contentContainerStyle={styles.tableScrollContent}
    >
      <View style={styles.tableWrap}>
        <TNodeChildrenRenderer tnode={tnode} />
      </View>
    </ScrollView>
  );
};

const ChipsRenderer: CustomBlockRenderer = ({ tnode }) => {
  const itemsRaw = String((tnode?.domNode as any)?.attribs?.['data-items'] || '').trim();
  const variantRaw = String((tnode?.domNode as any)?.attribs?.['data-variant'] || '').trim();
  const variant = variantRaw === 'risk' ? 'risk' : 'normal';
  const items = itemsRaw
    ? itemsRaw
        .split('|')
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    : [];
  if (items.length === 0) return null;
  return (
    <View style={styles.chipsRow}>
      {items.map((t, idx) => (
        <View key={`${t}-${idx}`} style={[styles.chip, variant === 'risk' ? styles.chipRisk : null]}>
          <Text style={[styles.chipText, variant === 'risk' ? styles.chipTextRisk : null]}>{t}</Text>
        </View>
      ))}
    </View>
  );
};

const normalizeFigureKey = (s: string) => {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\\/\\\\._\-]/g, '');
};

const pickBestAttachmentUri = (
  title: string,
  attachments?: Array<{ uri: string; name?: string; type?: string; kind?: 'profile' | 'parameters' | 'other' }>,
  kind?: 'profile' | 'parameters'
): string | null => {
  const listAll = Array.isArray(attachments) ? attachments.filter((a) => a && a.uri) : [];
  const list = kind ? listAll.filter((a) => a.kind === kind) : listAll;
  if (list.length === 0) return null;
  if (list.length === 1) return String(list[0].uri);

  const t = normalizeFigureKey(title);
  const keywords = ['剖面', '柱状', '参数', 'profile', 'parameter', 'bore', 'soil'];
  const titleHits = keywords.filter((k) => t.includes(normalizeFigureKey(k)));

  let best: { score: number; uri: string } | null = null;
  list.forEach((a) => {
    const nameKey = normalizeFigureKey(String(a.name || ''));
    let score = 0;
    if (nameKey && t && (nameKey.includes(t) || t.includes(nameKey))) score += 5;
    titleHits.forEach((k) => {
      if (nameKey.includes(normalizeFigureKey(k))) score += 2;
    });
    if (!best || score > best.score) {
      best = { score, uri: String(a.uri) };
    }
  });
  if (best && best.score > 0) return best.uri;
  return String(list[0].uri);
};

const makeFigureRenderer = (
  attachments?: Array<{ uri: string; name?: string; type?: string; kind?: 'profile' | 'parameters' | 'other' }>
): CustomBlockRenderer =>
  ({ tnode }) => {
    const title = String((tnode?.domNode as any)?.attribs?.['data-title'] || '').trim();
    const kindRaw = String((tnode?.domNode as any)?.attribs?.['data-kind'] || '').trim();
    const kind = kindRaw === 'profile' || kindRaw === 'parameters' ? (kindRaw as any) : undefined;
    const url = String((tnode?.domNode as any)?.attribs?.['data-url'] || '').trim();
    const uri = url || pickBestAttachmentUri(title, attachments, kind);
    if (uri) {
      return (
        <View style={styles.figureBox}>
          <Text style={styles.figureTitle}>{title || '图片'}</Text>
          <View style={styles.figureImageWrap}>
            <Image source={{ uri }} style={styles.figureImage} resizeMode="contain" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.figureBox}>
        <Text style={styles.figureTitle}>{title || '图片占位'}</Text>
        <View style={styles.figureInner}>
          <Text style={styles.figureHint}>（生成后请替换为实际图片）</Text>
        </View>
      </View>
    );
  };


type Props = {
  messages: PileComparisonChatMessage[];
};

export const ThinkingLoader: React.FC = () => {
  const spin = React.useRef(new Animated.Value(0)).current;
  const spin2 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const a1 = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const a2 = Animated.loop(
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(spin2, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );

    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
    };
  }, [spin, spin2]);

  const r1 = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r2 = spin2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.loaderWrap}>
      <Animated.View style={[styles.loaderDot, { transform: [{ rotate: r1 }] }]}>
        <View style={styles.loaderInner} />
      </Animated.View>
      <Animated.View style={[styles.loaderDot, { transform: [{ rotate: r2 }, { scaleX: -1 }] }]}>
        <View style={styles.loaderInner} />
      </Animated.View>
    </View>
  );
};

export const MarkdownAssistant: React.FC<{
  markdown: string;
  baseStyle?: any;
  attachments?: Array<{ uri: string; name?: string; type?: string; kind?: 'profile' | 'parameters' | 'other' }>;
}> = ({ markdown, baseStyle, attachments }) => {
  const { width } = useWindowDimensions();

  const normalizeMarkdownLists = React.useCallback((input: string) => {
    const text = String(input || '');
    const lines = text.split(/\r?\n/);
    const out: string[] = [];

    for (const rawLine of lines) {
      const line0 = String(rawLine || '').replace(/\t/g, '  ');
      const m = line0.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (!m) {
        out.push(line0);
        continue;
      }

      const spaces = (m[1] || '').replace(/\t/g, '  ').length;
      // Markdown 列表缩进标准：2 空格为一级；超过 3 级一般是噪声，限制一下避免“乱嵌套”
      const level = Math.min(3, Math.floor(spaces / 2));
      const indent = ' '.repeat(level * 2);
      out.push(`${indent}${m[2]} ${m[3]}`);
    }

    return out.join('\n');
  }, []);

  const normalizeMarkdownTables = React.useCallback((input: string) => {
    // 直接返回原始文本，让 marked 自行处理表格
    return String(input || '');
  }, []);

  const customHTMLElementModels = React.useMemo(() => {
    const chipsModel = HTMLElementModel.fromCustomModel({
      tagName: 'chips',
      contentModel: HTMLContentModel.block,
    });
    return { chips: chipsModel };
  }, []);

  const html = React.useMemo(() => {
    try {
      marked.setOptions({ gfm: true, breaks: false } as any);
      const raw0 = normalizeMarkdownLists(String(markdown || ''));
      const raw = normalizeMarkdownTables(raw0);
      const withPositiveChips = raw.replace(/\[\[CHIPS:([^\]]+)\]\]/g, (_m, body) => {
        const safeItems = String(body || '').replace(/"/g, '&quot;').trim();
        return `<chips data-variant="normal" data-items="${safeItems}"></chips>`;
      });

      const withRiskUnderline = withPositiveChips.replace(/\[\[RISK_CHIPS:([^\]]+)\]\]/g, (_m, body) => {
        const items = String(body || '')
          .split('|')
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .slice(0, 8);
        if (items.length === 0) return '';
        const htmlItems = items.map((t) => {
          const safe = String(t).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<u>${safe}</u>`;
        });
        return `<br/>${htmlItems.join(' ')}<br/>`;
      });

      const withFigures = withRiskUnderline.replace(/\[\[FIGURE:([^\]|]+)([^\]]*)\]\]/g, (_m, t, rest) => {
        const safeTitle = String(t || '').replace(/"/g, '&quot;').trim();
        const r = String(rest || '');
        const k = r.match(/\|kind=(profile|parameters)/i)?.[1] || '';
        const u = r.match(/\|url=([^\]|]+)/i)?.[1] || '';
        const safeKind = k === 'profile' || k === 'parameters' ? k : '';
        const safeUrl = String(u || '').replace(/"/g, '&quot;').trim();
        return `<figure data-title="${safeTitle}"${safeKind ? ` data-kind="${safeKind}"` : ''}${safeUrl ? ` data-url="${safeUrl}"` : ''}></figure>`;
      });
      return marked.parse(withFigures);
    } catch {
      return (markdown || '').replace(/\n/g, '<br/>');
    }
  }, [markdown, normalizeMarkdownLists, normalizeMarkdownTables]);

  const source = React.useMemo(() => ({ html }), [html]);

  const defaultTextProps = React.useMemo(() => ({ selectable: true }), []);

  const mergedBaseStyle = React.useMemo(() => {
    return StyleSheet.flatten([styles.assistantBase, baseStyle]);
  }, [baseStyle]);

  return (
    <RenderHTML
      contentWidth={width}
      source={source}
      baseStyle={mergedBaseStyle}
      tagsStyles={MARKDOWN_TAG_STYLES}
      defaultTextProps={defaultTextProps}
      customHTMLElementModels={customHTMLElementModels}
      renderers={{ table: TableRenderer, figure: makeFigureRenderer(attachments), chips: ChipsRenderer }}
      ignoredDomTags={['input', 'textarea', 'select', 'option']}
    />
  );
};

const ChatThread: React.FC<Props> = ({ messages }) => {
  if (!messages || messages.length === 0) return null;

  return (
    <View style={styles.content}>
      {messages.map((m) => (
        <View
          key={m.id}
          style={[styles.row, m.role === 'user' ? styles.rowUser : styles.rowAssistant]}
        >
          {m.role === 'user' ? (
            <View style={[styles.bubble, styles.bubbleUser]}>
              <Text style={[styles.text, styles.textUser]}>{m.content || ''}</Text>
            </View>
          ) : (
            <View style={styles.assistantBlock}>
              {m.status === 'streaming' && !m.content ? (
                <ThinkingLoader />
              ) : m.status === 'streaming' ? (
                <Text style={styles.assistantStreamingText}>{m.content}</Text>
              ) : (
                <MarkdownAssistant markdown={m.content || ''} />
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    marginTop: 12,
    paddingVertical: 4,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bubbleUser: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
  textUser: {
    color: '#fff',
  },
  assistantBlock: {
    maxWidth: '92%',
  },
  assistantBase: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.90)',
  },
  assistantStreamingText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.90)',
  },
  loaderWrap: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingVertical: 4,
  },
  loaderDot: {
    height: 16,
    width: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderInner: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000',
    left: 2,
    top: 2,
  },
  tableScroll: {
    maxWidth: '100%',
  },
  tableScrollContent: {
    paddingVertical: 4,
  },
  tableWrap: {
    minWidth: 320,
  },
  figureBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
  },
  figureTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  figureInner: {
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  figureImageWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  figureImage: {
    width: '100%',
    height: 240,
    borderRadius: 10,
  },
  figureHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipText: {
    color: '#fff',
    fontSize: 11,
  },
  chipRisk: {
    backgroundColor: '#CCCCCC',
  },
  chipTextRisk: {
    color: '#000',
  },
});

export default ChatThread;
