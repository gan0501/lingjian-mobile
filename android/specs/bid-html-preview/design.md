# **1. 实现模型**

## **1.1 上下文视图**

### 系统上下文

标书HTML预览功能嵌入在现有指尖标书（BidWriter）模块中，与以下外部系统交互：

```
┌─────────────────────────────────────────────────────────┐
│                    标书用户（移动端）                       │
└───────────┬──────────────────────────────┬──────────────┘
            │ 点击"预览标书"               │ 点击"导出标书"
            ▼                              ▼
┌───────────────────────┐    ┌───────────────────────┐
│  BidHtmlPreviewScreen │    │    ExportModal        │
│  (WebView HTML渲染)    │    │  (Word文档保存/分享)   │
└───────────┬───────────┘    └───────────┬───────────┘
            │ GET /preview-html           │ GET /export
            ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│              后端 API (bid_writer_service)                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ /preview-html│  │  html_exporter│  │   BidExporter │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase 数据库（BidDocument存储）            │
└─────────────────────────────────────────────────────────┘
```

### 交互序列

1. 用户在BidWriter Step3完成状态点击"预览标书" → 导航至BidHtmlPreviewScreen
2. BidHtmlPreviewScreen调用 `GET /bid-writer/{bidId}/preview-html` 获取HTML字符串
3. WebView通过 `source={{ html }}` 渲染完整标书内容（封面→目录→正文）
4. 用户点击右上角"导出"按钮 → 调用现有 `/export` 端点获取docx → 弹出ExportModal

---

## **1.2 服务/组件总体架构**

### 前端组件架构

```
BidWriterContainer (现有)
  ├── Step3 完成后底部按钮 "导出标书" → 变更为 "预览标书"
  └── navigation.navigate('BidHtmlPreview', { bidId })

BidHtmlPreviewScreen (新增)
  ├── 顶部导航栏
  │   ├── 返回按钮 (ChevronLeft)
  │   ├── 项目名称标题
  │   └── 导出按钮 (Upload icon + "导出"文字)
  ├── WebView内容区
  │   └── source={{ html }} 加载后端返回的完整HTML
  ├── 加载状态 (ActivityIndicator)
  ├── 错误状态 (重试按钮)
  └── ExportModal (复用现有组件)
```

### 后端模块架构

```
bid_writer_service/
  ├── api.py                     # 新增 GET /{bid_id}/preview-html 端点
  ├── html_exporter.py (新增)    # HTML生成器（独立模块，与exporter.py同级）
  │   ├── BidHtmlExporter        # 主类
  │   │   ├── generate_html()           # 生成完整HTML文档
  │   │   ├── _render_cover()           # 封面渲染（6种模板）
  │   │   ├── _render_toc()             # 目录渲染
  │   │   ├── _render_content()         # 正文渲染（3种布局）
  │   │   ├── _render_markdown_to_html() # Markdown→HTML转换
  │   │   ├── _render_image()           # 图片标记→img标签转换
  │   │   ├── _generate_css_vars()      # CSS变量主题生成
  │   │   └── _generate_base_css()      # 基础响应式CSS生成
  │   ├── COVER_TEMPLATES        # 6种封面模板配置
  │   ├── COLOR_SCHEME_MAP       # 7种色系CSS变量映射
  │   └── LAYOUT_TEMPLATES       # 3种版式布局配置
  ├── exporter.py (现有，不修改)  # Word文档导出器
  └── models.py (现有，不修改)    # 数据模型
```

### 设计决策：新建 html_exporter.py 而非扩展 exporter.py

| 方案 | 优势 | 劣势 |
|------|------|------|
| **新建 html_exporter.py** ✅ | 关注点分离；HTML/Word生成逻辑差异大；独立演进不影响现有导出 | 新增1个文件 |
| 扩展 exporter.py | 无新文件 | 类膨胀；Word/HTML逻辑耦合；修改可能影响现有导出稳定性 |

选择**新建 html_exporter.py**，理由：
1. HTML生成与Word导出的渲染逻辑完全不同（HTML用CSS变量+语义标签，Word用python-docx段落样式）
2. 遵循现有exporter.py的`BidExporter`类模式，独立为`BidHtmlExporter`类
3. 避免修改已稳定的导出链路（spec.md 5.3明确要求"导出功能不得因新增预览而破坏"）

---

## **1.3 实现设计文档**

