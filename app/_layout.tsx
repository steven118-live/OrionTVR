import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
// 引入 shallow 進行性能優化
import { shallow } from "zustand/shallow";

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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // ✅ 使用直接解構 (此版本在您的環境中無錯誤)
  const { loadSettings, remoteInputEnabled, apiBaseUrl } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  
  // ✅ 修正: 直接從 useHomeStore 解構，避免使用臨時變數和 as any
  const { refreshPlayRecords, initEpisodeSelection } = useHomeStore(); 

  const responsiveConfig = useResponsiveLayout();
  const apiStatus = useApiConfig();
  const hasInitialized = useRef(false); // 初始化鎖

  // 初始化設定
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
    };
    initializeApp();
    initUpdateStore(); // 初始化更新存储
  }, [loadSettings]);

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
    if (!apiStatus.isValid || (!loaded && !error) || hasInitialized.current) return;
    hasInitialized.current = true;

    const updateTimer = setTimeout(() => {
      if (loaded && UPDATE_CONFIG.AUTO_CHECK && Platform.OS === "android") {
        const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
        if (shouldCheck) {
          checkForUpdate(true);
        }
      }

      const playbackTimer = setTimeout(async () => {
        try {
          await refreshPlayRecords();
        } catch (err) {
          logger.warn("播放紀錄刷新失敗", err);
          // ⚠️ 保持 as any，因為我們知道 HomeState 類型不完整
          (useHomeStore.getState() as any).setPlayRecords?.([]);
        } finally {
          initEpisodeSelection(); // 使用解構出來的函式
        }
      }, 2000);

      return () => clearTimeout(playbackTimer);
    }, 1000);

    return () => clearTimeout(updateTimer);
    // 依賴項包含解構出來的動作，這是此版本能通過編譯的原因
  }, [apiStatus.isValid, refreshPlayRecords, initEpisodeSelection, loaded, error, lastCheckTime, checkForUpdate]);

  // 遠端控制伺服器啟停
  useEffect(() => {
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
    // 依賴項包含解構出來的動作
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
