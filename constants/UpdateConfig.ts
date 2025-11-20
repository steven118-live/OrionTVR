export const UPDATE_CONFIG = {
  // 自动检查更新
  AUTO_CHECK: true,

  // 检查更新间隔（毫秒）
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时

  // GitHub相关URL 检查来源：依照 buildTarget 分流
  CHECK_SOURCES: {
    dev: `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/refs/heads/dev/package.json?t=${Date.now()}`,
    tag: `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/master/package.json?t=${Date.now()}`,
  },

  // 下载 URL：符合 workflow 的文件命名规则（和 tag 對齊）
  getDownloadUrl(version: string, buildTarget: string): string {
    return `https://ghfast.top/https://github.com/steven118-live/OrionTVR/releases/download/v${version}/${version}.apk`;
  },

  // 是否显示更新日志
  SHOW_RELEASE_NOTES: true,

  // 是否显示 Build target / mode / commit
  SHOW_BUILD_INFO: true,

  // 是否允许跳过版本
  ALLOW_SKIP_VERSION: true,

  // ✅ baseline 初始版：分别定义 dev / tag
  BASELINE_VERSIONS: {
    dev: "1.3.11.001",
    tag: "1.3.11.001",
  },

  // 允许更新规则：必须经过 baseline
  ALLOW_UPDATE_RULES(buildTarget: string, newVersion: string): boolean {
    if (buildTarget === "dev") {
      return newVersion.endsWith("-dev") || newVersion === UPDATE_CONFIG.BASELINE_VERSIONS.dev;
    }
    if (buildTarget === "tag") {
      return /^\d+\.\d+\.\d+\.\d+$/.test(newVersion) || newVersion === UPDATE_CONFIG.BASELINE_VERSIONS.tag;
    }
    return false;
  },

  // ✅ 返回可选版本清单：最新版 + baseline + 对方 baseline
  getAvailableVersions(latestDev: string, latestTag: string): string[] {
    const versions: string[] = [];
    versions.push(`dev ${latestDev}`);
    versions.push(`tag ${latestTag}`);
    versions.push(`dev ${UPDATE_CONFIG.BASELINE_VERSIONS.dev}`);
    versions.push(`tag ${UPDATE_CONFIG.BASELINE_VERSIONS.tag}`);
    return versions;
  },

  // 下载超时时间（毫秒）
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分钟

  // 是否在WIFI下自动下载
  AUTO_DOWNLOAD_ON_WIFI: false,

  // 更新通知设置
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新",
    DOWNLOADING_TEXT: "正在下载新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下载完成，点击安装",
  },

  // ✅ 新增 checkForUpdate 函数
  checkForUpdate(currentBuildTarget: "dev" | "tag", latestDev: string, latestTag: string) {
    const available = UPDATE_CONFIG.getAvailableVersions(latestDev, latestTag);

    return {
      autoCheck: UPDATE_CONFIG.AUTO_CHECK,
      allowSkip: UPDATE_CONFIG.ALLOW_SKIP_VERSION,
      showReleaseNotes: UPDATE_CONFIG.SHOW_RELEASE_NOTES,
      showBuildInfo: UPDATE_CONFIG.SHOW_BUILD_INFO,
      currentTarget: currentBuildTarget,
      latestVersion: currentBuildTarget === "dev" ? latestDev : latestTag,
      baselineVersion: UPDATE_CONFIG.BASELINE_VERSIONS[currentBuildTarget],
      availableVersions: available.filter(v =>
        UPDATE_CONFIG.ALLOW_UPDATE_RULES(currentBuildTarget, v.split(" ")[1])
      ),
    };
  },
};
