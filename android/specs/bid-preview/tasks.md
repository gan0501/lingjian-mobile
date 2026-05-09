# 标书预览与导出功能 — 编码任务清单

> 基于需求规格(spec.md)和实现方案(design.md)生成，共 8 个任务组、25 个子任务，覆盖全部 5 项核心能力。

---

## 1. 路由类型与导航注册

> **依赖**：无（基础层）
> **涉及文件**：`src/navigation/types.ts`、`src/navigation/RootNavigator.tsx`

- [ ] 在 `RootStackParamList` 中新增 `BidPreview` 路由类型定义
  - 修改文件：`src/navigation/types.ts`
  - 在 `BidWriter` 行后新增：`BidPreview: { bidId: string; title?: string } | undefined;`
  - 验收：TypeScript 编译通过，`RootStackScreenProps<'BidPreview'>` 可正常使用

- [ ] 在 `RootNavigator.tsx` 中注册 `BidPreview` 路由
  - 修改文件：`src/navigation/RootNavigator.tsx`
  - 新增 import：`import BidPreviewScreen from '@/screens/aitools/bidwriter/BidPreviewScreen';`
  - 在 `BidWriter` Screen 后新增：`<Stack.Screen name="BidPreview" component={BidPreviewScreen} />`
  - 验收：导航到 `BidPreview` 路由不报错，页面可正常挂载

---

## 2. API 接口层 — 新增 previewPdf 方法

> **依赖**：无（基础层）
> **涉及文件**：`src/services/bidWriter.ts`

- [ ] 在 `bidWriterApi` 对象中新增 `previewPdf` API 方法
  - 修改文件：`src/services/bidWriter.ts`
  - 在 `exportDocument` 方法附近新增：
    ```typescript
    previewPdf: (bidId: string) =>
      api.get<any, any>(`/api/bid-writer/${bidId}/preview-pdf`, {
        responseType: 'arraybuffer',
        timeout: 60000,
      }),
    ```
  - 验收：调用 `bidWriterApi.previewPdf(bidId)` 可正确发起请求，responseType 和 timeout 配置生效

---

## 3. PDF 缓存管理器

> **依赖**：无（基础层）
> **涉及文件**：`src/screens/aitools/bidwriter/utils/pdfCacheManager.ts`（新建）

- [ ] 创建 `pdfCacheManager.ts` 工具模块
  - 新建文件：`src/screens/aitools/bidwriter/utils/pdfCacheManager.ts`
  - 实现 `PdfCacheManager` 接口的 4 个方法：
    - `getCachePath(bidId)` — 检查 `RNFS.CachesDirectoryPath/bid_preview_pdf/{bidId}.pdf` 是否存在，存在返回路径，不存在返回 null
    - `saveCache(bidId, data)` — 确保 `bid_preview_pdf/` 目录存在，将 ArrayBuffer 转为 base64 写入文件，返回本地路径
    - `clearCache(bidId)` — 删除指定 bidId 的缓存文件
    - `clearAllCache()` — 删除整个 `bid_preview_pdf/` 目录
  - 缓存目录常量：`const PDF_CACHE_DIR = \`${RNFS.CachesDirectoryPath}/bid_preview_pdf\`;`
  - 验收：缓存读写正常，目录不存在时自动创建，清理功能正确

---

## 4. PDF 预览子组件

> **依赖**：任务 3（pdfCacheManager）
> **涉及文件**：4 个新文件

### 4.1 PdfWebView 组件

- [ ] 创建 `PdfWebView.tsx` — 基于 WebView + pdf.js 的 PDF 渲染组件
  - 新建文件：`src/screens/aitools/bidwriter/components/PdfWebView.tsx`
  - Props 接口：`{ filePath: string; onLoadStart?: () => void; onLoadEnd?: () => void; onError?: (error: string) => void; }`
  - WebView 加载 `pdf_viewer.html`（Android: `file:///android_asset/pdf_viewer.html`，iOS: `pdf_viewer.html`）
  - WebView 配置：`allowFileAccess=true`、`allowUniversalAccessFromFileURLs=true`、`originWhitelist=['*']`、`mixedContentMode="always"`、`javaScriptEnabled=true`、`domStorageEnabled=true`、`scrollEnabled=true`
  - onLoadEnd 后通过 `injectJavaScript` 注入 PDF 文件路径调用 `loadPdf('file://...')`
  - 参考 `MarpSlideViewerScreen.tsx` 的 WebView 配置模式
  - 验收：传入本地 PDF 文件路径后可正常渲染，支持缩放和滚动

