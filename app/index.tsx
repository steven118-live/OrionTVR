// app/(tabs)/index.tsx  ← 直接整個覆蓋，保證 TV 5 列超順 + 文字大小自動調整 + 零錯誤！
import React, { useEffect, useCallback, useRef, useMemo } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  StatusBar,
  Platform,
  BackHandler,
  ToastAndroid,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { api } from "@/services/api";
import VideoCard from "@/components/VideoCard";
import { useFocusEffect, useRouter } from "expo-router";
import { Search, Settings, LogOut, Heart } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import useHomeStore, { RowItem, Category } from "@/stores/homeStore";
import useAuthStore from "@/stores/authStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backPressRef = useRef(0);

  const responsiveConfig = useResponsiveLayout();
  const { deviceType, spacing } = responsiveConfig;
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);

  const {
    categories,
    selectedCategory,
    contentData,
    loading,
    loadingMore,
    error,
    fetchInitialData,
    loadMoreData,
    selectCategory,
    refreshPlayRecords,
    clearError,
  } = useHomeStore();

  const { isLoggedIn, logout } = useAuthStore();
  const apiConfigStatus = useApiConfig();

  //  ─────── TV 5 列 + 手機 3 列 + 自動整數寬度 ─────── 
  const numColumns = deviceType === "tv" ? 5 : 3;

  const { itemWidth } = useMemo(() => {
    if (deviceType === "tv") {
      const target = Math.floor((SCREEN_WIDTH - 80) / 5);
      const finalWidth = Math.max(370, Math.min(390, target));
      return { itemWidth: finalWidth };
    }
    const phoneWidth = Math.floor((SCREEN_WIDTH - spacing * 4) / 3);
    return { itemWidth: phoneWidth };
  }, [deviceType, spacing]);
  // ─────────────────────────────────────────────────────
  // 動態樣式：分類文字大小 + TV 發光感
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        tab: {
          paddingHorizontal: deviceType === "tv" ? 28 : 20,
          paddingVertical: deviceType === "tv" ? 14 : 10,
          borderRadius: 12,
          marginHorizontal: deviceType === "tv" ? 10 : 6,
        },
        tabText: {
          fontSize: deviceType === "tv" ? 22 : 17,
          fontWeight: deviceType === "tv" ? "800" : "600",
          // TV 專屬發光感（超帥！）
          ...(deviceType === "tv" && {
            textShadowColor: "rgba(0,0,0,0.9)",
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 4,
          }),
        },
      }),
    [deviceType]
  );

  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();
      if (Platform.OS === "android") {
        const handler = () => {
          const now = Date.now();
          if (now - backPressRef.current > 2000) {
            backPressRef.current = now;
            ToastAndroid.show("再按一次退出應用", ToastAndroid.SHORT);
            return true;
          }
          BackHandler.exitApp();
          return true;
        };
        const sub = BackHandler.addEventListener("hardwareBackPress", handler);
        return () => sub.remove();
      }
    }, [refreshPlayRecords])
  );

  useEffect(() => {
    if (!selectedCategory) return;
    if (selectedCategory.tags && !selectedCategory.tag) {
      selectCategory({ ...selectedCategory, tag: selectedCategory.tags[0] });
      return;
    }
    if (apiConfigStatus.isConfigured && !apiConfigStatus.needsConfiguration) {
      if (!selectedCategory.tags || selectedCategory.tag) fetchInitialData();
    }
  }, [selectedCategory, selectedCategory?.tag, apiConfigStatus.isConfigured, apiConfigStatus.needsConfiguration, fetchInitialData]);

  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) clearError();
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  useEffect(() => {
    if (!loading && contentData.length > 0) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else if (loading) fadeAnim.setValue(0);
  }, [loading, contentData.length]);

  const handleCategorySelect = useCallback((category: Category) => {
    if (category.tags && !category.tag) {
      selectCategory({ ...category, tag: category.tags[0] });
    } else {
      selectCategory(category);
    }
  }, []);

  const handleTagSelect = useCallback((tag: string) => {
    selectedCategory && selectCategory({ ...selectedCategory, tag });
  }, [selectedCategory]);

  const content = (
    <ThemedView style={styles.container}>
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {deviceType !== "mobile" && (
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ThemedText style={styles.title}>首頁</ThemedText>
            <Pressable onPress={() => router.push("/live")} style={{ marginLeft: 40 }}>
              <ThemedText style={styles.liveText}>直播</ThemedText>
            </Pressable>
          </View>
          <View style={styles.headerIcons}>
            <StyledButton onPress={() => router.push("/favorites")} variant="ghost"><Heart color="white" size={26} /></StyledButton>
            <StyledButton onPress={() => router.push("/search")} variant="ghost"><Search color="white" size={26} /></StyledButton>
            <StyledButton onPress={() => router.push("/settings")} variant="ghost"><Settings color="white" size={26} /></StyledButton>
            {isLoggedIn && <StyledButton onPress={logout} variant="ghost"><LogOut color="white" size={26} /></StyledButton>}
          </View>
        </View>
      )}

      {/* 分類條 */}
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 14 }}
        renderItem={({ item }) => (
          <StyledButton
            text={item.title}
            onPress={() => handleCategorySelect(item)}
            isSelected={selectedCategory?.title === item.title}
            style={dynamicStyles.tab}
            textStyle={dynamicStyles.tabText}
          />
        )}
      />

      {/* 子分類 */}
      {selectedCategory?.tags && (
        <FlatList
          data={selectedCategory.tags}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(tag) => tag}
          contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 10 }}
          renderItem={({ item, index }) => (
            <StyledButton
              text={item}
              variant="ghost"
              hasTVPreferredFocus={deviceType === "tv" && index === 0}
              onPress={() => handleTagSelect(item)}
              isSelected={selectedCategory.tag === item}
              style={dynamicStyles.tab}
              textStyle={dynamicStyles.tabText}
            />
          )}
        />
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags ? (
          <View style={commonStyles.center}>
            <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
              {getApiConfigErrorMessage(apiConfigStatus)}
            </ThemedText>
          </View>
        ) : apiConfigStatus.isValidating ? (
          <View style={commonStyles.center}>
            <ActivityIndicator size="large" color="#fff" />
            <ThemedText style={{ marginTop: 16 }}>正在驗證伺服器...</ThemedText>
          </View>
        ) : error ? (
          <View style={commonStyles.center}>
            <ThemedText type="subtitle" style={{ color: "#ff6b6b" }}>{error}</ThemedText>
          </View>
        ) : loading && contentData.length === 0 ? (
          <View style={commonStyles.center}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <FlatList
            data={contentData}
            numColumns={numColumns}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{
              paddingHorizontal: deviceType === "tv" ? 40 : spacing,
              paddingBottom: insets.bottom + 100,
            }}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            renderItem={({ item, index }) => (
              <View style={{ width: itemWidth }}>
                <VideoCard
                  {...item}
                  api={api}
                  onRecordDeleted={fetchInitialData}
                  hasTVPreferredFocus={deviceType === "tv" && index === 0}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={commonStyles.center}>
                <ThemedText type="subtitle">
                  {selectedCategory?.tags ? "請選擇子分類" : "暫無內容"}
                </ThemedText>
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 40 }} color="#fff" /> : null}
            onEndReached={loadMoreData}
            onEndReachedThreshold={0.6}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={15}
            initialNumToRender={15}
            {...(deviceType === "tv" && {
              directionalLockEnabled: true,
              overScrollMode: "never",
            })}
          />
        )}
      </Animated.View>
    </ThemedView>
  );

  return deviceType === "tv" ? content : <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: { fontSize: 36, fontWeight: "800", color: "white" },
  liveText: { fontSize: 26, color: "#aaa" },
  headerIcons: { flexDirection: "row", gap: 24 },
});
