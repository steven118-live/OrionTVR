// services/updateService.ts (完整覆盖版)

import { UPDATE_CONFIG, UpdateDecision } from "../constants/UpdateConfig";
import { Platform, NativeModules } from "react-native";
import * as FileSystem from 'expo-file-system';
// import { getCurrentVersion } from "./versionService"; 

const isTv = Platform.isTV;

// 辅助函数：裁剪版本号 (1.3.11.001 -> 1.3.11)
const trimBuildVersion = (v: string): string => {
    let cleaned = v.replace(/-dev$/, '').replace(/-tag$/, '');
    const parts = cleaned.split('.');
    if (parts.length > 3) {
        return parts.slice(0, 3).join('.');
    }
    return cleaned;
};


const getInitialBuildTarget = (): 'dev' | 'tag' => {
    return 'tag'; 
};

// 扩展 UpdateService 接口
export interface UpdateService {
    checkVersion: (currentVersion: string, desiredTarget: 'dev' | 'tag', currentBuildTarget: 'dev' | 'tag') => 
        Promise<(UpdateDecision & { upstreamTagVersion: string | null }) | null>;
    downloadUpdate: (version: string, buildTarget: 'dev' | 'tag') => Promise<string>;
    getCurrentBuildTarget: () => 'dev' | 'tag';
    installApk: (path: string) => Promise<void>; 
}


export const updateService: UpdateService = {

    getCurrentBuildTarget: () => {
        return getInitialBuildTarget(); 
    },

    checkVersion: async (currentVersion, desiredTarget, currentBuildTarget) => {
        let upstreamTagVersion: string | null = null; 

        try {
            // --- 1. Dev 通道检查 ---
            const devUrl = UPDATE_CONFIG.CHECK_SOURCES.dev(currentVersion);
            const devResponse = await fetch(devUrl);
            if (!devResponse.ok) throw new Error(`DEV check failed: ${devResponse.status} for URL: ${devUrl}`);
            const devPackage = await devResponse.json();
            let latestDev = devPackage.version; 

            // --- 2. Tag 通道检查 ---
            const tagUrl = UPDATE_CONFIG.CHECK_SOURCES.tag(currentVersion);
            const tagResponse = await fetch(tagUrl);
            if (!tagResponse.ok) throw new Error(`TAG check failed: ${tagResponse.status} for URL: ${tagUrl}`);
            const tagPackage = await tagResponse.json();
            let latestTag = tagPackage.version;
            
            // --- 3. Upstream Tag 通道检查 ---
            const upstreamTagUrl = UPDATE_CONFIG.CHECK_SOURCES.upstreamTag(currentVersion);
            const upstreamTagResponse = await fetch(upstreamTagUrl);
            
            if (upstreamTagResponse.ok) {
                const upstreamTagPackage = await upstreamTagResponse.json();
                upstreamTagVersion = upstreamTagPackage.tag_name ? upstreamTagPackage.tag_name.replace(/^v/, '') : null;
            } else {
                 console.warn(`Upstream TAG check failed: ${upstreamTagResponse.status}.`);
            }

            // --- 4. 数据处理和决策 ---
            const processedLatestDev = `${trimBuildVersion(latestDev)}-dev`; 
            const processedLatestTag = `${latestTag}-tag`; 

            const decision = UPDATE_CONFIG.checkForUpdate(
                currentBuildTarget,
                currentVersion,
                desiredTarget,
                processedLatestDev,
                processedLatestTag
            );
            
            return {
                ...decision,
                upstreamTagVersion, 
            };

        } catch (e: any) {
            console.error("Failed to check for updates. Error:", e.message || '未知错误'); 
            return {
                isUpdateAvailable: false,
                latestVersion: currentVersion, 
                currentTarget: desiredTarget,
                baselineVersion: UPDATE_CONFIG.BASELINE_VERSIONS[desiredTarget],
                availableVersions: [],
                reason: `检查更新失败: ${e.message || '未知错误'}`,
                upstreamTagVersion: null,
            };
        }
    },

    downloadUpdate: async (version: string, buildTarget: 'dev' | 'tag'): Promise<string> => {
        const downloadUrl = UPDATE_CONFIG.getDownloadUrl(version, buildTarget); 
        const fileName = `orionTV.${version}.${buildTarget}.apk`;
        const downloadPath = `${FileSystem.documentDirectory}${fileName}`;

        const downloadResumable = FileSystem.createDownloadResumable(
            downloadUrl,
            downloadPath,
            {}, 
            (downloadProgress) => {
                // 可以在这里实现进度更新逻辑
            }
        );

        const result = await downloadResumable.downloadAsync();
        if (result && result.uri) {
            return result.uri;
        }
        throw new Error("Download failed or interrupted.");
    },

    installApk: async (path: string) => { 
        if (Platform.OS === 'android' && NativeModules.UpdateModule) {
            await NativeModules.UpdateModule.install(path);
        } else {
            console.warn(`Installation not supported or UpdateModule not found for path: ${path}`);
        }
    }
};
