import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  FlatList,
  ViewStyle,
  Platform,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";

// 導航堆疊：用來記錄分類層級
const navigationStack: string[] = [];

interface CustomScrollViewProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactNode;
  numColumns?: number;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number; // 控制返回頂部按鈕出現的滾動距離閾值，不影響效能
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  categoryKey?: string; // ✅ 當前分類的識別字串
}

const CustomScrollView: React.FC<CustomScrollViewProps> = ({
  data,
  renderItem,
  numColumns,
  loading = false,
  loadingMore = false,
  error = null,
  onEndReached,
  loadMoreThreshold = 200,
  emptyMessage = "暂无内容",
  ListFooterComponent,
  categoryKey,
}) => {
  const flatListRef = useRef<FlatList<any>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns } = responsiveConfig;

  const listSpacing = deviceType === "tv" ? 0 : spacing;
  const listColumns = numColumns || (deviceType === "tv" ? 5 : columns);

  // ✅ 每次進入一個分類，把 categoryKey 推入堆疊
  useEffect(() => {
    if (categoryKey) {
      navigationStack.push(categoryKey);
    }
    return () => {
      if (categoryKey) {
        const idx = navigationStack.lastIndexOf(categoryKey);
        if (idx !== -1) navigationStack.splice(idx, 1);
      }
    };
  }, [categoryKey]);

  // ✅ 返回鍵邏輯：僅在 Android TV 啟用
  useEffect(() => {
    if (deviceType === "tv" && Platform.OS === "android") {
      const handler = () => {
        if (navigationStack.length > 0) {
          const last = navigationStack.pop();
          scrollToTop();
          console.log("Back to category:", last);
          return true; // 攔截返回鍵
        }
        return false; // 沒有堆疊，交給系統
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", handler);
      return () => sub.remove();
    }
  }, []);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderFooter = () => {
    if (ListFooterComponent) {
      if (React.isValidElement(ListFooterComponent)) {
        return ListFooterComponent;
      } else if (typeof ListFooterComponent === "function") {
        const Component = ListFooterComponent as React.ComponentType<any>;
        return <Component />;
      }
      return null;
    }
    if (loadingMore) {
      return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
    }
    return null;
  };

  if (loading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={commonStyles.center}>
        <ThemedText type="subtitle" style={{ padding: responsiveConfig.spacing }}>
          {error}
        </ThemedText>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={commonStyles.center}>
        <ThemedText>{emptyMessage}</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item, index) => item.id ?? index.toString()}
        renderItem={({ item, index }) => (
          <View
            style={{
              width: `${100 / listColumns}%`,
              alignSelf: "stretch",
              marginBottom: spacing,
            }}
          >
            {renderItem({ item, index })}
          </View>
        )}
        numColumns={listColumns}
        contentContainerStyle={{ paddingHorizontal: listSpacing }}
        columnWrapperStyle={{
          columnGap: deviceType === "tv" ? 0 : listSpacing,
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter()}
        showsVerticalScrollIndicator={deviceType !== "tv"}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          setShowScrollToTop(offsetY > loadMoreThreshold);
        }}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
      {deviceType !== "tv" && (
        <TouchableOpacity
          style={getScrollToTopButtonStyle(spacing, showScrollToTop)}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <ThemedText>⬆️</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const getScrollToTopButtonStyle = (spacing: number, visible: boolean): ViewStyle => ({
  position: "absolute",
  right: spacing,
  bottom: spacing * 2,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  padding: spacing,
  borderRadius: spacing,
  opacity: visible ? 1 : 0,
});

export default CustomScrollView;
