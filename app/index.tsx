// app/index.tsx  ← 直接整個檔案覆蓋這份即可（已修好所有錯誤）
import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
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

const { width: WINDOW_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backPressTimeRef = useRef<number | null>(null);

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 響應式列數
  const getNumColumns = useCallback(() => {
    if (deviceType === "tv") return 6;
    if (deviceType === "tablet") return 4;
    if (WINDOW_WIDTH >= 500) return 3;
    return 2;
  }, [deviceType]);

  const numColumns = getNumColumns();

  // 合併的 useFocusEffect（修復記憶體洩漏 + 雙擊退出）
  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();

      if (Platform.OS === "android") {
        const handler = () => {
          const now = Date.now();
          if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
            backPressTimeRef.current = now;
            ToastAndroid.show("再按一次返回鍵退出", ToastAndroid.SHORT);
            return true;
          }
          BackHandler.exitApp();
          return true;
        };
        const sub = BackHandler.addEventListener("hardwareBackPress", handler);
        return () => {
          sub.remove();
          backPressTimeRef.current = null;
        };
      }
    }, [refreshPlayRecords])
  );

  // 主要數據加載邏輯（已修復 useEffectResponse 手滑）
  useEffect(() => {
    if (!selectedCategory) return;

    // 自動選擇第一個 tag
    if (selectedCategory.tags && !selectedCategory.tag) {
      const defaultTag = selectedCategory.tags[0];
      setSelectedTag(defaultTag);
      selectCategory({ ...selectedCategory, tag: defaultTag });
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

  // 清除 API 配置錯誤
  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) clearError();
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  // 淡入動畫
  useEffect(() => {
    if (!loading && contentData.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (loading) {
      fadeAnim.setValue(0);
    }
  }, [loading, contentData.length]);

  const handleCategorySelect = (category: Category) => {
    let final = category;
    if (category.tags?.length && !category.tag) {
      const defaultTag = category.tags[0];
      setSelectedTag(defaultTag);
      final = { ...category, tag: defaultTag };
    } else {
      setSelectedTag(category.tag || null);
    }
    selectCategory(final);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    selectedCategory && selectCategory({ ...selectedCategory, tag });
  };

  // 渲染項目
  const renderCategoryItem = ({ item }: { item: Category }) => (
    <StyledButton
      text={item.title}
      onPress={() => handleCategorySelect(item)}
      isSelected={selectedCategory?.title === item.title}
      style={styles.categoryBtn}
      textStyle={styles.categoryText}
    />
  );

  const renderTagItem = ({ item, index }: { item: string; index: number }) => (
    <StyledButton
      text={item}
      onPress={() => handleTagSelect(item)}
      isSelected={selectedTag === item}
      hasTVPreferredFocus={deviceType === "tv" && index === 0}
      style={styles.categoryBtn}
      textStyle={styles.categoryText}
      variant="ghost"
    />
  );

  const renderVideoItem = ({ item, index }: { item: RowItem; index: number }) => {
    const itemWidth = (WINDOW_WIDTH - spacing * 2 - spacing * (numColumns - 1)) / numColumns;
    return (
      <View style={{ width: itemWidth, padding: spacing / 2 }}>
        <VideoCard
          {...item}
          api={api}
          onRecordDeleted={fetchInitialData}
          hasTVPreferredFocus={deviceType === "tv" && index === 0}
        />
      </View>
    );
  };

  // 頂部導航（平板/TV）
  const renderHeader = () => {
    if (deviceType === "mobile") return null;
    return (
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={styles.headerTitle}>首頁</ThemedText>
          <Pressable style={{ marginLeft: 32 }} onPress={() => router.push("/live")}>
            <ThemedText style={[styles.headerTitle, { fontSize: 26, color: "#ccc" }]}>直播</ThemedText>
          </Pressable>
        </View>
        <View style={styles.headerRight}>
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
    );
  };

  const shouldShowApiHint = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

  const content = (
    <ThemedView style={styles.container}>
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {renderHeader()}

      {/* 分類 */}
      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.title}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 8 }}
      />

      {/* 子標籤 */}
      {selectedCategory?.tags && (
        <FlatList
          data={selectedCategory.tags}
          renderItem={renderTagItem}
          keyExtractor={(i) => i}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing, paddingVertical: 8 }}
        />
      )}

      {/* 主內容區 */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {shouldShowApiHint ? (
          <View style={commonStyles.center}>
            <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
              {getApiConfigErrorMessage(apiConfigStatus)}
            </ThemedText>
          </View>
        ) : apiConfigStatus.isValidating ? (
          <View style={commonStyles.center}>
            <ActivityIndicator size="large" />
            <ThemedText type="subtitle">正在驗證伺服器配置...</ThemedText>
          </View>
        ) : apiConfigStatus.error ? (
          <View style={commonStyles.center}>
            <ThemedText type="subtitle">{apiConfigStatus.error}</ThemedText>
          </View>
        ) : loading && contentData.length === 0 ? (
          <View style={commonStyles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : error ? (
          <View style={commonStyles.center}>
            <ThemedText type="subtitle">{error}</ThemedText>
          </View>
        ) : (
          <FlatList
            data={contentData}
            renderItem={renderVideoItem}
            keyExtractor={(item) => item.id.toString()}
            numColumns={numColumns}
            contentContainerStyle={{
              paddingHorizontal: spacing,
              paddingBottom: insets.bottom + 100,
            }}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            ListEmptyComponent={
              <View style={commonStyles.center}>
                <ThemedText type="subtitle">
                  {selectedCategory?.tags ? "請選擇一個子分類" : "該分類下暫無內容"}
                </ThemedText>
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 40 }} /> : null}
            onEndReached={loadMoreData}
            onEndReachedThreshold={0.5}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={21}
            initialNumToRender={12}
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
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 36, fontWeight: "bold", color: "white" },
  headerRight: { flexDirection: "row", gap: 20 },
  categoryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  categoryText: { fontSize: 15, fontWeight: "600" },
});
