# 领建AI - Android端

## 项目信息
| 项目 | 信息 |
|------|------|
| **应用名称** | 领建AI |
| **包名** | cn.lingjianai.android |
| **版本** | 1.0.0 (versionCode: 1000000) |
| **命名空间** | com.lingjianai |

---

## 技术栈
| 层级 | 技术 |
|------|------|
| **框架** | React Native 0.73.2 |
| **语言** | TypeScript + Kotlin |
| **构建工具** | Gradle |
| **编译SDK** | 34 |
| **目标SDK** | 34 |
| **最低SDK** | 23 (Android 6.0) |
| **NDK版本** | 26.1.10909125 |
| **Kotlin版本** | 1.9.22 |
| **构建工具版本** | 34.0.0 |

---

## 核心依赖
| 依赖 | 版本 | 用途 |
|------|------|------|
| react-native | 0.73.2 | 核心框架 |
| react | 18.2.0 | UI库 |
| zustand | ^4.4.7 | 状态管理 |
| axios | ^1.6.5 | HTTP请求 |
| @tanstack/react-query | ^5.90.20 | 数据缓存 |
| react-navigation/native | ^6.1.9 | 导航 |
| react-native-paper | ^5.11.6 | UI组件 |
| lucide-react-native | ^0.303.0 | 图标 |
| react-native-amap3d | ^3.0.6 | 高德地图 |
| @maplibre/maplibre-react-native | ^10.4.2 | 天地图 |
| react-native-mmkv | ^2.11.0 | 本地存储 |
| @react-native-async-storage/async-storage | ^2.2.0 | 异步存储 |
| three | ^0.183.2 | 3D渲染 |
| marked | ^17.0.1 | Markdown解析 |

---

## 原生依赖
| 依赖 | 用途 |
|------|------|
| com.amap.api:3dmap:10.0.600 | 高德3D地图 |
| com.google.android.gms:play-services-location:21.0.1 | 定位服务 |
| libs/sherpa-onnx-1.12.23.aar | 语音识别 |
| libs/alipaySdk-15.7.5-20200422171619.aar | 支付宝支付 |
| org.nanohttpd:nanohttpd:2.3.1 | 本地HTTP服务器 |
| com.alibaba:fastjson:1.2.83 | JSON解析 |

---

## 地图配置
| 地图 | 密钥 | 说明 |
|------|------|------|
| **高德地图** | b24567268a5c80b5226f9762bc0f2171 | Android原生地图 |
| **天地图浏览器** | 5f0faa0b93213cc747eebab0891c2cfc | WebView使用 |
| **天地图服务器** | 0c6848d508cb374782cf1481056e23cf | RN直接请求 |

**地图策略**: 天地图优先，高德兜底（生产环境）

---

## 签名配置
| 项目 | 信息 |
|------|------|
| **别名** | lingjianai |
| **签名密码** | Lingjian888 |
| **SHA256** | 2E:E8:52:88:E3:9B:4F:29:CD:96:4E:FC:7F:DD:1A:FE:10:8F:2D:18:3E:BA:1E:1B:55:43:97:1D:D0:28:80:90 |
| **所有者** | CN=领建AI, OU=Development, O=LingJianAI, L=Hangzhou, ST=Zhejiang, C=CN |

**注意**: 发布版本签名配置从 `local.properties` 读取，请勿提交到版本控制。

---

## ABI支持
- arm64-v8a (仅64位)

---

## 权限列表
| 权限 | 用途 |
|------|------|
| INTERNET | 网络请求 |
| CAMERA | 相机/水印相机 |
| ACCESS_FINE_LOCATION | 精确定位 |
| ACCESS_COARSE_LOCATION | 粗略定位 |
| ACCESS_BACKGROUND_LOCATION | 后台定位 |
| WRITE_EXTERNAL_STORAGE | 文件写入 |
| READ_EXTERNAL_STORAGE | 文件读取 |
| READ_PHONE_STATE | 设备信息 |
| RECORD_AUDIO | 语音输入 |
| FOREGROUND_SERVICE | 前台服务 |
| POST_NOTIFICATIONS | 通知 |
| WAKE_LOCK | 唤醒锁 |

---

## 项目结构
```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/lingjianai/
│   │   │   ├── MainActivity.kt          # 主Activity
│   │   │   ├── MainApplication.kt       # Application
│   │   │   ├── AssetHttpServer.java     # 本地HTTP服务器
│   │   │   ├── sherpa/                  # 语音识别模块
│   │   │   └── share/                   # 分享处理模块
│   │   │   └── watermarkcamera/         # 水印相机模块
│   │   ├── assets/                      # 静态资源
│   │   │   ├── fonts/                   # CAD字体
│   │   │   ├── gltf/                    # 3D模型
│   │   │   └── pdfjs/                   # PDF查看器
│   │   └── res/                         # Android资源
│   ├── build.gradle                     # 应用级构建配置
│   └── proguard-rules.pro               # 混淆规则
├── build.gradle                         # 项目级构建配置
├── gradle.properties                    # Gradle属性
└── settings.gradle                      # Gradle设置
```

---

## 百度语音识别
应用名称：领建AI
应用描述：语音输入
AppID：7689712
API Key：5VOFETujF0WOSmt33ozs1Sq5
Secret Key：JKBiAl4CzFOvbjKBMzDI1ySFgnd3wUrA

---

## API服务地址
| 环境 | 地址 |
|------|------|
| **生产环境** | https://api.lingjianai.cn |
| **备用生产** | https://linkbuild.com.cn |
| **云服务器** | http://115.190.218.156:8000 |
| **本地开发** | http://192.168.50.166:8000 |

---

## 构建命令
```bash
# 清理构建
npm run clean

# 完全清理
npm run clean:all

# 运行Android
npm run android

# 类型检查
npm run type-check

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
```
