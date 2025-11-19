# 📦 OrionTVR CI/CD Workflow

## 🔄 分支與流程

### 開發分支 (dev)
- 日常開發與測試使用。
- Workflow 支援手動觸發 (`workflow_dispatch`)。
- 只有在 **dev 分支**手動觸發並輸入 `custom_version` 時，workflow 才會 commit/push 更新 `package.json`。

### 主分支 (master)
- 僅透過 Pull Request 合併 `dev → master`。
- Workflow 不會在 master 自動 commit，保持乾淨。

### 版本標籤 (tag)
- 在 master 打 tag（例如 `v1.2.3`）。
- Workflow 自動觸發，建置 APK 並上傳到 Release。

---

## 📦 Artifact 與 Release

- **Artifacts**
  - 每次 workflow run 會產生 APK artifact。
  - 設定 `retention-days: 7`，7 天後自動刪除，避免佔用空間。

- **Release**
  - Workflow 會將 APK 上傳到 GitHub Release。
  - Release APK 永久保留，不受 `retention-days` 影響。

---

## ⚠️ Commit 限制

Workflow commit/push 僅允許在：
- 手動觸發 (`workflow_dispatch`)
- 有輸入 `custom_version`
- 分支為 `dev`

如果在 master 或 tag 嘗試 commit，workflow 會直接提示錯誤並停止。

---

## ✅ 總結流程

1. **開發**：在 `dev` 分支測試，必要時手動 dispatch 更新版本。  
2. **合併**：人工 PR 將 `dev → master`。  
3. **發佈**：在 master 打 tag → workflow 自動建置 APK → 上傳 Release。  
4. **Artifacts**：暫存 7 天，Release 永久保留。  

---

## 📂 專案結構範例