- [ ] 创建 `pdf_viewer.html` — PDF.js viewer 本地 HTML 资源
  - 新建文件：`src/assets/pdf_viewer.html`（需同步到 android/app/src/main/assets/）
  - 内嵌 pdf.js CDN：`<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs"></script>`
  - 实现 `loadPdf(filePath)` 全局函数：解析 PDF，逐页渲染到 canvas 容器
  - 支持缩放（viewport meta `maximum-scale=3.0, user-scalable=yes`）和滚动
  - 验收：HTML 在 WebView 中可加载，注入 `loadPdf('file:///...')` 后 PDF 逐页渲染

### 4.2 BidPreviewHeader 组件

- [ ] 创建 `BidPreviewHeader.tsx` — 预览页面顶部标题栏
  - 新建文件：`src/screens/aitools/bidwriter/components/BidPreviewHeader.tsx`
  - Props 接口：`{ title: string; onBack: () => void; onExport: () => void; exporting: boolean; }`
  - 布局：左侧返回按钮（ChevronLeft 图标，暗色圆形背景）→ 中间标书标题（单行省略）→ 右侧导出按钮（Upload 图标 + 文字，导出中显示"导出中…"并 disabled）
  - 样式参考 `MarpSlideViewerScreen.tsx` 的 header 样式（LinearGradient 深色背景、白色文字）
  - 验收：返回按钮点击触发 onBack，导出按钮点击触发 onExport，导出中按钮显示禁用态

### 4.3 BidPreviewErrorView 组件

- [ ] 创建 `BidPreviewErrorView.tsx` — 预览错误状态视图
  - 新建文件：`src/screens/aitools/bidwriter/components/BidPreviewErrorView.tsx`
  - Props 接口：`{ type: 'load_failed' | 'render_failed' | 'service_unavailable' | 'timeout'; message: string; onRetry?: () => void; onExportDocx?: () => void; }`
  - 根据错误类型显示不同内容：
    - `load_failed` / `timeout`：显示重试按钮
    - `render_failed` / `service_unavailable`：显示"导出Word"按钮
  - 居中布局：图标 + 提示文案 + 操作按钮
  - 验收：4 种错误类型均正确渲染，按钮回调正确触发

### 4.4 组件导出

- [ ] 更新组件导出索引文件
  - 修改文件：`src/screens/aitools/bidwriter/components/index.ts`
  - 新增导出：`export { PdfWebView } from './PdfWebView';`、`export { BidPreviewHeader } from './BidPreviewHeader';`、`export { BidPreviewErrorView } from './BidPreviewErrorView';`
  - 验收：从 `./components` 路径可正确导入新组件

---

## 5. BidPreviewScreen 主页面

> **依赖**：任务 1（路由）、任务 2（API）、任务 3（缓存）、任务 4（子组件）
> **涉及文件**：`src/screens/aitools/bidwriter/BidPreviewScreen.tsx`（新建）

- [ ] 创建 `BidPreviewScreen.tsx` — 标书预览主页面
  - 新建文件：`src/screens/aitools/bidwriter/BidPreviewScreen.tsx`
  - 类型：`type Props = RootStackScreenProps<'BidPreview'>;`
  - State 设计：
    - `loading` — PDF 加载中
    - `pdfFilePath` — 本地 PDF 文件路径
    - `error` — 错误状态（type + message）
    - `title` — 标书标题
    - `exporting` — 导出中
    - `exportModalVisible` — 导出弹窗可见
    - `exportFileName` / `exportFilePath` — 导出文件信息
  - 核心方法：
    - `loadPdfPreview(bidId)` — 先查缓存，缓存命中直接使用；未命中则调用 `bidWriterApi.previewPdf(bidId)` 请求服务端，保存缓存后设置路径
    - `fetchTitle(bidId)` — 优先使用 route.params.title，缺失时调用 `bidWriterApi.getStatus(bidId)` 获取
    - `handleExport()` — 调用 `bidWriterApi.exportDocument(bidId, 'docx')`，将 ArrayBuffer 转 base64 写入本地文件，弹出 ExportModal
    - `sanitizeFileName(name)` — 替换 `\\/:*?"<>|\n\r\t` 为下划线
    - `classifyError(err)` — 根据 err.message 识别 timeout / service_unavailable / load_failed
  - 生命周期：`useEffect` 中并行加载 `fetchTitle` 和 `loadPdfPreview`
  - 渲染结构：`BidPreviewHeader` → (loading ? Loading : error ? `BidPreviewErrorView` : `PdfWebView`) → `ExportModal`（复用现有 `@/components/bidwriter/ExportModal`）
  - 背景：使用 LinearGradient 深色背景，与 MarpSlideViewerScreen 保持一致
  - 验收：进入页面自动加载 PDF 预览，加载中显示 Loading，加载失败显示错误视图，点击导出弹出导出弹窗

---

## 6. 导航逻辑修改 — MyBidsSidebar

> **依赖**：任务 1（路由类型）、任务 5（BidPreviewScreen）
> **涉及文件**：`src/screens/aitools/bidwriter/BidWriterContainer.tsx`

