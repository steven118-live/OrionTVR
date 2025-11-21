// stores/updateStore.ts

import { create } from "zustand";
import { updateService } from "../services/updateService";
import { UPDATE_CONFIG } from "../constants/UpdateConfig";
import { Platform } from "react-native";
import * as Application from 'expo-application'; 

// 辅助函数：从完整版本号中提取干净的版本号和通道
const extractVersionAndTarget = (fullVersion: string): { version: string; target: 'dev' | 'tag' } => {
    let version = fullVersion;
    let target: 'dev' | 'tag' = 'tag'; // 默认是 tag

    if (fullVersion.endsWith('-dev')) {
        version = fullVersion.replace(/-dev$/, '');
        target = 'dev';
    } else if (fullVersion.endsWith('-tag')) {
        version = fullVersion.replace(/-tag$/, '');
        target = 'tag';
    }
    
    // 如果无法从版本中提取，则使用服务提供的默认值
    if (fullVersion === '1.0.0.000' || normalizeVersion(fullVersion) === fullVersion) {
        target = updateService.getCurrentBuildTarget();
        // 确保 version 是干净的
        version = normalizeVersion(fullVersion);
    }
    
    return { version, target };
};


// 辅助函数：只移除版本号末尾的 -dev 或 -tag
const normalizeVersion = (v: string): string => {
    return v ? v.replace(/-dev$/, '').replace(/-tag$/, '') : '';
};


// 修正后的获取当前版本函数 (使用 expo-application)
const getActualCurrentVersion = (): { version: string, target: 'dev' | 'tag' } => {
    // 优先使用 expo-application 提供的原生版本号
    let rawVersion = Application.nativeApplicationVersion || null;
    
    // 决定正确的初始构建目标 (Service 层提供)
    const initialTarget = updateService.getCurrentBuildTarget();
    let currentVersion = rawVersion || '1.0.0.000'; // 使用原生或默认

    // ⚠️ 强制 TV 环境下的初始版本格式：如果无法获取原生版本，我们强制使用已知的版本格式。
    if (Platform.isTV && normalizeVersion(currentVersion) === '1.0.0.000') {
        currentVersion = `1.3.11.001-${initialTarget}`; 
    }
    
    // 提取干净版本号和通道
    return extractVersionAndTarget(currentVersion);
};


// 定义 Store 的状态类型 (保持不变)
interface UpdateState {
    showUpdateModal: boolean; 
    isLatestVersion: boolean; 
    initComplete: boolean;       
    currentVersion: string; 
    remoteVersion: string | null;
    availableVersions: string[] | null;
    baselineVersion: string | null;
    updateAvailable: boolean;
    downloading: boolean;
    downloadProgress: number;
    downloadedPath: string | null;
    error: string | null;
    lastCheckTime: number;
    currentBuildTarget: 'dev' | 'tag'; 
    targetChannel: 'dev' | 'tag';      
    
    // Actions
    initialize: () => Promise<void>; 
    checkForUpdate: (showModalIfNoUpdate?: boolean) => Promise<void>;
    handleDownload: (version: string) => Promise<void>;
    switchBuildTarget: (desiredTarget: 'dev' | 'tag') => void;
    installUpdate: () => Promise<void>;
    skipThisVersion: () => Promise<void>;
    setShowUpdateModal: (show: boolean) => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
    // 初始化状态 (保持不变)
    currentVersion: 'loading...', 
    remoteVersion: null,
    availableVersions: null,
    baselineVersion: null,
    updateAvailable: false,
    downloading: false,
    downloadProgress: 0,
    downloadedPath: null,
    error: null,
    lastCheckTime: 0,
    
    showUpdateModal: false, 
    isLatestVersion: true, 
    initComplete: false, 

    currentBuildTarget: 'tag', 
    targetChannel: 'tag',      

    setShowUpdateModal: (show) => set({ showUpdateModal: show }),

    initialize: async () => { 
        const { version, target } = getActualCurrentVersion(); 
        
        set({
            currentVersion: version, 
            currentBuildTarget: target, 
            targetChannel: target,
            initComplete: true, 
        });
        
        await get().checkForUpdate(false);
    },
    
    checkForUpdate: async (showModalIfNoUpdate = false) => {
        const state = get();
        if (!state.initComplete) {
            console.warn("UpdateStore not initialized. Skipping check.");
            return;
        }

        set({ error: null, isLatestVersion: false }); 

        // 构造带后缀的版本号给 Service 层
        const currentFullVersion = `${state.currentVersion}-${state.currentBuildTarget}`;

        try {
            const updateInfo = await updateService.checkVersion(
                currentFullVersion, 
                state.targetChannel,      
                state.currentBuildTarget
            );

            if (!updateInfo) {
                if (showModalIfNoUpdate) {
                    set({ 
                        showUpdateModal: true, 
                        error: `检查更新失败。当前通道：${state.targetChannel.toUpperCase()}`,
                        availableVersions: null,
                        isLatestVersion: true,
                    });
                }
                return;
            }
            
            // 远程版本和基线版本都是带后缀的，需要在 Store 状态中保存干净的版本
            const remoteCleanVersion = normalizeVersion(updateInfo.latestVersion);
            const baselineCleanVersion = normalizeVersion(updateInfo.baselineVersion);
            const availableCleanVersions = updateInfo.availableVersions.map(normalizeVersion);

            const isLatest = !updateInfo.isUpdateAvailable && 
                             (UPDATE_CONFIG.compareVersions(state.currentVersion, remoteCleanVersion) >= 0);

            set({
                lastCheckTime: Date.now(),
                remoteVersion: remoteCleanVersion, 
                baselineVersion: baselineCleanVersion, 
                updateAvailable: updateInfo.isUpdateAvailable,
                availableVersions: availableCleanVersions, 
                isLatestVersion: isLatest, 
                error: null,
            });

            if (updateInfo.isUpdateAvailable || showModalIfNoUpdate) {
                set({ showUpdateModal: true });
            }

        } catch (e) {
            set({ error: "检查更新时发生错误。", isLatestVersion: false });
            if (showModalIfNoUpdate) {
                set({ showUpdateModal: true });
            }
        }
    },

    switchBuildTarget: (desiredTarget) => {
        set({ targetChannel: desiredTarget, updateAvailable: false, availableVersions: null });
        get().checkForUpdate(true); 
    },

    handleDownload: async (version) => { 
        const state = get();
        set({ downloading: true, downloadProgress: 0, error: null, downloadedPath: null });
        
        try {
            const path = await updateService.downloadUpdate(version, state.targetChannel);
            set({ downloadedPath: path, downloading: false, downloadProgress: 100 });
        } catch (e) {
            set({ downloading: false, error: "下载失败。" });
        }
    },
    
    installUpdate: async () => { /* ... (不变) */ },
    skipThisVersion: async () => { /* ... (不变) */ },
}));
