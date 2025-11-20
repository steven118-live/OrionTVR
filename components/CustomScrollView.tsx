import React, { useRef, useState } from "react";
import { // ✅ 修正 5: 確保 import 語法正確
  View,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  FlatList,
  ViewStyle,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsStore } from "@/stores/settingsStore";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
// import { getStatusBarHeight } from "react-native-safe-area-context"; 
import useHomeStore from "@/stores/homeStore"; // ✅ 修正 6: 確保 HomeStore 是預設導入

interface CustomScrollViewProps {
  children?: React.ReactNode; // ✅ 修正 7: 將 children 改為可選
  style?: any;
  contentContainerStyle?: any;
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
  onScrollToTop?: (isTop: boolean) => void; 
}

export default function CustomScrollView({
  data,
  renderItem,
  numColumns,
  loading = false,
  loadingMore = false,
  error = null,
  onEndReached,
  loadMoreThreshold = 200,
  emptyMessage = "暫無內容",
  ListFooterComponent,
  categoryKey,
  onScrollToTop,
}: CustomScrollViewProps) {
    
  const flatListRef = useRef<FlatList<any>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isTopRef = useRef(true);

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns } = responsiveConfig;

  const listSpacing = deviceType === "tv" ? 0 : spacing;
  const listColumns = numColumns || (deviceType === "tv" ? 5 : columns);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    
    setShowScrollToTop(offsetY > loadMoreThreshold);
    
    const isAtTop = offsetY <= 5; 
    
    if (isAtTop !== isTopRef.current) {
        isTopRef.current = isAtTop;
        onScrollToTop?.(isAtTop);
    }
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

  const keyProp = categoryKey ? `flatlist-${categoryKey}` : undefined;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        key={keyProp}
        data={data}
        keyExtractor={(item, index) => (item.id?.toString() ?? index.toString())}
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
        contentContainerStyle={{ 
          paddingHorizontal: listSpacing,
          paddingTop: deviceType === 'tv' ? spacing * 0.5 : 0, 
          paddingBottom: spacing * 2, 
        }}
        columnWrapperStyle={{ columnGap: deviceType === "tv" ? 0 : listSpacing }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter()}
        showsVerticalScrollIndicator={deviceType !== "tv"}
        onScroll={handleScroll} 
        scrollEventThrottle={16}
        
        initialNumToRender={listColumns * 2}
        maxToRenderPerBatch={listColumns * 2}
        windowSize={11}
        removeClippedSubviews={Platform.OS !== 'web'}
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
}

const getScrollToTopButtonStyle = (spacing: number, visible: boolean): ViewStyle => ({
  position: "absolute",
  right: spacing,
  bottom: spacing * 2,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  padding: spacing,
  borderRadius: spacing,
  opacity: visible ? 1 : 0,
});
