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
import { useUpdateStore } from "@/stores/updateStore";

import { UpdateModal } from "@/components/UpdateModal";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useHomeStore from "@/stores/homeStore";
import { useApiConfig } from "@/hooks/useApiConfig";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("RootLayout");

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const { loadSettings, remoteInputEnabled, apiBaseUrl } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime, initialize } = useUpdateStore(); // 确保引入 initialize
  const responsiveConfig = useResponsiveLayout();
  
  // 保持 useHomeStore 的类型转换不变
  const _home: any = useHomeStore();
  const refreshPlayRecords = _home.refreshPlayRecords as any;
  const initEpisodeSelection = _home.initEpisodeSelection as any;

  const apiStatus = useApiConfig();

  const hasInitialized = useRef(false); // 初始化鎖

  // 初始化設定 and UpdateStore
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
      // 在此调用 initialize，确保 UpdateStore 的初始版本信息被设置
      initialize(); 
    };
    initializeApp();
  }, [loadSettings, initialize]); // 添加 initialize 依赖项

  // 檢查登入狀態
  useEffect(() => {
    if (apiBaseUrl) {
      checkLoginStatus(apiBaseUrl);
    }
  }, [apiBaseUrl, checkLoginStatus]);

  // 字型載入完成後隱藏 Splash
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      if (error) {
        logger.warn(`Error in loading fonts: ${error}`);
      }
    }
  }, [loaded, error]);

  // API 驗證成功後才刷新最近播放 & 初始化選集 & 檢查更新
  useEffect(() => {
    // 确保字体和API状态已准备好，且只运行一次
    if (!apiStatus.isValid || (!loaded && !error) || hasInitialized.current) return;
    hasInitialized.current = true;

    const updateTimer = setTimeout(() => {
      // 检查更新逻辑
      if (loaded && UPDATE_CONFIG.AUTO_CHECK && Platform.OS === "android") {
        const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
        if (shouldCheck) {
          // 修正点: 移除参数 (true)
          checkForUpdate(); 
        }
      }

      const playbackTimer = setTimeout(async () => {
        try {
          await refreshPlayRecords();
        } catch (err) {
          logger.warn("播放紀錄刷新失敗", err);
          (useHomeStore.getState() as any).setPlayRecords?.([]); // optional call
        } finally {
          initEpisodeSelection(); // 確保初始化選集，不受錯誤影響
        }
      }, 2000);

      return () => clearTimeout(playbackTimer);
    }, 1000);

    return () => clearTimeout(updateTimer);
  }, [apiStatus.isValid, refreshPlayRecords, initEpisodeSelection, loaded, error, lastCheckTime, checkForUpdate,]);

  // 遠端控制伺服器啟停
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
