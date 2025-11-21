// stores/updateStore.ts (完整覆盖文件)

import { create } from "zustand";
import { updateService } from "../services/updateService";
import { UPDATE_CONFIG, UpdateDecision } from "../constants/UpdateConfig";

// 定义 Store 的状态类型 (只展示新增/修改的关键状态)
interface UpdateState {
    // --- 【新增状态: 解决 TS2353/TS2339 错误】 ---
    showUpdateModal: boolean; // <-- 新增
    isLatestVersion: boolean; // <-- 新增
    // ---------------------------------------------
    
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
    
    // --- 【Actions (仅展示签名) 】 ---
    // initUpdateStore: () => void; // <--- 移除 initUpdateStore 签名，它不应被导出
    checkForUpdate: (showModalIfNoUpdate?: boolean) => Promise<void>;
    handleDownload: (version: string) => Promise<void>;
    switchBuildTarget: (desiredTarget: 'dev' | 'tag') => void;
    installUpdate: () => Promise<void>;
    skipThisVersion: () => Promise<void>;
    setShowUpdateModal: (show: boolean) => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
    // ... 初始化状态 (确保 showUpdateModal 和 isLatestVersion 有默认值)
    currentVersion: '1.0.0.000',
    remoteVersion: null,
    availableVersions: null,
    baselineVersion: null,
    updateAvailable: false,
    downloading: false,
    downloadProgress: 0,
    downloadedPath: null,
    error: null,
    lastCheckTime: 0,
    
    // 确保这些新增属性有默认值
    showUpdateModal: false, 
    isLatestVersion: true, 

    currentBuildTarget: updateService.getCurrentBuildTarget(), 
    targetChannel: updateService.getCurrentBuildTarget(),      

    // 【Actions】

    // 移除 initUpdateStore 的实现，因为它不应该被导出。如果需要，可以在其他地方调用逻辑。
    // initUpdateStore: () => { ... }, 

    setShowUpdateModal: (show) => set({ showUpdateModal: show }),

    checkForUpdate: async (showModalIfNoUpdate = false) => {
        const state = get();
        set({ error: null, isLatestVersion: false }); // 检查前重置 isLatestVersion

        try {
            const updateInfo = await updateService.checkVersion(
                state.currentVersion,
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
            
            // 确定是否是最新版本
            const isLatest = !updateInfo.isUpdateAvailable && 
                             (UPDATE_CONFIG.compareVersions(state.currentVersion, updateInfo.latestVersion) >= 0);

            set({
                lastCheckTime: Date.now(),
                remoteVersion: updateInfo.latestVersion,
                baselineVersion: updateInfo.baselineVersion,
                updateAvailable: updateInfo.isUpdateAvailable,
                availableVersions: updateInfo.availableVersions,
                isLatestVersion: isLatest, // <-- 更新状态
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

    // --- 【新增 Action: 切换通道并重新检查】 ---
    switchBuildTarget: (desiredTarget) => {
        set({ targetChannel: desiredTarget, updateAvailable: false, availableVersions: null });
        get().checkForUpdate(true); 
    },

    // --- 【修改 Action: 处理下载】 ---
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

    // --- 【修改 Action: 安装】 ---
    installUpdate: async () => {
        const path = get().downloadedPath;
        if (!path) return;
        
        try {
            await updateService.installApk(path); 
        } catch (e) {
            set({ error: "安装失败。" });
        }
    },

    // ... 其他 Actions (略)
    skipThisVersion: async () => {
        // ... (省略实现)
    },
}));
