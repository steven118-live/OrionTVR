import { create } from 'zustand';
import updateService from '../services/updateService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('UpdateStore');

interface UpdateState {
  // 状态
  updateAvailable: boolean;
  currentVersion: string;
  upstreamVersion: string;
  remoteVersion: string;
  downloadUrl: string;
  downloading: boolean;
  downloadProgress: number;
  downloadedPath: string | null;
  error: string | null;
  lastCheckTime: number;
  skipVersion: string | null;
  showUpdateModal: boolean;
  isLatestVersion: boolean;

  // 新增字段
  availableVersions: string[];
  baselineVersion: string;
  currentTarget: "dev" | "tag";

  // 操作
  checkForUpdate: (silent?: boolean) => Promise<void>;
  handleDownload: (version: string) => Promise<void>;
  installUpdate: () => Promise<void>;
  setShowUpdateModal: (show: boolean) => void;
  skipThisVersion: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEYS = {
  LAST_CHECK_TIME: 'update_last_check_time',
  SKIP_VERSION: 'update_skip_version',
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  // 初始状态
  updateAvailable: false,
  currentVersion: updateService.getCurrentVersion(),
  upstreamVersion: '',
  remoteVersion: '',
  downloadUrl: '',
  downloading: false,
  downloadProgress: 0,
  downloadedPath: null,
  error: null,
  lastCheckTime: 0,
  skipVersion: null,
  showUpdateModal: false,
  isLatestVersion: false,

  // 新增字段
  availableVersions: [],
  baselineVersion: '',
  currentTarget: "dev", // 默认 dev，可根据环境变量或配置修改

  // 检查更新
  checkForUpdate: async (silent = false) => {
    try {
      set({ error: null, isLatestVersion: false });

      const skipVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION);

      const { currentTarget } = get();
      const versionInfo = await updateService.checkVersion(currentTarget);

      const isUpdateAvailable = updateService.isUpdateAvailable(versionInfo.latestVersion);
      const shouldShowUpdate = isUpdateAvailable && versionInfo.latestVersion !== skipVersion;
      const isLatest = !isUpdateAvailable;

      set({
        upstreamVersion: versionInfo.upstreamVersion ?? '',
        remoteVersion: versionInfo.latestVersion,
        downloadUrl: versionInfo.downloadUrl,
        updateAvailable: isUpdateAvailable,
        lastCheckTime: Date.now(),
        skipVersion,
        showUpdateModal: shouldShowUpdate && !silent,
        isLatestVersion: isLatest,
        availableVersions: versionInfo.availableVersions,
        baselineVersion: versionInfo.baselineVersion,
      });

      if (!silent && isLatest) {
        Toast.show({
          type: 'success',
          text1: '已是最新版本',
          text2: `当前版本 v${updateService.getCurrentVersion()} 已是最新版本`,
          visibilityTime: 3000,
        });
      }

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIME, Date.now().toString());
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '检查更新失败',
        updateAvailable: false,
        isLatestVersion: false,
      });
    }
  },

  // 下载指定版本
  handleDownload: async (version: string) => {
    const { currentTarget } = get();
    try {
      set({ downloading: true, downloadProgress: 0, error: null });

      const filePath = await updateService.downloadApk(
        version.split(" ")[1],
        currentTarget,
        (progress) => set({ downloadProgress: progress })
      );

      set({
        downloadedPath: filePath,
        downloading: false,
        downloadProgress: 100,
      });
    } catch (error) {
      set({
        downloading: false,
        downloadProgress: 0,
        error: error instanceof Error ? error.message : '下载失败',
      });
    }
  },

  // 安装更新
  installUpdate: async () => {
    const { downloadedPath } = get();
    if (!downloadedPath) {
      set({ error: '安装文件不存在' });
      return;
    }
    try {
      await updateService.installApk(downloadedPath);
      set({ showUpdateModal: false });
    } catch (error) {
      logger.error('安装失败:', error);
      set({ error: error instanceof Error ? error.message : '安装失败' });
    }
  },

  setShowUpdateModal: (show: boolean) => {
    set({ showUpdateModal: show });
  },

  skipThisVersion: async () => {
    const { remoteVersion } = get();
    if (remoteVersion) {
      await AsyncStorage.setItem(STORAGE_KEYS.SKIP_VERSION, remoteVersion);
      set({ skipVersion: remoteVersion, showUpdateModal: false });
    }
  },

  reset: () => {
    set({
      downloading: false,
      downloadProgress: 0,
      downloadedPath: null,
      error: null,
      showUpdateModal: false,
      isLatestVersion: false,
      availableVersions: [],
      baselineVersion: '',
    });
  },
}));

export const initUpdateStore = async () => {
  try {
    const lastCheckTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME);
    const skipVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION);

    useUpdateStore.setState({
      lastCheckTime: lastCheckTime ? parseInt(lastCheckTime, 10) : 0,
      skipVersion: skipVersion || null,
    });
  } catch (error) {
    logger.error('初始化更新存储失败:', error);
  }
};
