import React from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { useUpdateStore } from "@/stores/updateStore";

export function UpdateSection() {
  const {
    currentVersion,
    upstreamVersion,
    availableVersions,   // 可选版本清单
    baselineVersion,     // baseline 版本
    updateAvailable,
    downloading,
    downloadProgress,
    checkForUpdate,
    isLatestVersion,
    error,
    handleDownload,      // 下载函数
    skipThisVersion,     // 跳过此版本
    remoteVersion,
  } = useUpdateStore();

  const [checking, setChecking] = React.useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      await checkForUpdate(false);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.sectionContainer}>
      <ThemedText style={styles.sectionTitle}>应用更新</ThemedText>

      <View style={styles.row}>
        <ThemedText style={styles.label}>原始码最新版本</ThemedText>
        <ThemedText style={styles.value}>v{upstreamVersion || "x.x.xx"}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>当前版本</ThemedText>
        <ThemedText style={styles.value}>v{currentVersion}</ThemedText>
      </View>

      {updateAvailable && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>可选版本</ThemedText>
        </View>
      )}

      {/* 渲染可选版本清单 */}
      {availableVersions?.map((ver, idx) => {
        const isBaseline = ver.includes(baselineVersion);
        return (
          <View key={idx} style={styles.row}>
            <ThemedText style={styles.label}>
              {ver} {isBaseline ? "（切换前必须安装）" : ""}
            </ThemedText>
            <StyledButton
              onPress={() => handleDownload(ver)}
              disabled={downloading}
              style={styles.smallButton}
            >
              <ThemedText style={styles.buttonText}>下载</ThemedText>
            </StyledButton>
          </View>
        );
      })}

      {isLatestVersion && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>状态</ThemedText>
          <ThemedText style={[styles.value, styles.latestVersion]}>已是最新版本</ThemedText>
        </View>
      )}

      {error && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>检查结果</ThemedText>
          <ThemedText style={[styles.value, styles.errorText]}>{error}</ThemedText>
        </View>
      )}

      {downloading && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>下载进度</ThemedText>
          <ThemedText style={styles.value}>{downloadProgress}%</ThemedText>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <StyledButton
          onPress={handleCheckUpdate}
          disabled={checking || downloading}
          style={styles.button}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.buttonText}>检查更新</ThemedText>
          )}
        </StyledButton>

        {/* 跳过此版本按钮 */}
        <StyledButton
          onPress={() => skipThisVersion()}
          disabled={!remoteVersion}
          style={styles.button}
        >
          <ThemedText style={styles.buttonText}>跳过此版本</ThemedText>
        </StyledButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: "40%",
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  smallButton: {
    width: 80,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Platform.isTV ? 16 : 14,
    fontWeight: "500",
  },
});
