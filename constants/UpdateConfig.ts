// constants/UpdateConfig.ts
// 這才是正確的內容！只有配置，沒有任何 JSX！

export const UPDATE_CONFIG = {
  AUTO_CHECK: true,
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小時
  // GitHub相关URL
  ORIONTV_ORG_GITHUB_RAW_URL:
    `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,
  GITHUB_RAW_URL:
    "https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/master/package.json",
  getDownloadUrl: (version: string): string =>
    `https://ghfast.top/https://github.com/steven118-live/OrionTVR/releases/download/v${version}/orionTV.${version}.apk`,
  // 是否显示更新日志
  SHOW_RELEASE_NOTES: true,

  // 是否允许跳过版本
  ALLOW_SKIP_VERSION: true,

  // 下载超时时间（毫秒）
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分钟

  // 是否在WIFI下自动下载
  AUTO_DOWNLOAD_ON_WIFI: false,
 
  FORCE_UPDATE: false,
  // 更新通知设置
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新可用",
    DOWNLOADING_TEXT: "正在下載新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下載完成，點擊安裝",
  },
} as const;

export type UpdateConfig = typeof UPDATE_CONFIG;
