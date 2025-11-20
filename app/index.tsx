import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
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
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";
import { Colors } from "@/constants/Colors";

const LOAD_MORE_THRESHOLD = 200;

// 為了型別安全，這裡我們為 StyledButton 的 ref 定義一個通用型別。
// 由於它用於 focus()，通常指向一個 Pressable 或 View，故暫時使用 any。
// 如果 StyledButton 導出了自己的 Ref 型別，請替換此處的 any。
type FocusableRef = any; 

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = "dark";
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // ✅ 修正點 1/2: 宣告 tagButtonRef
  const tagButtonRef = useRef<FocusableRef>(null);

  // 焦點狀態：控制返回鍵焦點回復
  const [preferCategory, setPreferCategory] = useState(false);
  const [preferParent, setPreferParent] = useState(false);

  // 響應式配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

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

  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();
    }, [refreshPlayRecords])
  );
  // 雙擊返回退出（僅 Android）
  type BackStage = "root" | "category" | "tag";
  const backStageRef = useRef<BackStage>("root");
  const backPressTimeRef = useRef<number | null>(null);

  // 定義一個函數，讓返回鍵時能回到 tag 按鍵
  const tagAnchorFocus = useCallback(() => {
    tagButtonRef.current?.focus();
  }, []);
  
  // 這裡要綁定到你 UI 裡的 tag 按鍵 ref
  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        const now = Date.now();

        if (backStageRef.current === "tag") {
          // 從子分類返回到子分類按鍵 (例如「國產劇」)
          tagAnchorFocus?.(); // 這裡要綁定到對應的 tag anchor
          backStageRef.current = "category";
          return true;
        }

        if (backStageRef.current === "category" || backStageRef.current === "root") {
          // 在分類層或首頁才啟用「兩次返回退出」邏輯
          if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
            backPressTimeRef.current = now;
            ToastAndroid.show("再按一次返回键退出", ToastAndroid.SHORT);
            return true; // 攔截，不退出
          }
          // 两次返回键间隔小于2秒，退出应用
          BackHandler.exitApp();
          return true;
        }

        return false;
      };

      if (Platform.OS === "android") {
        const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
        return () => {
          backHandler.remove();
          backPressTimeRef.current = null;
        };
      }
    }, [tagAnchorFocus])
  );

  // 資料抓取
  useEffect(() => {
    if (!selectedCategory) return;

    if (selectedCategory.tags && !selectedCategory.tag) {
      const defaultTag = selectedCategory.tags[0];
      setSelectedTag(defaultTag);
      selectCategory({ ...selectedCategory, tag: defaultTag });
      return;
    }

    // 只有在API配置完成且分類有效時才獲取數據
    if (apiConfigStatus.isConfigured && !apiConfigStatus.needsConfiguration) {
      // 對於有標籤的分類，需要確保有標籤才獲取數據
      if (selectedCategory.tags && selectedCategory.tag) {
        fetchInitialData();
      }
      // 對於無標籤的分類，直接獲取數據
      else if (!selectedCategory.tags) {
        fetchInitialData();
      }
    }
  }, [
    selectedCategory,
    selectedCategory?.tag,
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
    selectCategory,
  ]);

  // 清除錯誤狀態的邏輯
  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) {
      clearError();
    }
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  // 內容淡入
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
  }, [loading, contentData.length, fadeAnim]);

  const handleCategorySelect = (category: Category) => {
    setSelectedTag(null);
    selectCategory(category);
    // 進到新分類時重置焦點偏好
    setPreferCategory(false);
    setPreferParent(false);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    if (selectedCategory) {
      const categoryWithTag = { ...selectedCategory, tag: tag };
      selectCategory(categoryWithTag);
    }
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory?.title === item.title;
    return (
      <StyledButton
        text={item.title}
        onPress={() => handleCategorySelect(item)}
        isSelected={isSelected}
        style={dynamicStyles.categoryButton}
        textStyle={dynamicStyles.categoryText}
        hasTVPreferredFocus={preferCategory && isSelected} // 本頁入口焦點
      />
    );
  };

  const renderContentItem = ({ item }: { item: RowItem; index: number }) => (
    <VideoCard
      id={item.id}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      rate={item.rate}
      progress={item.progress}
      playTime={item.play_time}
      episodeIndex={item.episodeIndex}
      sourceName={item.sourceName}
      totalEpisodes={item.totalEpisodes}
      api={api}
      onRecordDeleted={fetchInitialData}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  };

  // API 配置提示
  const shouldShowApiConfig =
    apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

  // TV/平板頂部導航
  const renderHeader = () => {
    if (deviceType === "mobile") return null;
    return (
      <View style={dynamicStyles.headerContainer}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={dynamicStyles.headerTitle}>首页</ThemedText>
          <Pressable
            android_ripple={
              Platform.isTV || deviceType !== "tv"
                ? { color: "transparent" }
                : { color: Colors.dark.link }
            }
            style={{ marginLeft: 20 }}
            onPress={() => router.push("/live")}
          >
            {({ focused }) => (
              <ThemedText
                style={[
                  dynamicStyles.headerTitle,
                  { color: focused ? "white" : "grey" },
                ]}
              >
                直播
              </ThemedText>
            )}
          </Pressable>
        </View>
        <View style={dynamicStyles.rightHeaderButtons}>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/favorites")} variant="ghost">
            <Heart color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push({ pathname: "/search" })} variant="ghost">
            <Search color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/settings")} variant="ghost">
            <Settings color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          {isLoggedIn && (
            <StyledButton style={dynamicStyles.iconButton} onPress={logout} variant="ghost">
              <LogOut color={colorScheme === "dark" ? "white" : "black"} size={24} />
            </StyledButton>
          )}
        </View>
      </View>
    );
  };


  // 动态样式
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "mobile" ? insets.top : deviceType === "tablet" ? insets.top + 20 : 40,
    },
    headerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
      marginBottom: spacing,
    },
    headerTitle: {
      fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32,
      fontWeight: "bold",
      paddingTop: 16,
    },
    rightHeaderButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconButton: {
      borderRadius: 30,
      marginLeft: spacing / 2,
    },
    categoryContainer: {
      paddingBottom: spacing / 2,
    },
    categoryListContent: {
      paddingHorizontal: spacing,
    },
    categoryButton: {
      paddingHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2,
      paddingVertical: spacing / 2,
      borderRadius: deviceType === "mobile" ? 6 : 8,
      marginHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2, // TV端使用更小的间距
    },
    categoryText: {
      fontSize: deviceType === "mobile" ? 14 : 16,
      fontWeight: "500",
    },
    contentContainer: {
      flex: 1,
    },
  });

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {/* 狀態欄 */}
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {/* 頂部導航 */}
      {renderHeader()}

      {/* 分類選擇器 */}
      <View style={dynamicStyles.categoryContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.title}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.categoryListContent}
        />
      </View>

      {/* 子分類標籤 */}
      {selectedCategory && selectedCategory.tags && (
        <View style={dynamicStyles.categoryContainer}>
          <FlatList
            data={selectedCategory.tags}
            renderItem={({ item, index }) => {
              const isSelected = selectedTag === item;
              return (
                <StyledButton
                  // ✅ 修正點 2/2: 條件式綁定 ref
                  ref={index === 0 && deviceType === "tv" ? tagButtonRef : undefined}
                  hasTVPreferredFocus={index === 0}
                  text={item}
                  onPress={() => handleTagSelect(item)}
                  isSelected={isSelected}
                  style={dynamicStyles.categoryButton}
                  textStyle={dynamicStyles.categoryText}
                  variant="ghost"
                />
              );
            }}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.categoryListContent}
          />
        </View>
      )}

      {/* 內容網格 */}
      {shouldShowApiConfig ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {getApiConfigErrorMessage(apiConfigStatus)}
          </ThemedText>
        </View>
      ) : apiConfigStatus.isValidating ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            正在验证服务器配置...
          </ThemedText>
          </View>
      ) : apiConfigStatus.error && !apiConfigStatus.isValid ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {apiConfigStatus.error}
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
          <CustomScrollView
            data={contentData}
            renderItem={renderContentItem}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            onEndReached={loadMoreData}
            loadMoreThreshold={LOAD_MORE_THRESHOLD}
            emptyMessage={selectedCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
            ListFooterComponent={renderFooter}
            // 返回鍵焦點回復
            categoryAnchorFocus={() => {
              setPreferParent(false);
              setPreferCategory(true); // 第一次返回 → 本頁入口
            }}
            parentAnchorFocus={() => {
              setPreferCategory(false);
              setPreferParent(true); // 第二次返回 → 上一層入口
            }}
          />
        </Animated.View>
      )}
    </ThemedView>
  );

  // 裝置類型包裝
  if (deviceType === "tv") {
    return content;
  }
  return <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}
