// components/UpdateModal.tsx

import React from "react";
import { Modal, View, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useUpdateStore } from "../stores/updateStore";
import { Colors } from "../constants/Colors";
import { StyledButton } from "./StyledButton";
import { ThemedText } from "./ThemedText";

export function UpdateModal() {
  const {
    showUpdateModal,
    currentVersion,
    availableVersions, // <-- 引入: 可选版本清单
    baselineVersion,   // <-- 引入: 基线版本
    currentBuildTarget, // <-- 引入: 应用当前运行目标
    targetChannel,      // <-- 引入: 当前弹窗展示的目标通道
    downloading,
    downloadProgress,
    error,
    setShowUpdateModal,
    handleDownload,    // <-- 引入: 下载函数 (支持传入版本号)
    installUpdate,
    skipThisVersion,
    downloadedPath,
    switchBuildTarget, // <-- 引入: 切换目标通道的动作
  } = useUpdateStore();

  const updateButtonRef = React.useRef<View>(null);

  // 决定另一个通道的名称
  const otherTarget = currentBuildTarget === 'tag' ? 'dev' : 'tag';
  // 决定当前显示的通道是否是用户正在运行的通道
  const isViewingCurrentTarget = currentBuildTarget === targetChannel;

  function handleLater() {
    setShowUpdateModal(false);
  }
  
  // 切换通道的处理函数
  function handleSwitchTarget() {
    // 切换到另一个通道，或如果当前不在运行通道则返回运行通道
    const newTarget = isViewingCurrentTarget ? otherTarget : currentBuildTarget; 
    switchBuildTarget(newTarget);
  }

  React.useEffect(() => {
    if (showUpdateModal && Platform.isTV) {
      setTimeout(() => {
        // 自动聚焦到第一个可下载/安装的按钮
        updateButtonRef.current?.focus(); 
      }, 100);
    }
  }, [showUpdateModal]);

  return (
    <Modal visible={showUpdateModal} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ThemedText style={styles.title}>发现新版本</ThemedText>

          {/* 当前运行版本信息 */}
          <View style={styles.versionInfo}>
            <ThemedText style={styles.versionText}>当前运行: v{currentVersion} ({currentBuildTarget})</ThemedText>
          </View>

          {/* 目标通道信息 */}
          {targetChannel && (
            <View style={styles.targetInfo}>
                <ThemedText style={styles.targetText}>
                    当前查看通道: 
                    <ThemedText style={[styles.targetText, { fontWeight: 'bold', color: targetChannel === 'dev' ? '#ffcc00' : Colors.dark.primary || '#00bb5e' }]}>
                        {" "} {targetChannel.toUpperCase()}
                    </ThemedText>
                </ThemedText>
            </View>
          )}

          {/* 渲染可选版本清单 */}
          {availableVersions?.map((ver: string, idx: number) => { 
            const isBaseline = ver === baselineVersion; 
            return (
              <View key={idx} style={styles.versionRow}>
                <ThemedText style={styles.versionText}>
                  {ver} {isBaseline ? "（切换基线版）" : ""}
                </ThemedText>
                
                {/* 针对每个版本提供下载按钮 */}
                <StyledButton
                  ref={idx === 0 ? updateButtonRef : undefined}
                  onPress={() => handleDownload(ver)} 
                  disabled={downloading}
                  variant="primary"
                  style={styles.smallButton}
                >
                  {downloading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.buttonText}>下载</ThemedText>
                  )}
                </StyledButton>
              </View>
            );
          })}

          {/* 进度条 */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
              </View>
              <ThemedText style={styles.progressText}>{downloadProgress}%</ThemedText>
            </View>
          )}

          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <View style={styles.buttonContainer}>
            {!downloading && !downloadedPath && (
              <>
                {/* 频道切换按钮: 修复 TS 错误，使用 ghost 模拟 secondary */}
                <StyledButton 
                    onPress={handleSwitchTarget} 
                    variant="ghost" 
                    style={[styles.button, styles.secondaryButton]}
                >
                    <ThemedText style={styles.buttonText}>
                        {isViewingCurrentTarget ? `切换到 ${otherTarget.toUpperCase()} 通道` : `返回 ${currentBuildTarget.toUpperCase()} 通道`}
                    </ThemedText>
                </StyledButton>
                
                <StyledButton onPress={handleLater} variant="primary" style={styles.button}>
                  <ThemedText style={styles.buttonText}>稍后再说</ThemedText>
                </StyledButton>

                <StyledButton onPress={skipThisVersion} variant="primary" style={styles.button}>
                  <ThemedText style={styles.buttonText}>跳过此版本</ThemedText>
                </StyledButton>
              </>
            )}

            {/* 立即安装按钮 */}
            {downloadedPath && (
              <StyledButton onPress={installUpdate} variant="primary" style={styles.button}>
                <ThemedText style={styles.buttonText}>立即安装</ThemedText>
              </StyledButton>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 24,
    width: Platform.isTV ? 500 : "90%",
    maxWidth: 500,
    alignItems: "center",
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
    marginBottom: 8,
  },
  targetInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    width: '100%',
    justifyContent: 'center',
  },
  targetText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.dark.text,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  versionText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: Colors.dark.text,
    flexShrink: 1, 
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
  // <-- 新增样式以解决 TS 错误并模拟 secondary 按钮 -->
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Colors.dark.text, 
    backgroundColor: 'transparent',
  },
  // --------------------------------------------------
  smallButton: {
    width: 100,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: "600",
    color: "#fff",
  },
});