### 1.3.1 前端实现设计

#### A. BidHtmlPreviewScreen 组件设计

**文件位置**: `src/screens/aitools/bidwriter/BidHtmlPreviewScreen.tsx`

**设计模式**: 复用 `MarpSlideViewerScreen` 的 WebView 渲染模式，但采用 `source={{ html }}` 直接注入方式（而非加载本地HTML文件+injectJavaScript）。

```typescript
// 组件签名
const BidHtmlPreviewScreen: FC<RootStackScreenProps<'BidHtmlPreview'>> = ({ navigation, route }) => {
  // route.params.bidId: string
  
  // 状态
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFilePath, setExportFilePath] = useState('');
  const [exportFileName, setExportFileName] = useState('');
  
  // 生命周期：进入页面时请求HTML
  useEffect(() => {
    fetchPreviewHtml();
  }, [bidId]);
  
  // WebView渲染
  <WebView
    source={{ html: htmlContent }}
    originWhitelist={['*']}
    style={styles.webview}
    onLoadEnd={() => setLoading(false)}
    onError={() => setError('页面加载异常')}
  />
};
```

**顶部导航栏设计**（复用MarpSlideViewerScreen的视觉风格）:

| 元素 | 位置 | 样式 |
|------|------|------|
| 返回按钮 (ChevronLeft) | 左侧 | 36x36圆形半透明背景，白色图标 |
| 项目名称 | 中间 | 白色16号粗体，单行省略 |
| 导出按钮 (Upload+文字) | 右侧 | 半透明胶囊背景，白色13号粗体 |

**背景**: 与MarpSlideViewerScreen一致，使用 `<LinearGradient colors={['#80011A', '#000000']}>` 深红渐变背景。

**状态管理流程**:

```
进入页面 → loading=true → 调用API → 
  成功: setHtmlContent(html) → loading=false → WebView渲染
  失败: setError(msg) → loading=false → 显示错误页+重试按钮
```

#### B. 底部按钮变更方案

**修改文件**: `src/screens/aitools/bidwriter/BidWriterContainer.tsx`

**修改点1 - getMainButtonText()**:
```typescript
// 当前代码（第282行）:
case 3:
  if (status === 'completed') return '导出标书';
  
// 修改为:
case 3:
  if (status === 'completed') return '预览标书';
```

**修改点2 - onMainButtonPress 回调**:
```typescript
// 当前代码（第503-506行）:
case 3:
  if (status === 'completed') {
    // TODO: 导出逻辑
  }
  break;
  
// 修改为:
case 3:
  if (status === 'completed') {
    navigation.navigate('BidHtmlPreview', { bidId: bidId! });
  }
  break;
```

**不变更**: Step1和Step2的按钮逻辑、Step3非完成状态的按钮逻辑均不变。

#### C. 路由注册

**修改文件1**: `src/navigation/types.ts`

```typescript
// 在 RootStackParamList 中新增:
BidHtmlPreview: { bidId: string };
```

**修改文件2**: `src/navigation/RootNavigator.tsx`

```typescript
// 新增 import:
import BidHtmlPreviewScreen from '@/screens/aitools/bidwriter/BidHtmlPreviewScreen';

// 在 Stack.Navigator 中新增 Screen（紧跟 BidWriter 之后）:
<Stack.Screen name="BidHtmlPreview" component={BidHtmlPreviewScreen} />
```

#### D. API调用扩展

**修改文件**: `src/services/bidWriter.ts`

```typescript
// 在 bidWriterApi 对象中新增方法:
/**
 * 获取标书HTML预览
 */
previewHtml: (bidId: string, styleOptions?: {
  cover_style?: string;
  layout_style?: string;
  color_scheme?: string;
  has_page_border?: boolean;
  dark_bid_mode?: boolean;
}) =>
  api.get<string>(`/api/bid-writer/${bidId}/preview-html`, {
    params: styleOptions,
    timeout: 10000,  // 10秒超时
  }),
```

**返回类型**: `string`（完整HTML文档字符串）

---

### 1.3.2 后端实现设计

#### A. /preview-html 端点设计

**文件**: `backend/bid_writer_service/api.py`

