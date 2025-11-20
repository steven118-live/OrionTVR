import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  FlatList,
  ViewStyle,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";

interface CustomScrollViewProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactNode;
  numColumns?: number; // 如果不提供，使用響應式配置
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number; // 控制返回頂部按鈕出現的滾動距離閾值，不影響效能
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
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
}) => {
  const flatListRef = useRef<FlatList<any>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns } = responsiveConfig;

  // TV 模式固定 5 列，spacing=0
  const listSpacing = deviceType === "tv" ? 0 : spacing;
  const listColumns = numColumns || (deviceType === "tv" ? 5 : columns);

  // 返回鍵處理：TV 模式下可快速回頂
  useEffect(() => {
    if (deviceType === "tv") {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
        if (showScrollToTop) {
          scrollToTop();
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  }, [showScrollToTop, deviceType]);

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

// ✅ 改成獨立函數並加上 ViewStyle 型別
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
