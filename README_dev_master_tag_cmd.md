# Git Workflow Guide

本文件定義專案的 Git 操作流程，涵蓋 **dev 研發階段**、**master 合併與同步**、**提交與推送到 GitHub**、以及 **版本 tag 建立與推送**。  
此流程確保代碼穩定、可回滾、並且符合 CI/CD 的自動化需求。

---

## 📌 分支策略

- **dev 分支**
  - 研發與日常修正皆在此分支進行
  - 每次提交前請先同步遠端 (`git pull --rebase`)
  - 保持小步提交，使用語義化 commit 訊息

- **master 分支**
  - 僅用於穩定版本
  - 嚴禁直接開發，僅接受來自 `dev` 的合併
  - 合併前必須更新並驗證無衝突

- **tags**
  - 用於標記正式版本 (遵循 [SemVer](https://semver.org/lang/zh-TW/))
  - 一律在 `master` 最新提交上建立
  - Tag 訊息需包含版本摘要與日期

---



✅ 一次到位的完整流程
# 1) 在 dev 開發並提交
git checkout dev
git pull origin dev --rebase
git add <files>
git commit -m "feat: 完成功能 X"
git push origin dev

🔹 與 master 合併
# 2) 更新 master
git checkout master
git pull origin master --rebase

# 衝突時 用 dev 分支的版本覆蓋當前檔案
git checkout --theirs -- .github/workflows/build-apk-p.yml

# 檢查內容是否正確（建議打開編輯器確認）
git diff .github/workflows/build-apk-p.yml

# 標記為已解決並 commit
git add .github/workflows/build-apk-p.yml
git commit -m "chore: merge dev into master (accept dev version for build-apk-p.yml)"

# 3) 合併 dev → master
git merge --no-ff dev
git push origin master

驗證合併結果
git status
git diff HEAD^ HEAD


🔖 建立並推送版本 tag
# 4) 
git tag -a v1.0.0 -m "Release v1.0.0: 新增功能 X、修正 Y"
git push origin v1.0.0

推送所有 tag
git push origin --tags

驗證 tag
git show v1.0.0




開發與提交
git add <file>
git commit -m "feat: 新增功能 X"
git push origin dev

⚠️ 衝突處理 以下動作 最好不要做..
Rebase 衝突
# 修正衝突檔案
git add <conflicted_file>
git rebase --continue

# 若要取消 rebase
git rebase --abort

Merge 衝突
# 修正衝突檔案
git add <conflicted_file>
git commit

# 若要取消合併
git merge --abort


🔄 回滾與安全守則
回滾單一提交
git revert <commit_sha>
git push origin <branch>

回滾合併提交（已推送）
git revert -m 1 <merge_commit_sha>
git push origin master


撤回本地最後一次合併（未推送）
git reset --hard HEAD~1


📐 習慣建議
- 每次 commit 前先跑 git status 與 git diff
- 每次 push 前先 git pull --rebase
- 使用語義化 commit 訊息：feat / fix / docs / refactor / perf / test / chore
- Tag 一律在 master 最新提交上建立