```python
@router.get("/{bid_id}/preview-html")
async def preview_html(
    bid_id: str,
    current_user: dict = Depends(get_current_user),  # JWT认证
    cover_style: Optional[str] = None,
    layout_style: Optional[str] = None,
    color_scheme: Optional[str] = None,
    has_page_border: Optional[str] = None,
    dark_bid_mode: Optional[str] = None,
):
    """标书HTML预览 - 返回完整自包含HTML文档"""
```

**端点处理流程**:

```
1. 查询BidDocument → 不存在返回404
2. 校验status=completed → 未完成返回400
3. 权限校验: current_user.id == bid_doc.user_id → 不匹配返回403
4. 查询参数覆盖样式配置
5. 调用 BidHtmlExporter.generate_html(bid_doc) 在线程池中执行
6. 返回 HTMLResponse(content=html_str, media_type="text/html; charset=utf-8")
```

**与现有 /export 端点对齐设计**:
- 路由路径: `/{bid_id}/preview-html`（与 `/{bid_id}/export` 同级）
- 查询参数: `cover_style`, `layout_style`, `color_scheme`, `has_page_border`, `dark_bid_mode`（比/export多dark_bid_mode）
- 认证: JWT（与/export一致）
- 权限: 用户所有权校验（/export当前无权限校验，但spec要求新增）

#### B. BidHtmlExporter 类设计

**文件**: `backend/bid_writer_service/html_exporter.py`（新建）

```python
class BidHtmlExporter:
    """标书HTML预览生成器 - 生成零依赖自包含HTML文档"""
    
    @staticmethod
    def generate_html(bid_doc: BidDocument) -> str:
        """生成完整HTML文档字符串"""
        # 1. 生成CSS变量(:root)
        # 2. 生成基础CSS(响应式+排版)
        # 3. 渲染封面
        # 4. 渲染目录
        # 5. 渲染正文
        # 6. 组合为完整HTML文档
        
    @staticmethod
    def _generate_css_vars(color_scheme: str, dark_bid_mode: bool, 
                           has_page_border: bool) -> str:
        """生成:root CSS变量块"""
        
    @staticmethod
    def _generate_base_css() -> str:
        """生成基础响应式CSS（借签viewport-base.css）"""
        
    @staticmethod
    def _render_cover(bid_doc: BidDocument) -> str:
        """渲染封面HTML片段（6种模板）"""
        
    @staticmethod
    def _render_toc(bid_doc: BidDocument) -> str:
        """渲染目录HTML片段"""
        
    @staticmethod
    def _render_content(bid_doc: BidDocument) -> str:
        """渲染正文HTML片段（3种布局）"""
        
    @staticmethod
    def _render_markdown_to_html(md_text: str) -> str:
        """Markdown→HTML转换"""
        
    @staticmethod
    def _render_image(content: str, images: List[ImagePosition]) -> str:
        """处理[IMAGE:keywords]标记→img标签"""
```

#### C. CSS变量主题系统设计

**7种色系映射表**（与exporter.py的COLOR_SCHEME_MAP对齐accent值）:

```python
HTML_COLOR_SCHEMES = {
    'black': {
        'accent_primary': '#1a1a1a',
        'accent_secondary': '#4a4a4a',
        'accent_light': '#f5f5f5',
        'header_bg': '#e8e8e8',
        'header_fg': '#1a1a1a',
        'border_color': '#1a1a1a',
    },
    'blue': {
        'accent_primary': '#1F4E79',
        'accent_secondary': '#2E75B6',
        'accent_light': '#D6E4F0',
        'header_bg': '#D6E4F0',
        'header_fg': '#1F4E79',
        'border_color': '#1F4E79',
    },
    'red': {
        'accent_primary': '#953734',
        'accent_secondary': '#C0504D',
        'accent_light': '#F2DCDB',
        'header_bg': '#F2DCDB',
        'header_fg': '#953734',
        'border_color': '#953734',
    },
    'green': {
        'accent_primary': '#4F6228',
        'accent_secondary': '#77933C',
        'accent_light': '#D8E4BC',
        'header_bg': '#D8E4BC',
        'header_fg': '#4F6228',
        'border_color': '#4F6228',
    },
    'orange': {
        'accent_primary': '#E36C09',
        'accent_secondary': '#F79646',
        'accent_light': '#FDE9D9',
        'header_bg': '#FDE9D9',
        'header_fg': '#E36C09',
        'border_color': '#E36C09',
    },
    'cyan': {
        'accent_primary': '#205867',
        'accent_secondary': '#4BACC6',
        'accent_light': '#DAEEF3',
        'header_bg': '#DAEEF3',
        'header_fg': '#205867',
        'border_color': '#205867',
    },
    'purple': {
        'accent_primary': '#5F497A',
        'accent_secondary': '#8064A2',
        'accent_light': '#E4DFEC',
        'header_bg': '#E4DFEC',
        'header_fg': '#5F497A',
        'border_color': '#5F497A',
    },
}
```

