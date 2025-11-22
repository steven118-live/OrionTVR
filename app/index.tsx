// app/(tabs)/index.tsx   ← 直接整個檔案貼上覆蓋即可
import React, { useEffect, useCallback, useRef } from "react";
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

  // ────────────────── 關鍵改動：5列 TV + 3列手機（整數寬度） ──────────────────
  const numColumns = deviceType === "tv" ? 5 : 3;
  const itemWidth = deviceType === "tv" ? 384 : 226;        // 整數！保證不卡
  const horizontalGap = deviceType === "tv" ? 24 : 16;      // 呼吸感剛好
  // ─────────────────────────────────────────────────────────────────────

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
      if (!selectedCategory.tags || selectedCategory.tag) {
        fetchInitialData();
      }
    }
  }, [
    selectedCategory,
    selectedCategory?.tag,
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
  ]);

  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) clearError();
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  useEffect(() => {
    if (!loading && contentData.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else if (loading) {
      fadeAnim.setValue(0);
    }
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

      {/* 頂部導航（平板/TV） */}
      {deviceType !== "mobile" && (
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ThemedText style={styles.title}>首頁</ThemedText>
            <Pressable onPress={() => router.push("/live")} style={{ marginLeft: 40 }}>
              <ThemedText style={styles.liveText}>直播</ThemedText>
            </Pressable>
          </View>
          <View style={styles.headerIcons}>
            <StyledButton onPress={() => router.push("/favorites")} variant="ghost">
              <Heart color="white" size={26} />
            </StyledButton>
            <StyledButton onPress={() => router.push("/search")} variant="ghost">
              <Search color="white" size={26} />
            </StyledButton>
            <StyledButton onPress={() => router.push("/settings")} variant="ghost">
              <Settings color="white" size={26} />
            </StyledButton>
            {isLoggedIn && (
              <StyledButton onPress={logout} variant="ghost">
                <LogOut color="white" size={26} />
              </StyledButton>
            )}
          </View>
        </View>
      )}

      {/* 分類 */}
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 12 }}
        renderItem={({ item }) => (
          <StyledButton
            text={item.title}
            onPress={() => handleCategorySelect(item)}
            isSelected={selectedCategory?.title === item.title}
            style={styles.tab}
            textStyle={styles.tabText}
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
          contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 8 }}
          renderItem={({ item, index }) => (
            <StyledButton
              text={item}
              variant="ghost"
              hasTVPreferredFocus={deviceType === "tv" && index === 0}
              onPress={() => handleTagSelect(item)}
              isSelected={selectedCategory.tag === item}
              style={styles.tab}
              textStyle={styles.tabText}
            />
          )}
        />
      )}

      {/* 主內容區 */}
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
            <ThemedText type="subtitle" style={{ color: "#ff6b6b" }}>
              {error}
            </ThemedText>
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
              paddingHorizontal: spacing,
              paddingBottom: insets.bottom + 100,
            }}
            columnWrapperStyle={{
              justifyContent: "center",
              gap: horizontalGap,
            }}
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
            ListFooterComponent={
              loadingMore ? <ActivityIndicator style={{ marginVertical: 40 }} color="#fff" /> : null
            }
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
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  tabText: { fontSize: 15, fontWeight: "600" },
});
