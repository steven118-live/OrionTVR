import React, { useRef, useState, useEffect } from "react";
import {
  View,
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

interface CustomScrollViewProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactNode;
  numColumns?: number;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number;
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  categoryKey?: string;
  // ✅ 新增：由頁面傳入焦點回復方法
  categoryAnchorFocus?: () => void; // 本頁入口
  parentAnchorFocus?: () => void;   // 上一層入口
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
  categoryAnchorFocus,
  parentAnchorFocus,
}) => {
  const flatListRef = useRef<FlatList<any>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns } = responsiveConfig;

  const listSpacing = deviceType === "tv" ? 0 : spacing;
  const listColumns = numColumns || (deviceType === "tv" ? 5 : columns);

  // 允許 "page" | "parent" | null
  const backStageRef = useRef<"page" | "parent" | null>(null);

  useEffect(() => {
    if (deviceType === "tv" && Platform.OS === "android") {
      const handler = () => {
        const stage = backStageRef.current;

        // 第一次返回：本頁入口
        if (stage === null) {
          categoryAnchorFocus?.();
          scrollToTop();
          backStageRef.current = "page";
          return true;
        }

        // 第二次返回：上一層入口（若存在）
        if (stage === "page") {
          if (parentAnchorFocus) {
            parentAnchorFocus();
            backStageRef.current = "parent";
            return true;
          }
          // 沒有上一層 → 放行導航
          backStageRef.current = null;
          return false;
        }

        // 第三次後：放行導航並重置
        backStageRef.current = null;
        return false;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", handler);
      return () => sub.remove();
    }
  }, [deviceType, categoryAnchorFocus, parentAnchorFocus]);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderFooter = () => {
    if (ListFooterComponent) {
      if (React.isValidElement(ListFooterComponent)) return ListFooterComponent;
      if (typeof ListFooterComponent === "function") {
        const Component = ListFooterComponent as React.ComponentType<any>;
        return <Component />;
      }
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
        columnWrapperStyle={{ columnGap: deviceType === "tv" ? 0 : listSpacing }}
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
          <ThemedText>{"\u2B06"}</ThemedText>
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
