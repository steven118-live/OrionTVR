// stores/updateStore.ts (完整覆盖版)

import { create } from 'zustand';
import { updateService } from '../services/updateService'; 
import { UPDATE_CONFIG, UpdateDecision } from '../constants/UpdateConfig';

// ----------------------------------------------------------------------
// 状态接口定义 (STATE) - 扁平化以匹配 UI
// ----------------------------------------------------------------------

export interface FlatUpdateState {
    initComplete: boolean;
    isUpdating: boolean;
    lastCheckTime: number;

    downloading: boolean;
    downloadProgress: number; 
    downloadedPath: string | null; 

    currentVersion: string; 
    currentBuildTarget: 'dev' | 'tag'; 
    targetChannel: 'dev' | 'tag'; 

    isUpdateAvailable: boolean; 
    latestVersion: string; // 对应 UI 的 remoteVersion
    baselineVersion: string;
    availableVersions: string[];
    reason: string;
    isLatestVersion: boolean; 

    upstreamTagVersion: string | null; 
    
    errorReason: string | null; // 对应 UI 的 error
    showUpdateModal: boolean; // 对应 UI 的 setShowUpdateModal
}

// ----------------------------------------------------------------------
// 动作接口定义 (ACTIONS)
// ----------------------------------------------------------------------

export interface UpdateActions {
    initialize: () => Promise<void>;
    checkForUpdate: () => Promise<void>; // 修复: 无参数
    closeModal: () => void;
    switchBuildTarget: (target: 'dev' | 'tag') => void; // 修复: 匹配 UI 命名
    handleDownload: (version: string, buildTarget: 'dev' | 'tag') => Promise<void>;
    installUpdate: () => Promise<void>; // 修复: 无参数
    skipThisVersion: () => void;
}

export type UpdateStoreType = FlatUpdateState & UpdateActions;

export const useUpdateStore = create<UpdateStoreType>((set, get) => ({
    // ------------------------------------
    // 初始状态
    // ------------------------------------
    initComplete: false,
    isUpdating: false,
    lastCheckTime: 0,
    
    downloading: false,
    downloadProgress: 0,
    downloadedPath: null,

    currentVersion: 'vloading...', 
    currentBuildTarget: updateService.getCurrentBuildTarget(),
    targetChannel: updateService.getCurrentBuildTarget(),
    
    isUpdateAvailable: false,
    latestVersion: 'vloading...',
    baselineVersion: 'vloading...',
    availableVersions: [],
    reason: '未检查',
    isLatestVersion: false, 

    upstreamTagVersion: null, 
    
    errorReason: null,
    showUpdateModal: false,

    // ------------------------------------
    // Actions
    // ------------------------------------

    initialize: async () => {
        const target = updateService.getCurrentBuildTarget(); 
        
        // ⚠️ 重点提醒：请替换为您的实际版本获取函数！
        const version = "1.3.11-tag"; 
        
        set({
            currentVersion: version, 
            currentBuildTarget: target, 
            targetChannel: target,
            latestVersion: version, 
            baselineVersion: UPDATE_CONFIG.BASELINE_VERSIONS[target],
            initComplete: true, 
        });
    },

    checkForUpdate: async () => {
        const state = get();
        const { currentVersion, targetChannel, currentBuildTarget } = state;
        
        if (state.isUpdating) return;
        
        set({ isUpdating: true, errorReason: null, showUpdateModal: false, isLatestVersion: false });

        try {
            if (currentVersion === 'vloading...') {
                throw new Error("初始化版本信息失败，无法检查更新。");
            }
            
            const result = await updateService.checkVersion(
                currentVersion,
                targetChannel,
                currentBuildTarget
            );

            if (!result) {
                 throw new Error("更新服务返回空结果。");
            }
            
            const isLatest = result.isUpdateAvailable === false && result.reason.includes('已经是最新版本');

            // 成功：扁平化并更新所有状态
            set({
                lastCheckTime: Date.now(),
                isUpdateAvailable: result.isUpdateAvailable,
                latestVersion: result.latestVersion,
                baselineVersion: result.baselineVersion,
                availableVersions: result.availableVersions,
                reason: result.reason,
                isLatestVersion: isLatest,
                upstreamTagVersion: result.upstreamTagVersion, 
                showUpdateModal: true, 
                isUpdating: false,
            });

        } catch (e: any) {
            console.error("Update Check Failed:", e.message);
            set({
                lastCheckTime: Date.now(),
                errorReason: e.message || "网络连接或解析错误",
                showUpdateModal: true, 
                isUpdating: false,
            });
        }
    },
    
    handleDownload: async (version: string, buildTarget: 'dev' | 'tag') => {
        set({ downloading: true, downloadProgress: 0, downloadedPath: null });
        try {
            const path = await updateService.downloadUpdate(version, buildTarget);
            set({ downloadedPath: path, downloading: false, downloadProgress: 100 });
        } catch (e: any) {
            set({ errorReason: "下载失败: " + e.message, downloading: false });
        }
    },
    
    installUpdate: async () => {
        const path = get().downloadedPath;
        if (!path) {
            set({ errorReason: "错误：找不到已下载的更新文件路径。" });
            return;
        }
        try {
            await updateService.installApk(path);
        } catch (e: any) {
            set({ errorReason: "安装失败: " + e.message });
        }
    },

    skipThisVersion: () => {
        set({ showUpdateModal: false });
    },
    
    closeModal: () => {
        set({ showUpdateModal: false, errorReason: null });
    },
    
    switchBuildTarget: (target: 'dev' | 'tag') => {
        set({ targetChannel: target });
    }
}));
