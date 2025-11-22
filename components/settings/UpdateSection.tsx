// settings/UpdateSection.tsx
import React, { useState, useCallback } from "react";
// 修正: 引入所有必需的類型，包括 StyleProp, TextStyle, ViewStyle, ReactNode
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity, Alert, StyleProp, TextStyle, ViewStyle } from "react-native";
import { create } from 'zustand';
import { ReactNode } from "react"; 

// --- [ 介面定義 ] ---
// 1. ThemedText 的 Props 介面
interface ThemedTextProps {
    style?: StyleProp<TextStyle>;
    children: ReactNode;
}

// 2. StyledButton 的 Props 介面
interface StyledButtonProps {
    onPress: () => void; // 必須是 function
    disabled: boolean;
    style?: StyleProp<ViewStyle>;
    children: ReactNode;
}
// --- [ 模擬外部依賴 - 修正 TS7031: 隱含 any 類型 ] ---
// 修正: 為 props 加上類型註釋
const ThemedText = ({ style, children }: ThemedTextProps) => <Text style={[styles.themedText, style]}>{children}</Text>;

// 修正: 為 props 加上類型註釋
const StyledButton = ({ onPress, disabled, style, children }: StyledButtonProps) => (
    <TouchableOpacity 
        onPress={onPress} 
        disabled={disabled} 
        style={[styles.baseButton, style, disabled && styles.disabledButton]}
    >
        {children}
    </TouchableOpacity>
);

// --- [ 內嵌 useUpdateStore 邏輯以解決 '@/stores/updateStore' 引用錯誤 ] ---

// 定義 Store 狀態的介面
interface UpdateState {
    currentVersion: string; 
    upstreamVersion: string;
    remoteVersion: string | null; 
    updateAvailable: boolean; 
    downloading: boolean; 
    downloadProgress: number; 
    downloadedPath: string | null; 
    isLatestVersion: boolean; 
    error: string | null;
    
    // 動作
    checkForUpdate: (isSilent: boolean) => Promise<void>;
    startDownload: () => Promise<void>;
    installUpdate: () => Promise<void>;
}

/**
 * 模擬應用程式更新的狀態管理 Store。
 * 包含檢查、下載、安裝的模擬邏輯。
 */
export const useUpdateStore = create<UpdateState>((set, get) => ({
    // 初始狀態：模擬當前版本 1.0.0，伺服器上有 1.0.2 且有更新可用
    currentVersion: "1.0.0",
    upstreamVersion: "1.0.10", // 模擬原始碼版本
    remoteVersion: "1.0.2",
    updateAvailable: true, 
    downloading: false,
    downloadProgress: 0,
    downloadedPath: null,
    isLatestVersion: false,
    error: null,

    // 檢查更新 (模擬)
    checkForUpdate: async (isSilent: boolean = true) => {
        set({ error: null, remoteVersion: null, updateAvailable: false, downloading: false, downloadedPath: null });

        await new Promise(resolve => setTimeout(resolve, 1500)); 

        const latestVersion = "1.0.2"; 
        const currentVersion = get().currentVersion;

        if (currentVersion !== latestVersion) {
            set({ remoteVersion: latestVersion, updateAvailable: true, isLatestVersion: false});
            if (!isSilent) {
                Alert.alert("檢查更新", `發現新版本 v${latestVersion}，請下載安裝！`);
            }
        } else {
            set({ remoteVersion: latestVersion, isLatestVersion: true, updateAvailable: false});
            if (!isSilent) {
                Alert.alert("檢查更新", "您的應用程式已是最新版本。");
            }
        }
    },

    // 開始下載 (模擬)
    startDownload: async () => {
        const { remoteVersion } = get();
        if (!remoteVersion || get().downloading) return;

        set({ downloading: true, downloadProgress: 0, downloadedPath: null, error: null, updateAvailable: false });
        Alert.alert("開始下載", `正在下載 v${remoteVersion}...`);

        // 模擬下載進度
        return new Promise<void>((resolve) => { // 修正: 確保 Promise 類型明確
            const interval = setInterval(() => {
                set(state => {
                    const newProgress = state.downloadProgress + Math.random() * 10 + 5; 
                    if (newProgress >= 100) {
                        clearInterval(interval);
                        Alert.alert("下載完成", "更新包已下載完成，請立即安裝。");
                        resolve();
                        return { 
                            downloading: false, 
                            downloadProgress: 100, 
                            downloadedPath: `/cache/update_${remoteVersion}.zip`, 
                        };
                    }
                    return { downloadProgress: newProgress };
                });
            }, 300);
        });
    },

    // 安裝更新 (模擬)
    installUpdate: async () => {
        if (!get().downloadedPath) return;

        Alert.alert("安裝中", `正在安裝更新。應用程式將很快重啟...`, [
            { text: "確定", onPress: () => {
                set({ 
                    currentVersion: get().remoteVersion || get().currentVersion, 
                    downloadedPath: null,
                    remoteVersion: null,
                    isLatestVersion: true,
                });
            }}
        ]);
    },
}));


