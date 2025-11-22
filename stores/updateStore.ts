// stores/updateStore.ts
import { create } from 'zustand';
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { UPDATE_CONFIG } from '@/constants/UpdateConfig';

interface UpdateState {
  // 狀態
  currentVersion: string;
  remoteVersion: string | null;
  updateAvailable: boolean;
  downloading: boolean;
  downloadProgress: number;
  downloadedPath: string | null;
  isLatestVersion: boolean;
  showUpdateModal: boolean;
  skippedVersion: string | null;
  error: string | null;
  lastCheckTime: number;

  // 初始化
  initialize: () => void;

  // 動作
  checkForUpdate: () => Promise<void>;
  startDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  skipThisVersion: () => void;
  setShowUpdateModal: (show: boolean) => void;
  resetError: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: "1.0.0", // 請改成你 package.json 的 version
  remoteVersion: null,
  updateAvailable: false,
  downloading: false,
  downloadProgress: 0,
  downloadedPath: null,
  isLatestVersion: false,
  showUpdateModal: false,
  skippedVersion: null,
  error: null,
  lastCheckTime: 0,

  // 初始化：讀取本地版本 + 跳過版本記錄（可搭配 AsyncStorage 持久化）
  initialize: () => {
    // 這裡未來可加入從 AsyncStorage 讀取 skippedVersion
    set({ lastCheckTime: Date.now() });
  },

  checkForUpdate: async () => {
    const { currentVersion } = get();
    set({ error: null, remoteVersion: null, updateAvailable: false });

    try {
      const response = await fetch(UPDATE_CONFIG.GITHUB_RAW_URL, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('無法連接更新伺服器');

      const data = await response.json();
      const latestVersion: string = data.version?.trim();

      if (!latestVersion) throw new Error('版本資訊解析失敗');

      // 檢查是否跳過
      const { skippedVersion } = get();
      if (UPDATE_CONFIG.ALLOW_SKIP_VERSION && skippedVersion === latestVersion) {
        set({ isLatestVersion: true, lastCheckTime: Date.now() });
        return;
      }

      if (currentVersion === latestVersion) {
        set({ remoteVersion: latestVersion, isLatestVersion: true, lastCheckTime: Date.now() });
        return;
      }

      // 有新版本！
      set({
        remoteVersion: latestVersion,
        updateAvailable: true,
        isLatestVersion: false,
        showUpdateModal: true,
        lastCheckTime: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '檢查更新失敗';
      set({ error: msg });
      console.warn('[UpdateStore] 檢查更新失敗:', msg);
    }
  },

  startDownload: async () => {
    const { remoteVersion } = get();
    if (!remoteVersion || get().downloading) return;

    const downloadUrl = UPDATE_CONFIG.getDownloadUrl(remoteVersion);
    const fileUri = `${FileSystem.cacheDirectory}orionTV_${remoteVersion}.apk`;

    set({ downloading: true, downloadProgress: 0, error: null });

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          set({ downloadProgress: Math.round(progress * 100) });
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result?.status !== 200) throw new Error('下載失敗');

      set({
        downloading: false,
        downloadProgress: 100,
        downloadedPath: result.uri,
        updateAvailable: true,
      });

      Alert.alert('下載完成', '更新包已準備好，是否立即安裝？', [
        { text: '稍後', style: 'cancel' },
        { text: '立即安裝', onPress: () => get().installUpdate() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '下載失敗';
      set({ error: msg, downloading: false });
      Alert.alert('下載失敗', msg);
    }
  },

  installUpdate: async () => {
    const { downloadedPath } = get();
    if (!downloadedPath || Platform.OS !== 'android') return;

    try {
      const contentUri = await FileSystem.getContentUriAsync(downloadedPath);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    } catch (err) {
      Alert.alert('安裝失敗', '無法開啟安裝程式，請手動安裝已下載的 APK');
      // 備用：開啟檔案管理器
      Linking.openURL(FileSystem.documentDirectory!);
    }
  },

  skipThisVersion: () => {
    const { remoteVersion } = get();
    if (!remoteVersion) return;

    set({
      skippedVersion: remoteVersion,
      showUpdateModal: false,
      updateAvailable: false,
      isLatestVersion: true,
    });

    // 這裡未來可加入 AsyncStorage.setItem('skippedVersion', remoteVersion)
    Alert.alert('已跳過', `已跳過版本 v${remoteVersion}，下次啟動不再提醒`);
  },

  setShowUpdateModal: (show) => set({ showUpdateModal: show }),

  resetError: () => set({ error: null }),
}));
