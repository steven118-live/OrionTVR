// components/UpdateModal.tsx
// 最終版：React Native（含 TV） + Web 完全相容版
// 保留你原本的優美 UI + TV 聚焦 + 整合最強更新邏輯

import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useUpdateStore } from "@/stores/updateStore";
import { Colors } from "@/constants/Colors";
import { StyledButton } from "./StyledButton";
import { ThemedText } from "./ThemedText";

export function UpdateModal() {
  const {
    showUpdateModal,
    currentVersion,
    remoteVersion,
    downloading,
    downloadProgress,
    error,
    setShowUpdateModal,
    startDownload,
    installUpdate,
    skipThisVersion,
    downloadedPath,
  } = useUpdateStore();

  // TV 自動聚焦用
  const updateButtonRef = useRef<View>(null);
  const laterButtonRef = useRef<View>(null);
  const skipButtonRef = useRef<View>(null);

  const handleUpdate = async () => {
    if (!downloading && !downloadedPath) {
      await startDownload();
    } else if (downloadedPath) {
      await installUpdate();
    }
  };

  const handleLater = () => setShowUpdateModal(false);
  const handleSkip = async () => await skipThisVersion();

  // TV 平台自動聚焦到「立即更新」按鈕
  useEffect(() => {
    if (showUpdateModal && Platform.isTV) {
      setTimeout(() => {
        updateButtonRef.current?.focus?.();
      }, 300);
    }
  }, [showUpdateModal]);

  const getButtonText = () => {
    if (downloading) {
      return `下载中 ${downloadProgress.toFixed(0)}%`;
    } else if (downloadedPath) {
      return "立即安装";
    } else {
      return "立即更新";
    }
  };

  if (!showUpdateModal || !remoteVersion) return null;

  return (
    <Modal
      visible={showUpdateModal}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 標題 */}
          <ThemedText style={styles.title}>發現新版本</ThemedText>

          {/* 版本對比 */}
          <View style={styles.versionInfo}>
            <ThemedText style={styles.currentVersion}>
              當前: v{currentVersion}
            </ThemedText>
            <ThemedText style={styles.arrow}>→</ThemedText>
            <ThemedText style={styles.newVersion}>v{remoteVersion}</ThemedText>
          </View>

          {/* 下載進度條 */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${downloadProgress}%` }]}
                />
              </View>
              <ThemedText style={styles.progressText}>
                {downloadProgress.toFixed(0)}%
              </ThemedText>
            </View>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <ThemedText style={styles.errorText}>
              更新失敗：{error}
            </ThemedText>
          )}

          {/* 按鈕群組 */}
          <View style={styles.buttonContainer}>
            {/* 主按鈕：更新 / 安裝 */}
            <StyledButton
              ref={updateButtonRef}
              onPress={handleUpdate}
              disabled={downloading && !downloadedPath}
              variant="primary"
              style={styles.mainButton}
            >
              {downloading && !downloadedPath ? (
                <ActivityIndicator color="#fff" size={Platform.isTV ? 28 : 24} />
              ) : (
                <ThemedText style={styles.buttonText}>
                  {getButtonText()}
                </ThemedText>
              )}
            </StyledButton>

            {/* 只有在沒下載時才顯示其他按鈕 */}
            {!downloading && !downloadedPath && (
              <>
                <StyledButton
                  ref={laterButtonRef}
                  onPress={handleLater}
                  variant="default"
                  style={styles.button}
                >
                  <ThemedText style={styles.buttonText}>稍後再說</ThemedText>
                </StyledButton>

                <StyledButton
                  ref={skipButtonRef}
                  onPress={handleSkip}
                  variant="default"
                  style={styles.button}
                >
                  <ThemedText style={styles.buttonText}>跳過此版本</ThemedText>
                </StyledButton>
              </>
            )}
          </View>

          {/* 底部提示 */}
          <ThemedText style={styles.footerText}>
            {Platform.isTV ? "使用遙控器方向鍵選擇" : "滑動或點擊空白處關閉"}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: Colors.dark.background || "#111",
    borderRadius: 20,
    padding: Platform.isTV ? 32 : 24,
    width: Platform.isTV ? 560 : "92%",
    maxWidth: 560,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  title: {
    fontSize: Platform.isTV ? 28 : 24,
    fontWeight: "bold",
    color: Colors.dark.text,
    marginBottom: 20,
    paddingTop: 12,
  },
  versionInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  currentVersion: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.dark.text,
  },
  newVersion: {
    color: Colors.dark.primary || "#00bb5e",
    fontWeight: "bold",
  },
  arrow: {
    fontSize: Platform.isTV ? 20 : 18,
    color: Colors.dark.text,
    marginHorizontal: 12,
  },
  progressContainer: {
    width: "100%",
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.dark.primary || "#00bb5e",
  },
  progressText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: Colors.dark.text,
    textAlign: "center",
  },
  errorText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: "#ff4444",
    marginBottom: 16,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    width: "80%",
  },
  mainButton: {
    width: "85%",
  },
  buttonText: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: "600",
    color: "#fff",
  },
  footerText: {
    fontSize: Platform.isTV ? 14 : 12,
    color: Colors.dark.text,
    marginTop: 20,
    textAlign: "center",
  },
});
