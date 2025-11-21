// constants/UpdateConfig.ts

// 导出决策结果的类型，供 Service 使用
export interface UpdateDecision {
    isUpdateAvailable: boolean;
    latestVersion: string;
    currentTarget: 'dev' | 'tag';
    baselineVersion: string;
    availableVersions: string[];
    reason: string; // 方便调试
}

export const UPDATE_CONFIG = {
    // --- 【原有配置，重新添加以解决 TS 错误】 ---
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

    // --- 【新增核心配置】 ---

    // 远程检查源：定义 dev 和 tag 两种渠道的最新版本信息获取地址
    CHECK_SOURCES: {
        // dev 通道检查源
        dev: (currentVersion: string) => 
            `https://ghfast.top/https://raw.githubusercontent.com/steven118-live/OrionTVR/master/package.json?t=${Date.now()}`,
        
        // tag 通道检查源
        tag: (currentVersion: string) => 
            `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,
    },

    // baseline 初始版：分别定义 dev / tag，用于跨通道切换时的强制基线升级
    BASELINE_VERSIONS: {
        dev: "1.3.11.001",
        tag: "1.3.11.001",
    },
    
    // 强制版本：定义必须跳过的版本（如果需要）
    MIN_FORCE_VERSION: { 
        dev: "1.0.0.001", 
        tag: "1.0.0.001" 
    }, 

    // 获取平台特定的下载URL (新增 buildTarget 参数)
    getDownloadUrl(version: string, buildTarget: 'dev' | 'tag'): string {
        const appendix = buildTarget === 'dev' ? '-dev' : '';
        return `https://ghfast.top/https://github.com/steven118-live/OrionTVR/releases/download/v${version}/orionTV.${version}${appendix}.apk`;
    },

    // --- 【新增核心逻辑函数】 ---

    // 版本比对函数
    compareVersions: (v1: string, v2: string): number => {
        const p1 = v1.split(".").map(Number);
        const p2 = v2.split(".").map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] ?? 0;
            const n2 = p2[i] ?? 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    },

    // 核心决策函数：处理跨通道切换和基线强制逻辑
    checkForUpdate: (
        currentBuildTarget: 'dev' | 'tag',
        currentVersion: string,
        desiredTarget: 'dev' | 'tag',
        latestDev: string,
        latestTag: string
    ): UpdateDecision => {
        const compare = UPDATE_CONFIG.compareVersions;
        const baseline = UPDATE_CONFIG.BASELINE_VERSIONS;
        
        // --- 1. 处理目标通道切换逻辑 ---
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
        
        // --- 2. 处理当前通道的正常升级 ---
        
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