- [ ] 修改 `handleSelectMyBid` 方法 — 已完成标书跳转预览页面
  - 修改文件：`src/screens/aitools/bidwriter/BidWriterContainer.tsx`
  - 当前代码（第 205-209 行）：
    ```typescript
    const handleSelectMyBid = useCallback((item: MyBidsListItem) => {
      closeMyBids();
      const targetStep = statusToStep(item.status);
      navigation.replace('BidWriter', { bidId: item.id, step: targetStep });
    }, [closeMyBids, navigation, statusToStep]);
    ```
  - 修改为：
    ```typescript
    const handleSelectMyBid = useCallback((item: MyBidsListItem) => {
      closeMyBids();
      if (item.status === 'completed' || item.status === 'exported') {
        navigation.navigate('BidPreview', { bidId: item.id, title: item.title });
      } else {
        const targetStep = statusToStep(item.status);
        navigation.replace('BidWriter', { bidId: item.id, step: targetStep });
      }
    }, [closeMyBids, navigation, statusToStep]);
    ```
  - 关键变化：completed/exported 使用 `navigation.navigate`（非 replace）跳转到 BidPreview，传入 title 参数
  - 验收：点击已完成标书跳转到 BidPreviewScreen，点击草稿标书仍跳转到 BidWriter 对应步骤

---

## 7. 导航逻辑修改与 Bug 修复 — AgentWorkbenchScreen

> **依赖**：任务 1（路由类型）、任务 5（BidPreviewScreen）
> **涉及文件**：`src/screens/agent/AgentWorkbenchScreen.tsx`

- [ ] 修改 `handleResultPress` 方法 — bid_writer 类型已完成后跳转预览页面，非完成状态传递 step 参数
  - 修改文件：`src/screens/agent/AgentWorkbenchScreen.tsx`
  - 当前代码（第 156-175 行）：
    ```typescript
    const handleResultPress = (item: TaskResultItem) => {
      if (isWorking(item.status)) { ... }
      if (isFailed(item.status)) { ... }
      const config = AGENT_TYPE_MAP[agentType];
      if (!config?.navRoute) return;
      if (agentType === 'bid_writer') {
        navigation.navigate(config.navRoute, { bidId: item.id });
      } ...
    };
    ```
  - 修改 `bid_writer` 分支为：
    ```typescript
    if (agentType === 'bid_writer') {
      if (isCompleted(item.status)) {
        navigation.navigate('BidPreview', { bidId: item.id, title: item.title });
      } else {
        const step = mapBidStatusToStep(item.status);
        navigation.navigate('BidWriter', { bidId: item.id, step });
      }
    }
    ```
  - 新增辅助函数 `mapBidStatusToStep`：
    ```typescript
    const mapBidStatusToStep = (status: string): number => {
      if (['completed', 'exported', 'reviewing', 'generating', 'outline_confirmed'].includes(status)) return 3;
      if (['generating_outline', 'outline_editing', 'parsed'].includes(status)) return 2;
      return 1;
    };
    ```
  - 验收：点击已完成标书结果 → 导航到 BidPreviewScreen；点击草稿标书结果 → 导航到 BidWriter 并传入正确 step；点击工作中结果 → toast 提示；点击失败结果 → toast 提示

- [ ] 不修改 `AGENT_TYPE_MAP` — 保持 `navRoute: 'BidWriter'` 不变
  - 原因：`navRoute: 'BidWriter'` 仍在"创建任务"场景中使用，导航逻辑已在 `handleResultPress` 中单独判断
  - 验收：创建任务入口正常跳转到 BidWriter

---

## 8. 集成验证与边界测试

> **依赖**：任务 5-7 全部完成
> **涉及文件**：全部新增和修改文件

- [ ] 验证从"我的标书"侧边栏点击已完成标书 → 进入 BidPreviewScreen 并显示 PDF 预览
- [ ] 验证从 AgentWorkbenchScreen 点击已完成标书结果 → 进入 BidPreviewScreen 并显示 PDF 预览
- [ ] 验证 PDF 预览加载失败 → 显示错误提示和重试按钮，点击重试重新加载
- [ ] 验证 PDF 渲染异常 → 显示降级提示和"导出Word"按钮
- [ ] 验证点击导出按钮 → 弹出 ExportModal，"保存到本地"正常保存，"转存到微信"正常调起分享
- [ ] 验证导出过程中导出按钮显示"导出中…"且不可重复点击
- [ ] 验证导出文件名规则 — 标题中非法字符替换为下划线，后缀为 .docx
- [ ] 验证 PDF 缓存策略 — 第二次打开同一标书时优先使用缓存，无多余网络请求
- [ ] 验证草稿/编写中标书仍正常跳转到 BidWriter 对应步骤页面（回归测试）
- [ ] 验证 bidId 缺失时显示"标书信息异常"提示并返回上一页
