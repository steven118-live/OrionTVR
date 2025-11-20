import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import LoginModal from "@/components/LoginModal";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore, initUpdateStore } from "@/stores/updateStore";
import { UpdateModal } from "@/components/UpdateModal";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useHomeStore from "@/stores/homeStore";
import { useApiConfig } from "@/hooks/useApiConfig";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("RootLayout");

// 防止 SplashScreen 提前隐藏
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const { loadSettings, remoteInputEnabled, apiBaseUrl } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  const responsiveConfig = useResponsiveLayout();
  const _home: any = useHomeStore();
  const refreshPlayRecords = _home.refreshPlayRecords as any;
  const initEpisodeSelection = _home.initEpisodeSelection as any;

  const apiStatus = useApiConfig();
  const hasInitialized = useRef(false);

  // 初始化设置 & 更新存储
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
    };
    initializeApp();
    initUpdateStore();
  }, [loadSettings]);

  // 检查登录状态
  useEffect(() => {
    if (apiBaseUrl) {
      checkLoginStatus(apiBaseUrl);
    }
  }, [apiBaseUrl, checkLoginStatus]);

  // 字体加载完成后隐藏 Splash
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      if (error) {
        logger.warn(`Error in loading fonts: ${error}`);
      }
    }
  }, [loaded, error]);

  // API 验证成功后刷新播放记录 & 初始化选集 & 检查更新
  useEffect(() => {
    if (!apiStatus.isValid || (!loaded && !error) || hasInitialized.current) return;
    hasInitialized.current = true;

    // 启动时立即检查一次更新
    if (UPDATE_CONFIG.AUTO_CHECK && Platform.OS === "android") {
      const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
      if (shouldCheck) {
        checkForUpdate(true);
      }
    }

    // 定时检查更新
    let updateInterval: NodeJS.Timeout | null = null;
    if (UPDATE_CONFIG.AUTO_CHECK && Platform.OS === "android") {
      updateInterval = setInterval(() => {
        checkForUpdate(true);
      }, UPDATE_CONFIG.CHECK_INTERVAL);
    }

    // 刷新播放记录（延迟 2 秒，避免和初始化冲突）
    const playbackTimer = setTimeout(async () => {
      try {
        await refreshPlayRecords();
      } catch (err) {
        logger.warn("播放记录刷新失败", err);
        (useHomeStore.getState() as any).setPlayRecords?.([]);
      } finally {
        initEpisodeSelection();
      }
    }, 2000);

    return () => {
      clearTimeout(playbackTimer);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [
    apiStatus.isValid,
    refreshPlayRecords,
    initEpisodeSelection,
    loaded,
    error,
    lastCheckTime,
    checkForUpdate,
  ]);

  // 远程控制服务器启停
  useEffect(() => {
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
  }, [remoteInputEnabled, startServer, stopServer, responsiveConfig.deviceType]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View style={styles.container}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="detail" options={{ headerShown: false }} />
            {Platform.OS !== "web" && <Stack.Screen name="play" options={{ headerShown: false }} />}
            <Stack.Screen name="search" options={{ headerShown: false }} />
            <Stack.Screen name="live" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="favorites" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
        <Toast />
        <LoginModal />
        <UpdateModal />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
