// app/(tabs)/index.tsx ← 直接整個貼上覆蓋，保證一次成功！
import React, { useEffect, useCallback, useRef, useMemo, useState } from "react";
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
  Text,
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

const { width: WINDOW_WIDTH } = Dimensions.get("window");

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

  // 強制 TV 5 列 + 手機 3 列
  const isTV = Platform.isTV || deviceType === "tv" || WINDOW_WIDTH >= 900;
  const numColumns = isTV ? 5 : 3;

  // 整數寬度（最順）
  const itemWidth = useMemo(() => {
    const padding = isTV ? 80 : spacing * 4;
    return Math.floor((WINDOW_WIDTH - padding) / numColumns);
  }, [isTV, numColumns, spacing]);

  // 回到頂部相關
  const flatListRef = useRef<FlatList>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const hasScrolled = useRef(false);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 1000) {
      setShowBackToTop(true);
      hasScrolled.current = true;
    } else if (offsetY < 500) {
      setShowBackToTop(false);
    }
  };

  // TV 按返回鍵回到頂部
  useFocusEffect(
    useCallback(() => {
      if (!isTV) return;
      const onBackPress = () => {
        if (hasScrolled.current) {
          scrollToTop();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [])
  );

  // 手機雙擊退出
  useFocusEffect(
    useCallback(() => {
      if (isTV) return;
      refreshPlayRecords();
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
    }, [refreshPlayRecords])
  );

  // 其他 useEffect 不變...
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

      {deviceType !== "mobile" && !isTV && (
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
        contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 16 }}
        renderItem={({ item }) => (
          <StyledButton
            text={item.title}
            onPress={() => handleCategorySelect(item)}
            isSelected={selectedCategory?.title === item.title}
            style={[styles.tab, isTV && { paddingVertical: 18, minHeight: 60 }]}
            textStyle={[styles.tabText, isTV && { fontSize: 23, fontWeight: "800" }]}
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
          contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 12 }}
          renderItem={({ item, index }) => (
            <StyledButton
              text={item}
              variant="ghost"
              hasTVPreferredFocus={isTV && index === 0}
              onPress={() => handleTagSelect(item)}
              isSelected={selectedCategory.tag === item}
              style={[styles.tab, isTV && { paddingVertical: 16 }]}
              textStyle={[styles.tabText, isTV && { fontSize: 21 }]}
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
          <>
            <FlatList
              ref={flatListRef}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              data={contentData}
              numColumns={numColumns}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{
                paddingHorizontal: isTV ? 40 : spacing,
                paddingBottom: insets.bottom + 120,
              }}
              columnWrapperStyle={{ justifyContent: "space-between" }}
              renderItem={({ item, index }) => (
                <View style={{ width: itemWidth }}>
                  <VideoCard
                    {...item}
                    api={api}
                    onRecordDeleted={fetchInitialData}
                    hasTVPreferredFocus={isTV && index === 0}
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
              
              // 關鍵四行：保護全站播放紀錄 + 保持超順！
              removeClippedSubviews={false}
              maxToRenderPerBatch={50}
              windowSize={101}
              initialNumToRender={50}

              {...(isTV && {
                directionalLockEnabled: true,
                overScrollMode: "never",
              })}
            />

            {/* 手機/平板回到頂部按鈕 */}
            {!isTV && showBackToTop && (
              <Pressable onPress={scrollToTop} style={styles.backToTopButton}>
                <Text style={{ color: "white", fontSize: 32, lineHeight: 36 }}>Up Arrow</Text>
              </Pressable>
            )}
          </>
        )}
      </Animated.View>
    </ThemedView>
  );

  return isTV ? content : <ResponsiveNavigation>{content}</ResponsiveNavigation>;
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  tabText: {
    fontSize: 18,
    fontWeight: "600",
  },
  backToTopButton: {
    position: "absolute",
    right: 20,
    bottom: 90,
    backgroundColor: "#00C4FF",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