**CSS变量生成逻辑**:

```python
def _generate_css_vars(color_scheme, dark_bid_mode, has_page_border):
    scheme = HTML_COLOR_SCHEMES.get(color_scheme, HTML_COLOR_SCHEMES['black'])
    
    if dark_bid_mode:
        # 暗色模式
        vars = {
            '--bg-primary': '#1a1a1a',
            '--bg-secondary': '#2d2d2d',
            '--bg-card': '#333333',
            '--text-primary': '#ffffff',
            '--text-secondary': '#b0b0b0',
            '--text-muted': '#808080',
            '--accent-primary': scheme['accent_secondary'],  # 暗色模式用较亮的辅色
            '--accent-light': scheme['accent_light'],
            '--header-bg': scheme['accent_primary'],
            '--header-fg': '#ffffff',
            '--border-color': scheme['accent_secondary'],
        }
    else:
        # 亮色模式
        vars = {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f8f9fa',
            '--bg-card': '#ffffff',
            '--text-primary': '#1a1a1a',
            '--text-secondary': '#4a4a4a',
            '--text-muted': '#808080',
            '--accent-primary': scheme['accent_primary'],
            '--accent-light': scheme['accent_light'],
            '--header-bg': scheme['header_bg'],
            '--header-fg': scheme['header_fg'],
            '--border-color': scheme['border_color'],
        }
    
    # 字号变量（clamp响应式，借签viewport-base.css）
    vars.update({
        '--title-size': 'clamp(1.5rem, 4vw, 3rem)',
        '--h1-size': 'clamp(1.25rem, 3.5vw, 2rem)',
        '--h2-size': 'clamp(1.125rem, 2.5vw, 1.5rem)',
        '--h3-size': 'clamp(1rem, 2vw, 1.25rem)',
        '--body-size': 'clamp(0.875rem, 1.8vw, 1.0625rem)',
        '--small-size': 'clamp(0.75rem, 1.2vw, 0.875rem)',
        
        '--page-padding': 'clamp(1rem, 3vw, 2.5rem)',
        '--content-gap': 'clamp(0.5rem, 1.5vw, 1.5rem)',
        '--section-gap': 'clamp(1.5rem, 3vw, 3rem)',
    })
    
    # 页面边框变量
    if has_page_border:
        vars.update({
            '--page-border-width': '2px',
            '--page-border-color': vars['--border-color'],
        })
    else:
        vars.update({
            '--page-border-width': '0',
            '--page-border-color': 'transparent',
        })
    
    return ':root {\n' + '\n'.join(f'  {k}: {v};' for k, v in vars.items()) + '\n}'
```

#### D. 封面模板设计

**6种封面HTML模板**（纯CSS实现，不依赖外部图片，确保零依赖自包含）:

| cover_style | 视觉风格 | 布局特征 | 装饰元素 |
|-------------|---------|---------|---------|
| cover1 | 经典商务 | 居中对称，上下色块条 | 顶部/底部粗色块条，中间项目名 |
| cover2 | 简约现代 | 左对齐，大面积留白 | 左侧竖向色条(8px)，底部细线 |
| cover3 | 科技蓝调 | 左右分栏(30%+70%) | 左栏accent色块含"投标文件"竖排文字，右栏内容 |
| cover4 | 典雅中国 | 居中，古典纹饰 | 顶部回纹边框装饰(CSS伪元素)，底部日期居中 |
| cover5 | 活力橙光 | 对角线渐变背景 | 左下到右上对角渐变(accent→透明)，内容左下角对齐 |
| cover6 | 沉稳墨绿 | 全幅色块背景 | 全页accent色深色背景，白色文字，居中排版 |

**封面HTML结构**:

