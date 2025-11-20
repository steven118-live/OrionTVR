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
    remoteVersion,
    availableVersions,   // 可选版本清单
    baselineVersion,     // baseline 版本
    downloading,
    downloadProgress,
    error,
    setShowUpdateModal,
    handleDownload,      // 下载函数
    installUpdate,
    skipThisVersion,
    downloadedPath,
  } = useUpdateStore();

  const updateButtonRef = React.useRef<View>(null);

  function handleLater() {
    setShowUpdateModal(false);
  }

  React.useEffect(() => {
    if (showUpdateModal && Platform.isTV) {
      setTimeout(() => {
        updateButtonRef.current?.focus();
      }, 100);
    }
  }, [showUpdateModal]);

  return (
    <Modal visible={showUpdateModal} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ThemedText style={styles.title}>发现新版本</ThemedText>

          <View style={styles.versionInfo}>
            <ThemedText style={styles.versionText}>当前版本: v{currentVersion}</ThemedText>
          </View>

          {/* 渲染可选版本清单 */}
          {availableVersions?.map((ver, idx) => {
            const isBaseline = ver.includes(baselineVersion);
            return (
              <View key={idx} style={styles.versionRow}>
                <ThemedText style={styles.versionText}>
                  {ver} {isBaseline ? "（切换前必须安装）" : ""}
                </ThemedText>
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
                <StyledButton onPress={handleLater} variant="primary" style={styles.button}>
                  <ThemedText style={styles.buttonText}>稍后再说</ThemedText>
                </StyledButton>

                <StyledButton onPress={skipThisVersion} variant="primary" style={styles.button}>
                  <ThemedText style={styles.buttonText}>跳过此版本</ThemedText>
                </StyledButton>
              </>
            )}

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
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  versionText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.dark.text,
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
