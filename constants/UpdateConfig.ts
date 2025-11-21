// constants/UpdateConfig.ts (完整覆盖版)

// 导出决策结果的类型，供 Service 使用
export interface UpdateDecision {
    isUpdateAvailable: boolean;
    latestVersion: string;
    currentTarget: 'dev' | 'tag';
    baselineVersion: string;
    availableVersions: string[];
    reason: string; // 方便调试
}

// 辅助函数：清理版本号后缀
const normalizeVersionString = (v: string): string => {
    return v ? v.replace(/-dev$/, '').replace(/-tag$/, '') : '0.0.0.000';
};

export const UPDATE_CONFIG = {
    // --- 【原有配置】 ---
    AUTO_CHECK: true,
    CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时
    DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分钟
    SHOW_RELEASE_NOTES: true,
    ALLOW_SKIP_VERSION: true,
    AUTO_DOWNLOAD_ON_WIFI: false,
    NOTIFICATION: {
        ENABLED: true,
        TITLE: "OrionTV 更新",
        DOWNLOADING_TEXT: "正在下载新版本...",
        DOWNLOAD_COMPLETE_TEXT: "下载完成，点击安装",
    },
    
    // GitHub相关URL (保留，用于兼容旧代码或作为参考)
    ORIONTV_ORG_GITHUB_RAW_URL:
        `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,
    GITHUB_RAW_URL:
        `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/master/package.json?t=${Date.now()}`,

    // --- 【核心配置】 ---

    // 远程检查源：定义 dev, tag, 和 upstreamTag 三个渠道的最新版本信息获取地址
    CHECK_SOURCES: {
    // 1. Tag 通道（您的 Fork: master 分支）
        tag: (currentVersion: string) => 
            `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/master/package.json?t=${Date.now()}`,
    
    // 2. Dev 通道（您的 Fork: dev 分支）
        dev: (currentVersion: string) => 
            `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/dev/package.json?t=${Date.now()}`,
        
    // 3. UpstreamTag 通道（Upstream/Releases API）
        upstreamTag: (currentVersion: string) => 
            `https://api.github.com/repos/orion-lib/OrionTV/releases/latest`, // <-- 直接抓取最新 Release API
    },

    // baseline 初始版：分别定义 dev / tag，确保使用带后缀的版本格式
    BASELINE_VERSIONS: {
        dev: "1.3.11.001-dev", // 使用您的实际版本格式
        tag: "1.3.11.001-tag", // 使用您的实际版本格式
    },
    
    // 强制版本：定义必须跳过的版本（如果需要）
    MIN_FORCE_VERSION: { 
        dev: "1.0.0.001-dev", 
        tag: "1.0.0.001-tag" 
    }, 

    // --- 【核心函数 1: 版本比较】 ---
    compareVersions: (v1: string, v2: string): number => {
        const n1 = normalizeVersionString(v1);
        const n2 = normalizeVersionString(v2);

        const parts1 = n1.split('.').map(Number);
        const parts2 = n2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 < p2) return -1;
            if (p1 > p2) return 1;
        }
        return 0;
    },

    // --- 【核心函数 2: 下载链接】 ---
    getDownloadUrl(version: string, buildTarget: 'dev' | 'tag'): string {
        const cleanVersion = normalizeVersionString(version); // 使用辅助函数清理
        
        // 修正 versionTag: 假设 Git Tag 使用 'v' + cleanVersion
        let versionTag = `v${cleanVersion}`; 

        let repoUrl = "";
        
        if (buildTarget === 'dev') {
            repoUrl = "steven118-live/OrionTVR";
        } else {
            repoUrl = "orion-lib/OrionTV";
        }
        
        // 假设您的发布文件名是 cleanVersion + 后缀 + .apk (例如 1.3.11-dev.apk)
        const filename = `orionTV.${cleanVersion}-${buildTarget}.apk`;

        return `https://ghfast.top/https://github.com/${repoUrl}/releases/download/${versionTag}/${filename}`;
    }, 
        
    // --- 【核心函数 3: 更新决策】 ---
    checkForUpdate: (
        currentBuildTarget: 'dev' | 'tag',
        currentVersion: string, // 带后缀
        desiredTarget: 'dev' | 'tag',
        latestDev: string,      // 带后缀
        latestTag: string       // 带后缀
    ): UpdateDecision => {

        const compare = UPDATE_CONFIG.compareVersions;
        const baseline = UPDATE_CONFIG.BASELINE_VERSIONS;

        // 1. 处理目标通道切换逻辑
        if (currentBuildTarget !== desiredTarget) {
            const targetBaseline = baseline[desiredTarget];

            // 检查当前版本是否低于目标通道的基线版本 (即：是否需要强制更新到基线)
            if (compare(currentVersion, targetBaseline) < 0) {
                 return {
                    isUpdateAvailable: true,
                    latestVersion: targetBaseline,
                    currentTarget: desiredTarget,
                    baselineVersion: targetBaseline,
                    availableVersions: [targetBaseline],
                    reason: "强制切换目标通道，需先更新至基线版本",
                 };
            }
            
            // 如果高于或等于基线，则检查该目标通道的最新版本
            const latestTargetVersion = desiredTarget === 'dev' ? latestDev : latestTag;
            
            if (compare(currentVersion, latestTargetVersion) < 0) {
                // 有更高版本可用，但至少满足了基线要求
                return {
                    isUpdateAvailable: true,
                    latestVersion: latestTargetVersion,
                    currentTarget: desiredTarget,
                    baselineVersion: baseline[desiredTarget],
                    availableVersions: [latestTargetVersion],
                    reason: "目标通道有新版本",
                };
            }
            
            // 已是最新版本 (在目标通道下)
            return {
                isUpdateAvailable: false,
                latestVersion: currentVersion,
                currentTarget: desiredTarget,
                baselineVersion: baseline[desiredTarget],
                availableVersions: [],
                reason: "目标通道已是最新或版本一致",
            };
        }
        
        // 2. 处理当前通道的正常升级 (currentBuildTarget === desiredTarget)
        
        const latestCurrentVersion = currentBuildTarget === 'dev' ? latestDev : latestTag;
        
        if (compare(currentVersion, latestCurrentVersion) < 0) {
            // 当前通道有更新
            return {
                isUpdateAvailable: true,
                latestVersion: latestCurrentVersion,
                currentTarget: currentBuildTarget,
                baselineVersion: baseline[currentBuildTarget],
                availableVersions: [latestCurrentVersion],
                reason: "当前通道有新版本",
            };
        }
        
        // 无更新
        return {
            isUpdateAvailable: false,
            latestVersion: currentVersion,
            currentTarget: currentBuildTarget,
            baselineVersion: baseline[currentBuildTarget],
            availableVersions: [],
            reason: "已是最新版本",
        };
    }
};
