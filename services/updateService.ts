import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import Toast from "react-native-toast-message";
import { version as currentVersion } from "../package.json";
import { UPDATE_CONFIG } from "../constants/UpdateConfig";
import Logger from "@/utils/Logger";
import { Platform } from "react-native";

const logger = Logger.withTag("UpdateService");

interface VersionInfo {
  currentTarget: "dev" | "tag";
  latestVersion: string;
  baselineVersion: string;
  availableVersions: string[];
  downloadUrl: string;
  upstreamVersion?: string;
  updatedAt?: string; // 新增：來源的時間戳（保留原始碼方式）
}

const ANDROID_MIME_TYPE = "application/vnd.android.package-archive";

class UpdateService {
  private static instance: UpdateService;
  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /** --------------------------------------------------------------
   *  1️⃣ 远程版本检查：同时获取 dev / tag，再调用 UpdateConfig.checkForUpdate
   * --------------------------------------------------------------- */
  async checkVersion(currentBuildTarget: "dev" | "tag"): Promise<VersionInfo> {
    try {
      const devUrl =
        typeof UPDATE_CONFIG.CHECK_SOURCES.dev === "function"
          ? UPDATE_CONFIG.CHECK_SOURCES.dev(currentVersion)
          : UPDATE_CONFIG.CHECK_SOURCES.dev;

      const tagUrl =
        typeof UPDATE_CONFIG.CHECK_SOURCES.tag === "function"
          ? UPDATE_CONFIG.CHECK_SOURCES.tag(currentVersion)
          : UPDATE_CONFIG.CHECK_SOURCES.tag;

      const [responseDev, responseTag] = await Promise.all([fetch(devUrl), fetch(tagUrl)]);

      const devPackage = responseDev.ok ? await responseDev.json() : { version: "", updated_at: "" };
      const tagPackage = responseTag.ok ? await responseTag.json() : { version: "", updated_at: "" };

      const latestDev = devPackage.version ?? "";
      const latestTag = tagPackage.version ?? "";

      const updateInfo = UPDATE_CONFIG.checkForUpdate(currentBuildTarget, latestDev, latestTag);

      return {
        currentTarget: updateInfo.currentTarget,
        latestVersion: updateInfo.latestVersion,
        baselineVersion: updateInfo.baselineVersion,
        availableVersions: updateInfo.availableVersions,
        downloadUrl: UPDATE_CONFIG.getDownloadUrl(updateInfo.latestVersion, updateInfo.currentTarget),
        updatedAt: updateInfo.currentTarget === "dev" ? devPackage.updated_at : tagPackage.updated_at,
      };
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "检查更新失败",
        text2: "无法获取版本信息，请检查网络",
      });
      throw e;
    }
  }

  /** --------------------------------------------------------------
   *  2️⃣ 清理旧的 APK 文件
   * --------------------------------------------------------------- */
  private async cleanOldApkFiles(): Promise<void> {
    try {
      const dirUri = FileSystem.documentDirectory;
      if (!dirUri) throw new Error("Document directory is not available");

      const listing = await FileSystem.readDirectoryAsync(dirUri);
      const apkFiles = listing.filter((name) => name.endsWith(".apk"));

      if (apkFiles.length <= 2) return;

      const sorted = apkFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
        return numB - numA;
      });

      const stale = sorted.slice(2);
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
      logger.warn("cleanOldApkFiles error", e);
    }
  }

  // 下載 APK，含重試與進度回呼
  async downloadApk(
    version: string,
    buildTarget: "dev" | "tag",
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const maxRetries = 3;
    await this.cleanOldApkFiles();

    const url = UPDATE_CONFIG.getDownloadUrl(version, buildTarget);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 本地檔名和 Tag 一致
        const fileName = `${version}.apk`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          fileUri,
          {},
          (progress) => {
            if (onProgress && progress.totalBytesExpectedToWrite) {
              const percent = Math.floor(
                (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
              );
              onProgress(percent);
            }
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (result && result.uri) {
          logger.debug(`APK downloaded to ${result.uri}`);
          return result.uri;
        } else {
          throw new Error("Download failed: No URI available");
        }
      } catch (e) {
        logger.warn(`downloadApk attempt ${attempt}/${maxRetries}`, e);
        if (attempt === maxRetries) {
          Toast.show({ type: "error", text1: "下载失败", text2: "APK 下载出现错误，请检查网络" });
          throw e;
        }
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    throw new Error("Download failed");
  }

  /** --------------------------------------------------------------
   *  4️⃣ 安装 APK（只在 Android 可用）
   * --------------------------------------------------------------- */
  async installApk(fileUri: string): Promise<void> {
    const exists = await FileSystem.getInfoAsync(fileUri);
    if (!exists.exists) throw new Error(`APK not found at ${fileUri}`);

    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    if (Platform.OS === "android") {
      try {
        const flags = 1 | 0x00000010;
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: ANDROID_MIME_TYPE,
          flags,
        });
      } catch (e: any) {
        if (e.message?.includes("Activity not found")) {
          Toast.show({ type: "error", text1: "安装失败", text2: "系统没有找到可以打开 APK 的应用，请检查系统设置" });
        } else if (e.message?.includes("permission")) {
          Toast.show({ type: "error", text1: "安装失败", text2: "请在设置里允许“未知来源”安装" });
        } else {
          Toast.show({ type: "error", text1: "安装失败", text2: "未知错误，请稍后重试" });
        }
        throw e;
      }
    } else {
      Toast.show({ type: "error", text1: "安装失败", text2: "iOS 设备无法直接安装 APK" });
      throw new Error("APK install not supported on iOS");
    }
  }

  /** --------------------------------------------------------------
   *  5️⃣ 版本比对工具
   * --------------------------------------------------------------- */
  compareVersions(v1: string, v2: string): number {
    const p1 = v1.split(".").map(Number);
    const p2 = v2.split(".").map(Number);
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

export default UpdateService.getInstance();
