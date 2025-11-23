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

  const isTV = Platform.isTV || deviceType === "tv" || WINDOW_WIDTH >= 900;
  const numColumns = isTV ? 6 : 3;   // ← 6 列！

  // 6 列完美 gap 計算
  const { itemWidth, gap } = useMemo(() => {
    if (isTV) {
      const totalGap = 5 * 20; // ← 這裡改數字就可調整卡片大小（20=平衡，12=更大，28=更小）
      const available = WINDOW_WIDTH - 80 - totalGap;
      const width = Math.floor(available / 6);
      return { itemWidth: width, gap: 20 };
    } else {
      const phoneWidth = Math.floor((WINDOW_WIDTH - spacing * 4) / 3);
      const phoneGap = Math.floor((WINDOW_WIDTH - phoneWidth * 3) / 2);
      return { itemWidth: phoneWidth, gap: phoneGap > 12 ? phoneGap : 16 };
    }
  }, [isTV, spacing]);

  // 回到頂部相關
  const flatListRef = useRef<FlatList>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const hasScrolled = useRef(false);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 1200) {
      setShowBackToTop(true);
      hasScrolled.current = true;
    } else if (offsetY < 400) {
      setShowBackToTop(false);
    }
  };

  // TV 返回鍵回到頂部
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

  // 必要的兩個函數（之前漏掉的）
  const handleCategorySelect = useCallback((category: Category) => {
    if (category.tags && !category.tag) {
      selectCategory({ ...category, tag: category.tags[0] });
    } else {
      selectCategory(category);
    }
  }, [selectCategory]);

  const handleTagSelect = useCallback((tag: string) => {
    if (selectedCategory) {
      selectCategory({ ...selectedCategory, tag });
    }
  }, [selectedCategory, selectCategory]);

  // 其他 useEffect（資料載入）
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

  const content = (
    <ThemedView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ height: insets.top + (isTV ? 40 : 10) }} />

      {/* 分類條 */}
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: isTV ? 28 : 18 }}
        renderItem={({ item }) => (
          <StyledButton
            text={item.title}
            onPress={() => handleCategorySelect(item)}
            isSelected={selectedCategory?.title === item.title}
            style={[styles.tab, isTV && styles.tabTV]}
            textStyle={[styles.tabText, isTV && styles.tabTextTV]}
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
          contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: isTV ? 22 : 14 }}
          renderItem={({ item, index }) => (
            <StyledButton
              text={item}
              variant="ghost"
              hasTVPreferredFocus={isTV && index === 0}
              onPress={() => handleTagSelect(item)}
              isSelected={selectedCategory.tag === item}
              style={[styles.tab, isTV && styles.subTabTV]}
              textStyle={[styles.tabText, isTV && styles.subTabTextTV]}
            />
          )}
        />
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags ? (
          <View style={commonStyles.center}><ThemedText type="subtitle">{getApiConfigErrorMessage(apiConfigStatus)}</ThemedText></View>
        ) : apiConfigStatus.isValidating ? (
          <View style={commonStyles.center}><ActivityIndicator size="large" color="#fff" /><ThemedText>正在驗證伺服器...</ThemedText></View>
        ) : error ? (
          <View style={commonStyles.center}><ThemedText type="subtitle" style={{ color: "#ff6b6b" }}>{error}</ThemedText></View>
        ) : loading && contentData.length === 0 ? (
          <View style={commonStyles.center}><ActivityIndicator size="large" color="#fff" /></View>
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
                paddingTop: 10,
                paddingBottom: insets.bottom + 140,
              }}
              columnWrapperStyle={{
                justifyContent: "space-between",
                paddingHorizontal: isTV ? gap / 2 : 0,
              }}
              renderItem={({ item, index }) => (
                <View style={{ width: itemWidth, marginHorizontal: isTV ? gap / 2 : 0 }}>
                  <VideoCard
                    {...item}
                    api={api}
                    onRecordDeleted={fetchInitialData}
                    hasTVPreferredFocus={isTV && index === 0}
                  />
                </View>
              )}
              ListEmptyComponent={<View style={commonStyles.center}><ThemedText type="subtitle">暫無內容</ThemedText></View>}
              ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 40 }} color="#fff" /> : null}
              onEndReached={loadMoreData}
              onEndReachedThreshold={0.6}

              // 6 列最順參數
              removeClippedSubviews={true}
              maxToRenderPerBatch={18}
              windowSize={21}
              initialNumToRender={24}
              getItemLayout={(data, index) => ({
                length: itemWidth * (9 / 16) + 90,
                offset: (itemWidth * (9 / 16) + 90) * index,
                index,
              })}

              {...(isTV && { directionalLockEnabled: true, overScrollMode: "never" })}
            />

            {/* 手機回到頂部 */}
            {!isTV && showBackToTop && (
              <Pressable onPress={scrollToTop} style={styles.backToTop}>
                <Text style={{ color: "white", fontSize: 34 }}>Up Arrow</Text>
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
  container: { flex: 1, backgroundColor: "#000" },
  tab: { paddingHorizontal: 26, paddingVertical: 16, borderRadius: 14, marginHorizontal: 9, minHeight: 56 },
  tabTV: { paddingVertical: 28, paddingHorizontal: 40, minHeight: 84 },
  tabText: { fontSize: 18, fontWeight: "600", lineHeight: 26 },
  tabTextTV: { fontSize: 28, fontWeight: "800", lineHeight: 38 },
  subTabTV: { paddingVertical: 24, minHeight: 74 },
  subTabTextTV: { fontSize: 25, fontWeight: "700" },
  backToTop: {
    position: "absolute",
    right: 20,
    bottom: 100,
    backgroundColor: "#00C4FF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 12,
  },
});
