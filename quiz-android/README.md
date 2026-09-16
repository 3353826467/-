# 题库大师 - Android Studio 项目

## 项目简介
基于 WebView 的刷题背题 Android 应用，支持：
- 导入题库（粘贴文本/上传 txt/docx/doc/pdf/xlsx/xls/csv 文件）
- 自动提取文档文本后送入题目解析器
- 自动识别题型（单选/多选/判断/填空/简答）
- 支持接入 OpenAI 兼容 AI：AI 识别题目、自动排版、AI 生成解析、AI 接口测试、OCR 图片识题、主观题语义判分、批量补全解析
- 背题模式（翻卡式）
- 刷题模式（即时判分）
- 错题本（自动收录/跨题库练习）
- 学习统计（正确率趋势图）
- 题库管理（重命名/编辑/删除/导出）
- 数据备份/恢复

## 环境要求
- Android Studio Hedgehog (2023.1.1) 或更高版本
- JDK 17（Android Studio 内置）
- Android SDK 34 (Android 14)
- 最低支持 Android 5.0 (API 21)

## 编译步骤

### 方法一：Android Studio（推荐）
1. 打开 Android Studio
2. 选择 `File` → `Open` → 选择 `quiz-android` 文件夹
3. 等待 Gradle 同步完成（首次会自动下载依赖）
4. 点击 `Run` 按钮或 `Shift+F10` 编译并运行

### 方法二：命令行
```bash
# 生成 Gradle Wrapper（如果不存在）
gradle wrapper

# 编译 Debug APK
./gradlew assembleDebug

# 生成的 APK 位于：
# app/build/outputs/apk/debug/app-debug.apk
```

## 项目结构
```
quiz-android/
├── build.gradle                    # 项目级构建配置
├── settings.gradle                 # 项目设置
├── gradle.properties               # Gradle 属性
├── gradle/wrapper/
│   └── gradle-wrapper.properties   # Gradle 版本配置
├── app/
│   ├── build.gradle                # 应用模块构建配置
│   ├── proguard-rules.pro          # ProGuard 规则
│   └── src/main/
│       ├── AndroidManifest.xml     # 应用清单
│       ├── java/com/quizmaster/app/
│       │   └── MainActivity.java   # 主 Activity（WebView 容器）
│       ├── assets/                 # Web 应用资源
│       │   ├── index.html          # 主页面
│       │   ├── css/styles.css      # 样式
│       │   ├── js/
│       │   │   ├── storage.js      # 数据存储层
│       │   │   ├── parser.js       # 题目解析器
│       │   │   ├── fileparser.js   # 多格式文档文本提取
│       │   │   ├── libs/           # mammoth/pdf.js/xlsx 浏览器库
│       │   │   └── app.js          # 主应用逻辑
│       │   ├── manifest.json       # PWA 清单
│       │   └── icons/icon.svg      # 应用图标
│       └── res/                    # Android 资源
│           ├── layout/activity_main.xml
│           ├── values/             # 字符串/颜色/主题
│           ├── drawable/           # 图标资源
│           ├── mipmap-anydpi-v26/  # 自适应图标
│           └── xml/                # 配置文件
```

## 技术架构
- **原生层**：Android WebView 容器，处理文件选择、文件保存、返回键
- **Web 层**：HTML + CSS + JavaScript，所有业务逻辑在 Web 端实现
- **数据存储**：localStorage（WebView 的 DOM Storage）
- **AI 能力**：通过前端 fetch 调用 OpenAI 兼容聊天接口，支持接口测试、OCR 识题、批量补解析、主观题语义判分与失败自动回退
- **文件保存**：通过 JavaScript Interface 调用原生方法保存到下载目录

## 注意事项
1. 首次打开 Android Studio 时会提示生成 Gradle Wrapper，点击确认即可
2. 如果 SDK 版本不匹配，在 `app/build.gradle` 中修改 `compileSdk` 和 `targetSdk`
3. 导出的文件保存在设备的 `下载/QuizMaster/` 目录
4. 应用数据存储在 WebView 的 localStorage 中，卸载应用会清除数据
