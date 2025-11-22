export const UPDATE_CONFIG = {
  AUTO_CHECK: true,
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时

  ORIONTV_ORG_GITHUB_RAW_URL:
    `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,

  GITHUB_RAW_URL: (() => {
    const user = process.env.USER_NAME!;
    const repo = process.env.REPO_NAME!;
    const branch = process.env.BRANCH_NAME!;
    // 保持和 workflow log 一樣的拼接方式
    return `https://ghfast.top/https://raw.githubusercontent.com/${user}/${repo}/${branch}/package.json?t=${Date.now()}`;
  })(),

  getDownloadUrl(version: string): string {
    const user = process.env.USER_NAME!;
    const repo = process.env.REPO_NAME!;
    const branch = process.env.BRANCH_NAME!;
    const safeBranch = branch.replace(/[^a-zA-Z0-9-_]/g, "-");

    const suffix = (branch === "main" || branch === "master") ? "" : `-${safeBranch}`;

    // 保持和 workflow 一樣的拼接方式
    return `https://ghfast.top/https://github.com/${user}/${repo}/releases/download/v${version}${suffix}/orionTV.${version}${suffix}.apk`;
  },

  SHOW_RELEASE_NOTES: true,
  ALLOW_SKIP_VERSION: true,
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000,
  AUTO_DOWNLOAD_ON_WIFI: false,

  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新",
    DOWNLOADING_TEXT: "正在下载新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下载完成，点击安装",
  },
};