```html
<section class="cover cover-{n}" id="cover">
  <div class="cover-decoration"><!-- 装饰元素 --></div>
  <div class="cover-content">
    <h1 class="cover-title">{project_name}</h1>
    <p class="cover-subtitle">投 标 文 件</p>
    <p class="cover-info">投标单位：{bidder_name}</p>
    <p class="cover-date">{YYYY年MM月DD日}</p>
  </div>
</section>
```

**所有封面均使用CSS变量引用配色**: `var(--accent-primary)`, `var(--bg-primary)` 等，确保换肤一致性。

#### E. 目录生成设计

**目录HTML结构**:

```html
<section class="toc" id="toc">
  <h2 class="toc-title">目 录</h2>
  <nav class="toc-list">
    <div class="toc-item toc-level-1">
      <a href="#chapter-1">第一章 项目概述</a>
      <span class="toc-page">3</span>
    </div>
    <div class="toc-item toc-level-2">
      <a href="#section-1-1">1.1 项目背景</a>
      <span class="toc-page">3</span>
    </div>
    <div class="toc-item toc-level-3">
      <a href="#section-1-1-1">1.1.1 建设必要性</a>
      <span class="toc-page">4</span>
    </div>
    <!-- ... -->
  </nav>
</section>
```

**目录CSS样式**:
- `.toc-level-1`: 无缩进，粗体，字号 `var(--h2-size)`
- `.toc-level-2`: 左缩进 `2em`，正常字重，字号 `var(--body-size)`
- `.toc-level-3`: 左缩进 `4em`，浅色，字号 `var(--small-size)`
- `.toc-page`: 右对齐，使用点线前导符（`leader-dots`，CSS `::before` 伪元素+flex布局模拟）

**页码计算**: 采用"虚拟分页"方案——基于章节内容的预估高度（字数÷每页约500字）计算页码，封面=1，目录=2，正文从3开始累加。此为近似值，HTML非真实分页，仅作参考。

#### F. 正文布局设计

**3种layout_style对应的HTML结构**:

**1. image模式（文+图）**:
```html
<section class="chapter" id="chapter-{n}">
  <h1>{chapter_title}</h1>
  <div class="section">
    <h2>{section_title}</h2>
    <div class="content-text">
      <!-- Markdown→HTML转换后的段落 -->
    </div>
    <div class="content-images">
      <img src="{url}" alt="{keywords}" loading="lazy" 
           style="max-height: min(50vh, 400px); object-fit: contain;" />
    </div>
  </div>
</section>
```

**2. frame模式（文+表）**:
```html
<section class="chapter layout-frame" id="chapter-{n}">
  <h1>{chapter_title}</h1>
  <div class="section">
    <h2>{section_title}</h2>
    <div class="content-text">
      <!-- 段落内容 -->
    </div>
    <div class="content-tables">
      <table class="bid-table">
        <thead><tr><th>...</th></tr></thead>
        <tbody><tr><td>...</td></tr></tbody>
      </table>
    </div>
  </div>
</section>
```
- `.bid-table`: 带 `border: 1px solid var(--accent-primary)`，表头使用 `var(--header-bg)` 背景

**3. frame-image模式（文+表+图，双栏）**:
```html
<section class="chapter layout-frame-image" id="chapter-{n}">
  <h1>{chapter_title}</h1>
  <div class="two-column">
    <div class="column-left">
      <div class="content-text"><!-- 文字内容 --></div>
      <div class="content-tables"><!-- 表格 --></div>
    </div>
    <div class="column-right">
      <div class="content-images"><!-- 图文网格 --></div>
    </div>
  </div>
</section>
```
- `.two-column`: `display: grid; grid-template-columns: 3fr 2fr; gap: var(--content-gap);`
- 窄屏(<600px)自动回退为单栏: `@media (max-width: 600px) { .two-column { grid-template-columns: 1fr; } }`

#### G. Markdown→HTML转换设计

**转换策略**: 使用Python `markdown` 库（若已安装）或自实现的简化转换器（与MarpSlideViewerScreen的 `simpleMarkdownToHtml` 对齐）。

**转换规则**:

| Markdown语法 | HTML输出 |
|-------------|---------|
| `# / ## / ###` 标题 | `<h1> / <h2> / <h3>` |
| `**bold**` | `<strong>bold</strong>` |
| `*italic*` | `<em>italic</em>` |
| `- item` / `* item` | `<ul><li>item</li></ul>` |
| `1. item` | `<ol><li>item</li></ol>` |
| `| table |` | `<table><thead>...<tbody>...` |
| `> quote` | `<blockquote>quote</blockquote>` |
| `` `code` `` | `<code>code</code>` |
| `[IMAGE:keywords]` | `<img src="{url}" alt="{keywords}" loading="lazy" />` |
| `[[FIGURE:title\|url=url]]` | `<figure><img src="url" /><figcaption>title</figcaption></figure>` |

