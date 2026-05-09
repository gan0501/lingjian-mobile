# 标书HTML预览功能 - 编码任务规划

## 任务依赖关系图

```
后端任务:
  1(html_exporter核心) → 2(CSS变量主题) → 3(封面模板) → 4(目录生成) → 5(正文渲染) → 6(HTML文档组装)
  6 → 7(API端点)

前端任务:
  8(路由类型注册) → 9(API方法扩展) → 10(预览页面组件) → 11(按钮变更) → 12(路由注册)

联调任务:
  7 + 12 → 13(端到端联调) → 14(异常场景验证) → 15(性能与验收)
```

---

## 1. 后端 - BidHtmlExporter 核心类搭建

**依赖**: 无
**涉及文件**: `backend/bid_writer_service/html_exporter.py`（新建）
**具体修改**:
- 新建 `html_exporter.py`，与 `exporter.py` 同级
- 定义 `BidHtmlExporter` 类骨架，包含所有静态方法签名：
  - `generate_html(bid_doc) -> str`
  - `_generate_css_vars(color_scheme, dark_bid_mode, has_page_border) -> str`
  - `_generate_base_css() -> str`
  - `_render_cover(bid_doc) -> str`
  - `_render_toc(bid_doc) -> str`
  - `_render_content(bid_doc) -> str`
  - `_render_markdown_to_html(md_text) -> str`
  - `_render_image(content, images) -> str`
- 定义常量：`HTML_COLOR_SCHEMES`（7种色系映射表）、`COVER_TEMPLATES`（6种封面）、`LAYOUT_TEMPLATES`（3种版式）
- `generate_html()` 方法实现基本流程框架（调用各子方法并组装）
- 遵循 `exporter.py` 的 `BidExporter` 类模式（静态方法、同层级import规范）

**验收标准**: 类可实例化，`generate_html()` 可被调用并返回HTML字符串骨架

---

## 2. 后端 - CSS变量主题系统实现

**依赖**: 任务1
**涉及文件**: `backend/bid_writer_service/html_exporter.py`
**具体修改**:
- 实现 `_generate_css_vars()` 方法：
  - 7种色系映射表 `HTML_COLOR_SCHEMES`，色值与 `exporter.py` 的 `COLOR_SCHEME_MAP` 对齐（header_bg/header_fg一致）
  - 亮色模式：`--bg-primary: #ffffff`, `--text-primary: #1a1a1a` 等
  - 暗色模式：`--bg-primary: #1a1a1a`, `--text-primary: #ffffff`，accent使用较亮辅色
  - 字号变量全部使用 `clamp(min, preferred, max)` 格式（借鉴 viewport-base.css）
  - 间距变量使用 `clamp()` 格式
  - 页面边框变量：`has_page_border=true` 时 `--page-border-width: 2px`
  - 无效 color_scheme 回退到 `'black'`
- 实现 `_generate_base_css()` 方法：
  - 基础重置（`*, *::before, *::after`）
  - 系统字体栈（Microsoft YaHei, PingFang SC 等，不使用外部字体CDN）
  - 图片约束（`max-height: min(50vh, 400px); object-fit: contain`）
  - 响应式断点（`@media max-width: 600px` 等）
  - `prefers-reduced-motion` 媒体查询
  - `.bid-table` 表格样式、`blockquote` 引用块样式、`code` 代码块样式
  - `.page-content` 页面边框装饰样式

**验收标准**: 
- `_generate_css_vars('blue', False, True)` 返回包含 `:root { --accent-primary: #1F4E79; ... }` 的字符串
- `_generate_css_vars('blue', True, True)` 暗色模式返回 `--bg-primary: #1a1a1a`
- `_generate_base_css()` 返回完整的CSS规则集

---

## 3. 后端 - 封面模板实现

**依赖**: 任务2
**涉及文件**: `backend/bid_writer_service/html_exporter.py`
**具体修改**:
- 实现 `_render_cover()` 方法，支持6种封面模板：
  - `cover1` 经典商务：居中对称，上下色块条
  - `cover2` 简约现代：左对齐，大面积留白，左侧竖向色条
  - `cover3` 科技蓝调：左右分栏(30%+70%)
  - `cover4` 典雅中国：居中，CSS伪元素回纹边框装饰
  - `cover5` 活力橙光：对角线渐变背景
  - `cover6` 沉稳墨绿：全幅色块背景，白色文字
- 所有封面使用CSS变量引用配色（`var(--accent-primary)` 等）
- 封面结构：`<section class="cover cover-{n}" id="cover">` 包含 `cover-decoration` 和 `cover-content`
- 必含字段：project_name（空则显示"未命名项目"）、"投标文件"副标题、投标单位、日期
- 封面专用CSS（各模板的独特布局样式）
- 无效 cover_style 回退到 `'cover1'`

