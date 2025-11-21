// services/updateService.ts (完整覆盖文件)

import { UPDATE_CONFIG, UpdateDecision } from "../constants/UpdateConfig";
import { Platform, NativeModules } from "react-native";
import * as FileSystem from 'expo-file-system';
// import { getCurrentVersion } from "./versionService"; // <-- 修复: 注释掉不存在的导入

const isTv = Platform.isTV;

export interface UpdateService {
    checkVersion: (currentVersion: string, desiredTarget: 'dev' | 'tag', currentBuildTarget: 'dev' | 'tag') => Promise<UpdateDecision | null>;
    downloadUpdate: (version: string, buildTarget: 'dev' | 'tag') => Promise<string>;
    getCurrentBuildTarget: () => 'dev' | 'tag';
    installApk: (path: string) => Promise<void>; 
}

// 假设我们通过某种方式（例如环境变量）确定当前应用的构建目标
const getInitialBuildTarget = (): 'dev' | 'tag' => {
    // 实际实现应取决于您的构建配置
    // 假设默认是 'tag'
    return 'tag'; 
};

export const updateService: UpdateService = {

    getCurrentBuildTarget: () => {
        // 实际实现可能从原生代码或本地存储中获取
        // 这里暂时使用常量
        return getInitialBuildTarget(); 
    },

    checkVersion: async (currentVersion, desiredTarget, currentBuildTarget) => {
        const compare = UPDATE_CONFIG.compareVersions;

        try {
            // --- 1. 获取 Dev 通道最新版本 ---
            const devUrl =
                typeof UPDATE_CONFIG.CHECK_SOURCES.dev === "function"
                    ? UPDATE_CONFIG.CHECK_SOURCES.dev(currentVersion)
                    : UPDATE_CONFIG.CHECK_SOURCES.dev;

            const devResponse = await fetch(devUrl);
            const devPackage = await devResponse.json();
            const latestDev = devPackage.version;

            // --- 2. 获取 Tag 通道最新版本 ---
            const tagUrl =
                typeof UPDATE_CONFIG.CHECK_SOURCES.tag === "function"
                    ? UPDATE_CONFIG.CHECK_SOURCES.tag(currentVersion)
                    : UPDATE_CONFIG.CHECK_SOURCES.tag;

            const tagResponse = await fetch(tagUrl);
            const tagPackage = await tagResponse.json();
            const latestTag = tagPackage.version;

            // --- 3. 核心决策 ---
            return UPDATE_CONFIG.checkForUpdate(
                currentBuildTarget,
                currentVersion,
                desiredTarget,
                latestDev,
                latestTag
            );

        } catch (e) {
            console.error("Failed to check for updates:", e);
            return null;
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
                // 可以在这里更新下载进度到 Store
                // 示例：console.log(`Download progress: ${downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpected * 100}%`);
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
            // 假设您有一个桥接模块来处理原生安装
            await NativeModules.UpdateModule.install(path);
        } else {
            console.warn(`Installation not supported or UpdateModule not found for path: ${path}`);
        }
    }
};