**优先使用 `markdown` 库**（pip install markdown），回退到简化正则转换器。

#### H. 图片处理设计

**[IMAGE:keywords]标记→img标签转换**:

```python
def _render_image(content: str, images: List[ImagePosition]) -> str:
    """将 [IMAGE:keywords] 标记替换为 <img> 标签"""
    for img_pos in images:
        if img_pos.selected_url:
            img_tag = (
                f'<img src="{img_pos.selected_url}" '
                f'alt="{img_pos.keywords}" '
                f'loading="lazy" '
                f'style="max-height: min(50vh, 400px); object-fit: contain; '
                f'max-width: 100%; border-radius: 4px;" />'
            )
            content = content.replace(f'[IMAGE:{img_pos.keywords}]', img_tag)
    
    # 清除未替换的残留标记
    content = re.sub(r'\[IMAGE:[^\]]+\]', '', content)
    return content
```

#### I. 暗标模式适配设计

暗标模式通过CSS变量系统实现，所有颜色引用均为CSS变量：

- `dark_bid_mode=true` → `:root` 中 `--bg-primary: #1a1a1a`, `--text-primary: #ffffff`
- 封面、目录、正文的所有颜色均通过 `var(--bg-primary)`, `var(--text-primary)` 等引用
- 表头背景: `var(--header-bg)`, 表头文字: `var(--header-fg)`
- 强调色: 暗色模式使用 `accent_secondary`（较亮），亮色模式使用 `accent_primary`

#### J. 页面边框装饰设计

```css
.page-content {
  border: var(--page-border-width) solid var(--page-border-color);
  padding: var(--page-padding);
  margin: clamp(0.5rem, 2vw, 1rem);
}
```

- `has_page_border=true`: `--page-border-width: 2px`, `--page-border-color` 跟随色系
- `has_page_border=false`: `--page-border-width: 0`, `--page-border-color: transparent`

#### K. 基础响应式CSS设计

**借签 frontend-slides-main/viewport-base.css 的关键规则**:

```css
/* 基础重置 */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", 
               "WenQuanYi Micro Hei", sans-serif;
  font-size: var(--body-size);
  line-height: 1.8;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

/* 图片约束（借签viewport-base.css第82-86行） */
img {
  max-width: 100%;
  max-height: min(50vh, 400px);
  object-fit: contain;
}

/* 响应式断点（借签viewport-base.css第94-138行） */
@media (max-width: 600px) {
  .two-column { grid-template-columns: 1fr; }
  :root { --page-padding: clamp(0.75rem, 2vw, 1.5rem); }
}

@media (max-height: 600px) {
  :root { --body-size: clamp(0.75rem, 1.2vw, 0.95rem); }
}

/* prefers-reduced-motion（借签viewport-base.css第144-153行） */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.2s !important;
  }
}

/* 表格语义化 */
.bid-table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--content-gap) 0;
}
.bid-table th {
  background: var(--header-bg);
  color: var(--header-fg);
  font-weight: 600;
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-color);
  text-align: left;
}
.bid-table td {
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-color);
}

/* 引用块 */
blockquote {
  border-left: 4px solid var(--accent-primary);
  padding: 0.5em 1em;
  margin: var(--content-gap) 0;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

/* 代码块 */
code {
  background: var(--bg-secondary);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
```

---

### 1.3.3 完整HTML文档组装

**最终HTML文档结构**:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{project_name} - 投标文件</title>
  <style>
    /* === CSS变量主题 === */
    {css_vars}
    
    /* === 基础响应式CSS === */
    {base_css}
    
    /* === 封面样式 === */
    {cover_css}
    
    /* === 目录样式 === */
    {toc_css}
    
    /* === 正文样式 === */
    {content_css}
  </style>
</head>
<body>
  <!-- 第1页：封面 -->
  {cover_html}
  
  <!-- 第2页：目录 -->
  {toc_html}
  
  <!-- 第3页起：正文 -->
  <div class="page-content">
    {content_html}
  </div>
