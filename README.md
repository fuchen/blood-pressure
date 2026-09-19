# 安心血压

Android 优先的 React Native 本地血压记录应用，中文界面，无账号、无自建后端。

## 功能

- 手动记录、修改及删除血压和可选心率，附测量时间、手臂、服药情况、症状和备注。
- 中国成年家庭血压参考标记，危险读数本地提示；血压与心率趋势、日均值和日内范围。
- DeepSeek Flash 拍照/多图识别、Excel 智能批量导入，预览核对、查重、失败批次重试和草稿恢复。
- 最近 7 天、30 天、半年、一年、全部的 Excel / PNG 报告，完整分页明细、文件夹保存和系统多文件分享。
- 历史记录使用两列表格：日期 / 时分、血压 / 心率；心率带图标。导入预览保留核对表格；导入与分享收在记录页菜单；趋势下拉范围保存到本机，重启后恢复。
- API Key 系统安全存储、可配置早晚提醒。
- 大字体下按钮、统计卡片和录入栏自动纵向排列；测量手臂、服药情况使用可滚动的单选弹窗，编辑时保留已有自定义值。

## 开发环境

使用 Expo SDK 57、React Native 0.86、React 19、TypeScript、Expo Router、SQLite、SecureStore、SVG 和 SheetJS。依赖以 `package-lock.json` 为准。

需要 Node.js 22.13+、npm、JDK 17+、Android SDK 36 / Build Tools 36，以及可用的 Android 模拟器或真机。推荐使用 Android Studio 自带 JBR。

```powershell
npm ci
npm run typecheck
npm test
npx expo prebuild --platform android
npm run android
```

本应用含 `react-native-share` 等原生模块，需要 development build，不能仅通过 Expo Go 运行。`android/` 是 Expo 生成目录；修改原生配置应更新 `app.json` 或 config plugin 后重新 prebuild。

## 生成可独立安装的测试 APK

```powershell
.\scripts\build-android.ps1
adb -s <设备序列号> install -r artifacts\pressure-journal-1.0.0.apk
```

构建脚本执行依赖安装、类型检查、测试、Expo prebuild 和 `assembleRelease`，最终将 APK 放入 `artifacts/`。使用 release JS bundle，无需电脑或 Metro 服务即可运行；签名使用 Expo 模板的调试证书，**仅用于测试，不是应用商店正式发行包**。发布前必须换为自己的正式签名。

默认包含 arm64-v8a（现代 Android 手机）和 x86_64（模拟器），Android 7.0 / API 24 起。需要 32 位手机时可运行：

```powershell
.\scripts\build-android.ps1 -Architectures 'armeabi-v7a,arm64-v8a,x86_64'
```

## AI 配置与隐私

在应用「设置」中输入个人 DeepSeek API Key。密钥由 SecureStore 使用 Android Keystore 支持的安全机制保存，保存后只显示前后 4 位。没有内置 Key，也没有测试 Key 环境变量被打入客户端。

所有 AI 调用直接访问 `https://api.deepseek.com/chat/completions`，模型固定 `deepseek-flash`。首次启用需同意上传说明。Excel 本地解析后按 40 行分批发送；图片转换成 JPEG 后发送。源内容被当作数据处理，结构化结果通过 Zod 校验，只有用户确认后才能入库。

普通记录、图表、报告及本应用 Excel 备份恢复均可离线使用。其他 Excel 与图片智能导入需要个人 Key 和网络。API 费用由 Key 对应账号承担。

记录保存于应用私有 SQLite 数据库；不包含云同步，不启用 Android 自动备份。卸载应用将丢失数据，请先导出 Excel。原始图片只作缓存处理；导入草稿保存识别结果，不持久化原图。生成报告暂存缓存，超过一天的报告在下次打开导出页时清理。

设置不提供清空全部本地数据入口，仍可编辑或删除单条记录。

## 数据规则

- 收缩压 ≥135 或舒张压 ≥85 mmHg 为偏高；收缩压 <90 或舒张压 <60 为偏低；高低并存时同时提示。
- 收缩压 ≥180 或舒张压 ≥120 触发明显升高提示，伴危险症状时提示急救；单次异常不等于确诊。
- 静息心率参考 60–100 次/分。心率缺失不推测、不参与均值。
- 原始测量保存 UTC 时间与原始时区偏移，界面按当前手机时区展示。7/30 天包含今天；半年 / 一年回溯 6 / 12 个日历月，月底夹取目标月最后一天。
- 完全重复依据测量时刻、收缩压、舒张压、心率判定，默认排除，可手动保留。
- AI 缺失/不确定时间必须核对；拍照可预填拍摄时间，但仍需确认。
- 批量导入先选择图片或 Excel，再填写补充说明（如缺失年份），点击开始导入才执行识别；备份也在点击开始后离线解析为预览。说明用于下一次识别或失败重试，不改变已识别记录及备份原数据。
- 记录血压页提供拍照 / 相册入口，识别后填写表单；多条结果可选择其中一条，未保存前不入库。
- Excel 备份保留时间精度、时区、背景与来源；恢复时生成新记录 ID，按读数查重。导出文本不解释为公式。
- 智能 Excel 导入单文件最多 15 MB / 10000 行；单批过宽时要求精简无关列。

## 代码组织

`app/` 为路由页面；`src/domain.ts` 集中实现阈值、时间、统计和查重；`storage.ts` 管理数据库迁移和事务；`ai.ts` 与 `ai-schema.ts` 管理模型调用和校验；`importing.ts` / `workbook.ts` / `exporting.ts` 处理导入导出；`Chart.tsx` 与 `ReportPage.tsx` 展示趋势和报告。

测试使用合成健康数据，不依赖真实个人数据。真实 API 冒烟脚本从当前进程的 `DEEPSEEK_TEST_KEY` 读取密钥，密钥不写入文件。调用会产生少量 API 费用：

```powershell
node scripts/deepseek-smoke.mjs <合成图片路径>
```

验证记录和待做真机验收见 [TESTING.md](TESTING.md)。

## 使用限制

面向成年人家庭自测，不替代医疗诊断，不提供自行调整药物或剂量建议。孕期、儿童及特殊疾病请遵从医生指导。提醒可能被系统省电策略延迟。首版不含 iOS 签名发行、蓝牙设备、家庭多成员或云端备份。