// --- [ UpdateSection 組件 ] ---
export function UpdateSection() {
  const { 
    currentVersion, 
    upstreamVersion,
    remoteVersion, 
    updateAvailable, 
    downloading, 
    downloadProgress, 
    downloadedPath, 
    checkForUpdate,
    startDownload, 
    installUpdate, 
    isLatestVersion,
    error
  } = useUpdateStore();

  const [checking, setChecking] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      await checkForUpdate(false);
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    try {
      await startDownload();
    } catch (err) {
      // 錯誤已在 Store 中處理
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await installUpdate();
    } finally {
      setInstalling(false);
    }
  };

  // 根據狀態選擇主要按鈕的內容和操作
  const renderActionButton = () => {
    if (checking) {
      return (
          // 修正 TS2741: 缺少 'onPress'
          <StyledButton onPress={() => {}} disabled={true} style={styles.button}>
              <ActivityIndicator color="#fff" size="small" />
          </StyledButton>
      );
    }
    
    if (downloading) {
      return (
          // 修正 TS2741: 缺少 'onPress'
          <StyledButton onPress={() => {}} disabled={true} style={styles.downloadingButton}>
              <ThemedText style={styles.buttonText}>下載中... {downloadProgress.toFixed(0)}%</ThemedText>
          </StyledButton>
      );
    }

    if (downloadedPath) {
      // APK已下載完成，可以安裝
      return (
        <StyledButton onPress={handleInstall} disabled={installing} style={styles.installButton}>
          {installing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.buttonText}>立即安裝 v{remoteVersion}</ThemedText>
          )}
        </StyledButton>
      );
    }

    if (updateAvailable && remoteVersion) {
      // 有更新但未下載
      return (
        // 修正 TS2741: 缺少 'disabled'
        <StyledButton onPress={handleDownload} disabled={false} style={styles.updateButton}>
          <ThemedText style={styles.buttonText}>下載更新 v{remoteVersion}</ThemedText>
        </StyledButton>
      );
    }
    
    // 預設：檢查更新按鈕
    return (
      <StyledButton onPress={handleCheckUpdate} disabled={checking || downloading} style={styles.button}>
        <ThemedText style={styles.buttonText}>檢查更新</ThemedText>
      </StyledButton>
    );
  };

  return (
    <View style={styles.sectionContainer}>
      <ThemedText style={styles.sectionTitle}>应用更新</ThemedText>

      <View style={styles.row}>
        <ThemedText style={styles.label}>原始碼最新版本</ThemedText>
        <ThemedText style={styles.value}>v{upstreamVersion || 'x.x.xx'}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>当前版本</ThemedText>
        <ThemedText style={styles.value}>v{currentVersion}</ThemedText>
      </View>

      {/* 顯示最新版本提示或新版本提示 */}
      {(isLatestVersion || updateAvailable) && remoteVersion && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>狀態</ThemedText>
          {isLatestVersion ? (
                <ThemedText style={[styles.value, styles.latestVersion]}>已是最新版本</ThemedText>
            ) : (
                <ThemedText style={[styles.value, styles.newVersion]}>新版本 v{remoteVersion} 可用</ThemedText>
            )}
        </View>
      )}
      
      {/* 顯示錯誤提示 */}
      {error && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>檢查結果</ThemedText>
          <ThemedText style={[styles.value, styles.errorText]}>{error}</ThemedText>
        </View>
      )}

      {/* 顯示下載進度 */}
      {downloading && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>下載進度</ThemedText>
          <ThemedText style={[styles.value, {color: '#3498db'}]}>{downloadProgress.toFixed(0)}%</ThemedText>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {renderActionButton()}
      </View>

      {/* {UPDATE_CONFIG.AUTO_CHECK && (
        <ThemedText style={styles.hint}>
          自动检查更新已开启，每{UPDATE_CONFIG.CHECK_INTERVAL / (60 * 60 * 1000)}小时检查一次
        </ThemedText>
      )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  // 模擬 ThemedText 的基礎樣式
  themedText: {
    color: '#ccc', // 模擬深色主題的文字顏色
  },
  
  // 模擬 StyledButton 的基礎樣式
  baseButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },

  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Platform.select({
      ios: "rgba(255, 255, 255, 0.05)",
      android: "rgba(255, 255, 255, 0.05)",
      default: "transparent",
    }),
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 24 : 20,
    fontWeight: "bold",
    marginBottom: 16,
    paddingTop: 8,
    color: '#fff',
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: Platform.isTV ? 18 : 16,
    color: "#999",
  },
  value: {
    fontSize: Platform.isTV ? 18 : 16,
    color: '#ccc',
  },
  newVersion: {
    color: "#00bb5e",
    fontWeight: "bold",
  },
  latestVersion: {
    color: "#00bb5e",
    fontWeight: "500",
  },
  errorText: {
    color: "#ff6b6b",
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    justifyContent: "center", 
    alignItems: "center",
  },
  button: {
    width: "90%",
    backgroundColor: '#007bff', 
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  updateButton: { 
    width: "90%",
    backgroundColor: '#00bb5e', 
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  downloadingButton: {
    width: "90%",
    backgroundColor: '#3498db', // 下載中用藍色
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  installButton: { 
    width: "90%",
    backgroundColor: '#ff9800', 
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Platform.isTV ? 16 : 14,
    fontWeight: "500",
  },
  hint: {
    fontSize: Platform.isTV ? 14 : 12,
    color: "#666",
    marginTop: 12,
    textAlign: "center",
  },
});