**验收标准**:
- 6种封面模板均有明显视觉差异（布局结构不同）
- 所有装饰元素颜色使用 `var(--accent-primary)` 等CSS变量
- 封面HTML包含 `<h1 class="cover-title">` 和项目名称文本

---

## 4. 后端 - 目录生成实现

**依赖**: 任务2
**涉及文件**: `backend/bid_writer_service/html_exporter.py`
**具体修改**:
- 实现 `_render_toc()` 方法：
  - 遍历 `outline.chapters` 提取三级结构（章→节→条）
  - 生成 `<section class="toc" id="toc">` 包含 `<nav class="toc-list">`
  - 每个条目为 `<a href="#chapter-{n}">` 锚点链接
  - 每个条目右侧显示页码（虚拟分页：基于字数估算，封面=1，目录=2，正文从3累加）
  - 三级缩进：`.toc-level-1` 无缩进粗体，`.toc-level-2` 缩进2em，`.toc-level-3` 缩进4em浅色
  - 大纲为空时显示"暂无章节"
  - 目录专用CSS样式

**验收标准**:
- 目录HTML包含锚点链接（`<a href="#chapter-1">`）
- 三级条目有不同缩进层级
- 大纲为空时输出包含"暂无章节"文本

---

## 5. 后端 - 正文内容渲染实现

**依赖**: 任务2
**涉及文件**: `backend/bid_writer_service/html_exporter.py`
**具体修改**:
- 实现 `_render_content()` 方法，支持3种布局：
  - `image` 模式（文+图）：文字在上，图片在下
  - `frame` 模式（文+表）：带边框表格，`.bid-table` 样式
  - `frame-image` 模式（文+表+图双栏）：`display: grid; grid-template-columns: 3fr 2fr`，窄屏回退单栏
- 实现 `_render_markdown_to_html()` 方法：
  - 优先使用 `markdown` 库（pip install markdown），回退到简化正则转换器
  - 转换规则：标题→h1-h6，粗体→strong，斜体→em，列表→ul/ol，表格→table，引用→blockquote，代码→code
  - 处理 `[[FIGURE:title|url=url]]` → `<figure><img><figcaption>`
- 实现 `_render_image()` 方法：
  - 将 `[IMAGE:keywords]` 标记替换为 `<img>` 标签
  - 图片设置 `loading="lazy"`、`max-height: min(50vh, 400px)`、`object-fit: contain`
  - 清除未替换的残留 `[IMAGE:xxx]` 标记
  - 跳过 selected_url 为空的图片
- 章节标题层级：章→h1，节→h2，条→h3
- 无效 layout_style 回退到 `'image'`
- 正文专用CSS样式

**验收标准**:
- `layout_style='image'` 输出文+图布局HTML
- `layout_style='frame-image'` 输出包含 `two-column` grid布局
- Markdown表格转换为 `<table><thead><tbody>` 结构
- `[IMAGE:keywords]` 被替换为 `<img>` 标签

---

## 6. 后端 - HTML文档组装与完整生成

**依赖**: 任务3, 任务4, 任务5
**涉及文件**: `backend/bid_writer_service/html_exporter.py`
**具体修改**:
- 完善 `generate_html()` 方法：
  - 调用 `_generate_css_vars()` 生成CSS变量
  - 调用 `_generate_base_css()` 生成基础CSS
  - 调用 `_render_cover()` 渲染封面
  - 调用 `_render_toc()` 渲染目录
  - 调用 `_render_content()` 渲染正文
  - 组装为完整HTML文档：`<!DOCTYPE html><html lang="zh-CN"><head>...<style>...</style></head><body>...</body></html>`
  - `<meta charset="UTF-8">` 和 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
  - `<title>{project_name} - 投标文件</title>`
  - 正文包裹在 `<div class="page-content">` 中
- 查询参数覆盖样式配置（cover_style、layout_style、color_scheme、has_page_border、dark_bid_mode）

**验收标准**:
- `generate_html(bid_doc)` 返回完整的HTML文档字符串
- HTML以 `<!DOCTYPE html>` 开头，包含 `<html>`、`<head>`、`<body>` 完整结构
- HTML内无 `<link rel="stylesheet">` 和 `<script src>` 外部引用（零依赖自包含）
- HTML大小不超过2MB

---

## 7. 后端 - /preview-html API端点