</body>
</html>
```

---

# **2. 接口设计**

## **2.1 总体设计**

### 前端→后端接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取HTML预览 | GET | `/api/bid-writer/{bid_id}/preview-html` | 返回完整HTML字符串 |

### 前端内部接口（导航）

| 路由 | 参数 | 说明 |
|------|------|------|
| BidHtmlPreview | `{ bidId: string }` | 标书HTML预览页面 |

## **2.2 接口清单**

### 2.2.1 GET /api/bid-writer/{bid_id}/preview-html

**请求**:

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| bid_id | path | string | 是 | 标书唯一标识 |
| cover_style | query | string | 否 | 封面样式 cover1~cover6 |
| layout_style | query | string | 否 | 版式布局 image/frame/frame-image |
| color_scheme | query | string | 否 | 色系 black/blue/red/green/orange/cyan/purple |
| has_page_border | query | string | 否 | 页面边框 true/false |
| dark_bid_mode | query | string | 否 | 暗标模式 true/false |

**请求头**:

| 头 | 说明 |
|------|------|
| Authorization: Bearer {jwt_token} | JWT认证令牌（必须） |

**成功响应 (200)**:

| 字段 | 值 |
|------|------|
| Content-Type | text/html; charset=utf-8 |
| Body | 完整HTML文档字符串（DOCTYPE + html + head + body） |

**错误响应**:

| 状态码 | 条件 | message |
|--------|------|---------|
| 401 | 未携带有效Token | Unauthorized |
| 403 | 非标书所有者 | Forbidden |
| 404 | bid_id不存在 | 标书不存在 |
| 400 | status≠completed | 标书尚未完成 |
| 500 | HTML生成异常 | 预览生成失败 |

### 2.2.2 前端API方法

```typescript
bidWriterApi.previewHtml(bidId: string, styleOptions?: {
  cover_style?: string;
  layout_style?: string;
  color_scheme?: string;
  has_page_border?: boolean;
  dark_bid_mode?: boolean;
}): Promise<string>
```

---

# **4. 数据模型**

## **4.1 设计目标**

1. 不修改现有 `BidDocument` 数据模型——所有样式配置已存在于模型中
2. 不新增数据库表——HTML预览为即时生成，无需持久化
3. 端点直接从现有BidDocument读取数据，通过BidHtmlExporter实时生成HTML

## **4.2 模型实现**

### 4.2.1 现有模型复用

| 模型 | 字段 | 用途 |
|------|------|------|
| BidDocument | id, title, status, project_overview, outline | 核心数据源 |
| BidDocument | cover_style, layout_style, color_scheme | 样式配置 |
| BidDocument | dark_bid_mode, has_page_border | 暗标/边框配置 |
| ProjectOverview | project_name | 封面项目名称 |
| Outline | chapters[] | 目录+正文数据源 |
| Chapter | id, title, sub_chapters[] | 章节结构 |
| SubChapter | id, title, sections[] | 节结构 |
| Section | id, title, content, images[] | 条目内容及配图 |
| ImagePosition | keywords, selected_url | 图片URL解析 |

### 4.2.2 前端路由参数类型

```typescript
// 在 RootStackParamList 中新增:
BidHtmlPreview: { bidId: string };
```

### 4.2.3 CSS变量数据模型（运行时生成，非持久化）

```python
class CssThemeVars:
    """CSS主题变量集合（由_generate_css_vars动态生成）"""
    # 配色
    bg_primary: str        # --bg-primary
    bg_secondary: str      # --bg-secondary
    bg_card: str           # --bg-card
    text_primary: str      # --text-primary
    text_secondary: str    # --text-secondary
    text_muted: str        # --text-muted
    accent_primary: str    # --accent-primary
    accent_light: str      # --accent-light
    header_bg: str         # --header-bg
    header_fg: str         # --header-fg
    border_color: str      # --border-color
    
    # 字号（clamp格式）
    title_size: str        # --title-size
    h1_size: str           # --h1-size
    h2_size: str           # --h2-size
    h3_size: str           # --h3-size
    body_size: str         # --body-size
    small_size: str        # --small-size
    
    # 间距
    page_padding: str      # --page-padding
    content_gap: str       # --content-gap
    section_gap: str       # --section-gap
    
    # 边框
    page_border_width: str # --page-border-width
    page_border_color: str # --page-border-color
```
