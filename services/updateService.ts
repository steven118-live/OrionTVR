// UpdateService.ts
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
// import * as Device from 'expo-device';
import Toast from 'react-native-toast-message';
import { version as currentVersion } from '../package.json';
import { UPDATE_CONFIG } from '../constants/UpdateConfig';
import Logger from '@/utils/Logger';
import { Platform } from 'react-native';

const logger = Logger.withTag('UpdateService');

interface VersionInfo {
  version: string;               // 主要版本（例如 GitHub
  downloadUrl: string;
  upstreamVersion?: string;      // 新增：oriontv.org 的版本
}

/**
 * 只在 Android 平台使用的常量（iOS 不會走到下載/安裝流程）
 */
const ANDROID_MIME_TYPE = 'application/vnd.android.package-archive';

class UpdateService {
  private static instance: UpdateService;
  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /** --------------------------------------------------------------
   *  1️⃣ 遠端版本檢查（保持不變，只是把 fetch 包裝成 async/await）
   * --------------------------------------------------------------- */
  async checkVersion(): Promise<VersionInfo> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        const [responseGitHub, responseUpstream] = await Promise.all([
          fetch(UPDATE_CONFIG.GITHUB_RAW_URL, { signal: controller.signal }),
          fetch(UPDATE_CONFIG.ORIONTV_ORG_GITHUB_RAW_URL, { signal: controller.signal }),
        ]);
        clearTimeout(timeoutId);
        if (!responseGitHub.ok) {
          throw new Error(`GitHub HTTP ${responseGitHub.status}`);
        }
        const remotePackage = await responseGitHub.json();
        const remoteVersion = remotePackage.version as string;
        let upstreamVersion = '';
        if (responseUpstream.ok) {
          try {
            const upstreamPackage = await responseUpstream.json();
            upstreamVersion = upstreamPackage.version ?? '';
          } catch (e) {
            logger.warn('解析 upstream 版本失敗', e);
          }
      }
        return {
          version: remoteVersion,
          downloadUrl: UPDATE_CONFIG.getDownloadUrl(remoteVersion),
          upstreamVersion,
        };
      } catch (e) {
        logger.warn(`checkVersion attempt ${attempt}/${maxRetries}`, e);
        if (attempt === maxRetries) {
          Toast.show({
            type: 'error',
            text1: '檢查更新失敗',
            text2: '無法獲取版本訊息,請檢查網路',
          });
          throw e;
        }
        // 指數退避
        await new Promise(r => setTimeout(r, 2_000 * attempt));
      }
    }
    // 這句永遠走不到，僅為 TypeScript 報錯
    throw new Error('Unexpected');
  }

  /** --------------------------------------------------------------
   *  2️⃣ 清理舊的 APK 檔案（使用 expo-file-system 的 API）
   * --------------------------------------------------------------- */
  private async cleanOldApkFiles(): Promise<void> {
    try {
      const dirUri = FileSystem.documentDirectory; // e.g. file:///data/user/0/.../files/
      if (!dirUri) {
        throw new Error('Document directory is not available');
      }
      const listing = await FileSystem.readDirectoryAsync(dirUri);
      const apkFiles = listing.filter(name => name.startsWith('OrionTV_v') && name.endsWith('.apk'));

      if (apkFiles.length <= 2) return;

      const sorted = apkFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        return numB - numA; // 倒序（最新在前）
      });

      const stale = sorted.slice(2); // 保留最新的兩個
      for (const file of stale) {
        const path = `${dirUri}${file}`;
        try {
          await FileSystem.deleteAsync(path, { idempotent: true });
          logger.debug(`Deleted old APK: ${file}`);
        } catch (e) {
          logger.warn(`Failed to delete ${file}`, e);
        }
      }
    } catch (e) {
      logger.warn('cleanOldApkFiles error', e);
    }
  }

  /** --------------------------------------------------------------
   *  3️⃣ 下載 APK（使用 expo-file-system 的下載 API）
   * --------------------------------------------------------------- */
  async downloadApk(
    url: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    const maxRetries = 3;
    await this.cleanOldApkFiles();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timestamp = Date.now();
        const fileName = `OrionTV_v${timestamp}.apk`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        // expo-file-system 把下載進度回調參數統一為 `{totalBytesWritten, totalBytesExpectedToWrite}`
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          fileUri,
          {
            // Android 需要在 AndroidManifest 中宣告 INTERNET、WRITE_EXTERNAL_STORAGE (API 33+ 使用 MANAGE_EXTERNAL_STORAGE)
            // 這裡不使用系統下載管理器，因為我們想自己控制進度回調。
          },
          progress => {
            if (onProgress && progress.totalBytesExpectedToWrite) {
              const percent = Math.floor(
                (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100,
              );
              onProgress(percent);
            }
          },
        );

        const result = await downloadResumable.downloadAsync();
        if (result && result.uri) {
          logger.debug(`APK downloaded to ${result.uri}`);
          return result.uri;
        } else {
          throw new Error('Download failed: No URI available');
        }
      } catch (e) {
        logger.warn(`downloadApk attempt ${attempt}/${maxRetries}`, e);
        if (attempt === maxRetries) {
          Toast.show({
            type: 'error',
            text1: '下載失敗',
            text2: 'APK 下載出現錯誤，請檢查網絡',
          });
          throw e;
        }
        // 指數退避
        await new Promise(r => setTimeout(r, 3_000 * attempt));
      }
    }
    // 同上，理論不會到這裡
    throw new Error('Download failed');
  }

  /** --------------------------------------------------------------
   *  4️⃣ 安裝 APK（只在 Android 可用，使用 expo-intent-launcher）
   * --------------------------------------------------------------- */
  async installApk(fileUri: string): Promise<void> {
    // ① 先確認檔案存在
    const exists = await FileSystem.getInfoAsync(fileUri);
    if (!exists.exists) {
      throw new Error(`APK not found at ${fileUri}`);
    }

    // ② 把 file:// 轉成 content://，Expo‑FileSystem 已經實作了 FileProvider
    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    // ③ 只在 Android 裡執行
    if (Platform.OS === 'android') {
      try {
        // FLAG_ACTIVITY_NEW_TASK = 0x10000000 (1)
        // FLAG_GRANT_READ_URI_PERMISSION = 0x00000010
        const flags = 1 | 0x00000010;   // 1 | 16

        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,          // 必須是 content://
          type: ANDROID_MIME_TYPE,   // application/vnd.android.package-archive
          flags,
        });
      } catch (e: any) {
        // 統一錯誤提示
        if (e.message?.includes('Activity not found')) {
          Toast.show({
            type: 'error',
            text1: '安裝失敗',
            text2: '系統沒有找到可以打開 APK 的應用，請檢查系統設定',
          });
        } else if (e.message?.includes('permission')) {
          Toast.show({
            type: 'error',
            text1: '安裝失敗',
            text2: '請在設定裡允許「未知來源」安裝',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: '安裝失敗',
            text2: '未知錯誤，請稍後重試',
          });
        }
        throw e;
      }
    } else {
      // iOS 裝置不支援直接安裝 APK
      Toast.show({
        type: 'error',
        text1: '安裝失敗',
        text2: 'iOS 裝置無法直接安裝 APK',
      });
      throw new Error('APK install not supported on iOS');
    }
  }

  /** --------------------------------------------------------------
   *  5️⃣ 版本比對工具（保持原來的實作）
   * --------------------------------------------------------------- */
  compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] ?? 0;
      const n2 = p2[i] ?? 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }
  getCurrentVersion(): string {
    return currentVersion;
  }
  isUpdateAvailable(remoteVersion: string): boolean {
    return this.compareVersions(remoteVersion, currentVersion) > 0;
  }
}

/* 單例導出 */
export default UpdateService.getInstance();