**依赖**: 任务6
**涉及文件**: `backend/bid_writer_service/api.py`
**具体修改**:
- 在 `api.py` 中新增 `GET /{bid_id}/preview-html` 端点（与 `/{bid_id}/export` 同级）
- 端点参数：
  - `bid_id: str`（路径参数）
  - `current_user: dict = Depends(get_current_user)`（JWT认证，与现有端点一致）
  - `cover_style: Optional[str] = None`（查询参数）
  - `layout_style: Optional[str] = None`
  - `color_scheme: Optional[str] = None`
  - `has_page_border: Optional[str] = None`
  - `dark_bid_mode: Optional[str] = None`
- 处理流程（对齐 `export_document` 模式）：
  1. 查询BidDocument → 不存在返回404
  2. 校验 `status == COMPLETED` → 未完成返回400
  3. 查询参数覆盖样式配置（与 `export_document` 相同逻辑）
  4. 在线程池中执行 `BidHtmlExporter.generate_html(bid_doc)`
  5. 返回 `HTMLResponse(content=html_str, media_type="text/html; charset=utf-8")`
- 新增 import：`from .html_exporter import BidHtmlExporter`、`from fastapi.responses import HTMLResponse`
- 异常处理：HTML生成异常返回500

**验收标准**:
- `GET /api/bid-writer/{bid_id}/preview-html` 返回 Content-Type: text/html
- 无Token返回401，bid_id不存在返回404，status≠completed返回400
- 响应体为完整HTML文档字符串

---

## 8. 前端 - 路由类型注册

**依赖**: 无
**涉及文件**: `src/navigation/types.ts`
**具体修改**:
- 在 `RootStackParamList` 中新增路由定义：
  ```typescript
  BidHtmlPreview: { bidId: string };
  ```
- 位置：紧跟 `BidWriter` 路由定义之后

**验收标准**: TypeScript编译无报错，`RootStackParamList` 包含 `BidHtmlPreview` 类型

---

## 9. 前端 - API服务方法扩展

**依赖**: 任务8
**涉及文件**: `src/services/bidWriter.ts`
**具体修改**:
- 在 `bidWriterApi` 对象中新增 `previewHtml` 方法（紧跟 `exportDocument` 方法之后）：
  ```typescript
  previewHtml: (bidId: string, styleOptions?: {
    cover_style?: string;
    layout_style?: string;
    color_scheme?: string;
    has_page_border?: boolean;
    dark_bid_mode?: boolean;
  }) =>
    api.get<string>(`/api/bid-writer/${bidId}/preview-html`, {
      params: styleOptions,
      timeout: 10000,
    }),
  ```
- 返回类型为 `string`（完整HTML文档字符串）

**验收标准**: `bidWriterApi.previewHtml('xxx')` 可调用并返回Promise<string>

---

## 10. 前端 - BidHtmlPreviewScreen 预览页面组件

**依赖**: 任务9
**涉及文件**: `src/screens/aitools/bidwriter/BidHtmlPreviewScreen.tsx`（新建）
**具体修改**:
- 新建组件文件，复用 `MarpSlideViewerScreen` 的 WebView 渲染模式和视觉风格
- 组件签名：`const BidHtmlPreviewScreen: FC<RootStackScreenProps<'BidHtmlPreview'>>`
- 状态管理：
  - `htmlContent: string` — 后端返回的HTML字符串
  - `loading: boolean` — 加载状态
  - `error: string | null` — 错误信息
  - `exporting: boolean` — 导出中
  - `exportModalVisible: boolean` — 导出弹窗可见
  - `exportFilePath: string` / `exportFileName: string` — 导出文件信息
- 核心逻辑：
  - `useEffect` 进入页面时调用 `bidWriterApi.previewHtml(bidId)` 获取HTML
  - bidId缺失时显示参数错误提示
  - API失败时显示错误页+重试按钮
  - WebView渲染：`source={{ html: htmlContent }}`，`originWhitelist={['*']}`
  - WebView `onLoadEnd` 设置 `loading=false`，`onError` 设置错误信息
- 顶部导航栏（复用MarpSlideViewerScreen风格）：
  - 左侧：返回按钮（ChevronLeft，36x36圆形半透明背景，白色图标）
  - 中间：项目名称标题（白色16号粗体，单行省略）
  - 右侧：导出按钮（Upload图标+"导出"文字，半透明胶囊背景）
- 背景：`<LinearGradient colors={['#80011A', '#000000']}>` 深红渐变背景
- 加载状态：居中 `<ActivityIndicator size="large" color="#fff" />`
- 错误状态：错误提示文字 + "重试"按钮
- 导出功能：
  - 点击导出按钮调用 `bidWriterApi.exportDocument(bidId, 'docx')`
  - 下载docx写入本地临时文件
  - 弹出 `ExportModal` 组件
  - 导出中按钮显示loading，disabled状态
