export const UPDATE_CONFIG = {
  // 自動檢查更新
  AUTO_CHECK: true,

  // 檢查更新間隔（毫秒）
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小時

  // GitHub 相關 URL
  GITHUB_RAW_URL:
    `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTV_R/refs/heads/master/package.json?t=${Date.now()}`,
  ORIONTV_ORG_GITHUB_RAW_URL:
    `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,
  // 取得平台特定的下載 URL
  getDownloadUrl(version: string): string {
    return `https://ghfast.top/https://github.com/steven118-live/OrionTV_R/releases/download/v${version}/orionTV.${version}.apk`;
  },

  // 是否顯示更新日誌
  SHOW_RELEASE_NOTES: true,

  // 是否允許跳過版本
  ALLOW_SKIP_VERSION: true,

  // 下載逾時時間（毫秒）
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分鐘

  // 是否在 WIFI 下自動下載
  AUTO_DOWNLOAD_ON_WIFI: false,

  // 更新通知設定
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新",
    DOWNLOADING_TEXT: "正在下載新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下載完成，點擊安裝",
  },
};
