// constants/UpdateConfig.ts

// 1. 定義函數型別：接受版本字串，返回 URL 字串
type VersionCheckFunction = (currentVersion: string) => string;

// 2. 定義 CHECK_SOURCES 的結構：允許 string 或 function
interface UpdateSources {
  dev: string | VersionCheckFunction;
  tag: string | VersionCheckFunction;
}

// 3. 定義整個 UPDATE_CONFIG 物件的介面，包含所有屬性
interface UpdateConfigType {
  AUTO_CHECK: boolean;
  CHECK_INTERVAL: number;
  CHECK_SOURCES: UpdateSources; // 應用修正後的型別
  UPSTREAM_SOURCE: string;
  getDownloadUrl(version: string, buildTarget: string): string;
  SHOW_RELEASE_NOTES: boolean;
  SHOW_BUILD_INFO: boolean;
  ALLOW_SKIP_VERSION: boolean;
  BASELINE_VERSIONS: {
    dev: string;
    tag: string;
  };
  ALLOW_UPDATE_RULES(buildTarget: string, newVersion: string): boolean;
  getAvailableVersions(latestDev: string, latestTag: string): string[];
  DOWNLOAD_TIMEOUT: number;
  AUTO_DOWNLOAD_ON_WIFI: boolean;
  NOTIFICATION: {
    ENABLED: boolean;
    TITLE: string;
    DOWNLOADING_TEXT: string;
    DOWNLOAD_COMPLETE_TEXT: string;
  };
  checkForUpdate(
    currentBuildTarget: "dev" | "tag",
    latestDev: string,
    latestTag: string
  ): {
    autoCheck: boolean;
    allowSkip: boolean;
    showReleaseNotes: boolean;
    showBuildInfo: boolean;
    currentTarget: "dev" | "tag";
    latestVersion: string;
    baselineVersion: string;
    availableVersions: string[];
    upstreamSource: string;
  };
}

export const UPDATE_CONFIG: UpdateConfigType = {
  // 自动检查更新
  AUTO_CHECK: true,

  // 检查更新间隔（毫秒）
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时

  // ✅ 你自己的版本檢查來源 (fork repo)
  // dev 是 string，tag 是 function。現在因為有介面定義，TypeScript 能正確處理聯合型別。
  CHECK_SOURCES: {
    dev: `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/refs/heads/dev/package.json?t=${Date.now()}`,
    tag: (version: string) =>
      `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/refs/tags/v${version}/package.json?t=${Date.now()}`,
  },

  // ✅ Upstream 官方版本檢查 (永遠抓 master)
  UPSTREAM_SOURCE: `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,

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

  // baseline 初始版：分别定义 dev / tag
  BASELINE_VERSIONS: {
    dev: "1.3.11.001",
    tag: "1.3.11.001",
  },

  // 允许更新规则：必须经过 baseline
  ALLOW_UPDATE_RULES(buildTarget: string, newVersion: string): boolean {
    if (buildTarget === "dev") {
      return newVersion.endsWith("-dev") || newVersion === this.BASELINE_VERSIONS.dev;
    }
    if (buildTarget === "tag") {
      return (
        /^\d+\.\d+\.\d+\.\d+$/.test(newVersion) ||
        newVersion === this.BASELINE_VERSIONS.tag
      );
    }
    return false;
  },

  // 返回可选版本清单：最新版 + baseline
  getAvailableVersions(latestDev: string, latestTag: string): string[] {
    const versions: string[] = [];

    const addUnique = (label: string, version: string) => {
      const entry = `${label} ${version}`;
      if (!versions.includes(entry)) {
        versions.push(entry);
      }
    };

    addUnique("dev", latestDev);
    addUnique("tag", latestTag);
    addUnique("dev", this.BASELINE_VERSIONS.dev);
    addUnique("tag", this.BASELINE_VERSIONS.tag);

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

  // 核心檢查函數
  checkForUpdate(currentBuildTarget: "dev" | "tag", latestDev: string, latestTag: string) {
    const available = this.getAvailableVersions(latestDev, latestTag);

    return {
      autoCheck: this.AUTO_CHECK,
      allowSkip: this.ALLOW_SKIP_VERSION,
      showReleaseNotes: this.SHOW_RELEASE_NOTES,
      showBuildInfo: this.SHOW_BUILD_INFO,
      currentTarget: currentBuildTarget,
      latestVersion: currentBuildTarget === "dev" ? latestDev : latestTag,
      baselineVersion: this.BASELINE_VERSIONS[currentBuildTarget],
      availableVersions: available.filter(v =>
        this.ALLOW_UPDATE_RULES(currentBuildTarget, v.split(" ")[1])
      ),
      upstreamSource: this.UPSTREAM_SOURCE, // ✅ 額外提供 upstream 最新版本檢查
    };
  },
};
