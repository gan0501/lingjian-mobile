# 领建AI - iOS端

## 项目信息
| 项目 | 信息 |
|------|------|
| **应用名称** | 领建AI |
| **平台** | iOS |

---

## 技术栈
| 层级 | 技术 |
|------|------|
| **框架** | React Native 0.73.2 |
| **语言** | TypeScript + Swift/Objective-C |
| **构建工具** | Xcode |
| **依赖管理** | CocoaPods |

---

## 地图配置
| 地图 | 说明 |
|------|------|
| **天地图** | 主要地图源 |
| **高德地图** | 兜底地图源 |

**地图策略**: 天地图优先，高德兜底（生产环境）

---

## 项目结构
```
ios/
├── LingjianAI.xcworkspace
├── LingjianAI.xcodeproj
├── Podfile
├── Podfile.lock
└── ...
```

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
# 安装依赖
cd ios && pod install && cd ..

# 运行iOS
npm run ios
```