- 复用 `<ExportModal>` 组件（`src/components/bidwriter/ExportModal.tsx`）
- 使用 `useSafeAreaInsets` 适配安全区域

**验收标准**:
- 进入页面显示Loading动画
- API返回后WebView渲染HTML内容
- 顶部导航栏包含返回按钮、标题、导出按钮
- API失败显示错误页+重试按钮
- 点击导出按钮可触发Word文档导出并弹出ExportModal

---

## 11. 前端 - BidWriterContainer 底部按钮变更

**依赖**: 任务10
**涉及文件**: `src/screens/aitools/bidwriter/BidWriterContainer.tsx`
**具体修改**:
- 修改 `getMainButtonText()` 中 Step3 完成状态的返回值：
  ```typescript
  // 当前：case 3: if (status === 'completed') return '导出标书';
  // 改为：
  case 3:
    if (status === 'completed') return '预览标书';
  ```
- 修改 `onMainButtonPress` 回调中 Step3 完成状态的行为：
  ```typescript
  // 当前：case 3: if (status === 'completed') { // TODO: 导出逻辑 }
  // 改为：
  case 3:
    if (status === 'completed') {
      navigation.navigate('BidHtmlPreview', { bidId: bidId! });
    }
    break;
  ```
- **不变更**：Step1和Step2的按钮逻辑、Step3非完成状态的按钮逻辑

**验收标准**:
- Step3完成状态时底部按钮显示"预览标书"
- 点击"预览标书"导航至BidHtmlPreview页面
- Step3未完成状态按钮行为不变
- Step1和Step2按钮行为不变

---

## 12. 前端 - RootNavigator 路由注册

**依赖**: 任务10
**涉及文件**: `src/navigation/RootNavigator.tsx`
**具体修改**:
- 新增 import：
  ```typescript
  import BidHtmlPreviewScreen from '@/screens/aitools/bidwriter/BidHtmlPreviewScreen';
  ```
- 在 `Stack.Navigator` 中新增 Screen（紧跟 `BidWriter` 之后）：
  ```typescript
  <Stack.Screen name="BidHtmlPreview" component={BidHtmlPreviewScreen} />
  ```

**验收标准**: 
- 应用可正常启动，无路由注册报错
- `navigation.navigate('BidHtmlPreview', { bidId: 'xxx' })` 可正常跳转

---

## 13. 端到端联调验证

**依赖**: 任务7, 任务12
**涉及文件**: 前端 + 后端全链路
**具体修改**: 无代码修改，执行联调验证
- 启动后端服务，确认 `/preview-html` 端点可访问
- 在前端BidWriter完成标书后点击"预览标书"按钮
- 验证页面跳转至BidHtmlPreviewScreen
- 验证WebView正确渲染HTML内容（封面+目录+正文）
- 验证返回按钮可回退至BidWriter页面
- 验证导出按钮可正常导出Word文档并弹出ExportModal

**验收标准**:
- 全链路流程可走通：点击预览→跳转→加载HTML→WebView渲染→导出Word→保存/分享
- HTML预览页面可正常滚动浏览全部内容

---

## 14. 异常场景验证

**依赖**: 任务13
**涉及文件**: 前端 + 后端
**具体修改**: 无代码修改，执行异常场景验证
- bidId缺失：验证前端显示参数错误提示
- API请求失败：验证前端显示错误页+重试按钮
- WebView渲染错误：验证显示"页面加载异常"提示
- HTML内容为空：验证显示空状态提示
- 未认证请求：验证后端返回401
- 标书不存在：验证后端返回404
- 标书未完成：验证后端返回400
- 导出API失败：验证显示"导出失败，请重试"提示
- 无效样式参数：验证回退到默认值（cover1, black, image）

**验收标准**: 所有异常场景均有友好错误提示，无白屏或崩溃

---

## 15. 性能验收与最终检查

**依赖**: 任务14
**涉及文件**: 前端 + 后端
**具体修改**: 无代码修改，执行性能验收
- 后端 `/preview-html` 响应时间 ≤ 5秒（标书≤10万字）
- WebView首次可交互时间 ≤ 3秒
- HTML字符串大小 ≤ 2MB
- 导出功能与现有逻辑完全一致（导出链路未受影响）
- CSS变量主题：7种色系 × 亮/暗模式共14种组合均正确渲染
- 6种封面模板均有明显视觉差异
- 3种版式布局（image/frame/frame-image）均正确渲染
- 离线可用：HTML无外部CSS/JS/字体引用
- 响应式：不同屏幕尺寸下HTML内容自适应

**验收标准**: 所有性能指标满足spec.md DFX约束要求
