import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';

import OpenCC from 'opencc-js';



type ConverterFunc = (s: string) => string;

const cn2tw: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;

const tw2cn: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'tw', to: 'cn' }) : (s: string) => s;

// 匹配：URL | Rev### | email | 特殊字元 | Bopomofo (注音) Unicode 範圍
// const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]|\u3100-\u312F|\u31A0-\u31BF/;
// const convertCache = new Map<string, string>();

// function shouldSkipConvert(s?: string | null): boolean {
//   if (!s) return true;
//   if (typeof s !== 'string') return true;
//   if (!s.trim()) return true;
//   if (SKIP_PATTERN.test(s)) return true;
//   return false;
// }

// /** 繁→簡（快速快取） */
// function convertTw2CnFastInline(s: string): string {
//   if (!s) return s;
//   const cached = convertCache.get(`tw2cn:${s}`);
//   if (cached) return cached;
//   if (shouldSkipConvert(s)) return s;
//   try {
//     const out = tw2cn(s);
//     if (out && out !== s) convertCache.set(`tw2cn:${s}`, out);
//     return out;
//   } catch {
//     return s;
//   }
// }

// /**
//  * 非同步安全轉換（繁→簡）
//  */
// async function convertTw2CnSafeAsync(s: string): Promise<string> {
//   if (!s) return s;
//   if (shouldSkipConvert(s)) return s;
//   try {
//     const out = tw2cn(s);
//     if (out && out !== s) convertCache.set(`tw2cn:${s}`, out);
//     return out;
//   } catch {
//     return s;
//   }
// }


const logger = Logger.withTag('SearchScreen');

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage(); // Clear the message after processing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);
  // useEffect(() => {
  //   // Focus the text input when the screen loads
  //   const timer = setTimeout(() => {
  //     textInputRef.current?.focus();
  //   }, 200);
  //   return () => clearTimeout(timer);
  // }, []);

  // // 離開 Search 時清掉快取
  // useEffect(() => {
  //   return () => {
  //     convertCache.clear();
  //     setKeyword("");
  //     textInputRef.current?.blur();
  //   };
  // }, []);

  const handleSearch = async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    if (!term.trim()) {
      Keyboard.dismiss();
      return;
    }

    // const term = simplifiedTerm
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      // 搜索前：繁→簡
      // const simplifiedTerm = convertTw2CnFastInline(term);
      // const simplifiedTerm = await convertTw2CnSafeAsync(term);
      const simplifiedTerm = tw2cn(term) ?? term;
      const response = await api.searchVideos(simplifiedTerm);
      if (response.results.length > 0) {
        setResults(response.results);
      } else {
        setError("没有找到相关内容");
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const onSearchPress = () => handleSearch();

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal('search');
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            {
              borderColor: isInputFocused ? Colors.dark.primary : "transparent",
            },
          ]}
          onPress={() => textInputRef.current?.focus()}
        >
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color="white" />
        </StyledButton>

        {/* 搜尋中顯示動態放大鏡 */}
        {loading && (
          <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginLeft: 8 }} />
        )}

        {deviceType !== 'mobile' && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === 'tv' ? 24 : 20} color="white" />
          </StyledButton>
        )}
      </View>

      {error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={5}
          columnWrapperStyle={{ justifyContent: "flex-start" }}
          initialNumToRender={10}
          windowSize={5}
          removeClippedSubviews
        />

      ) : (
        !loading && (
          <View style={[commonStyles.center, { flex: 1 }]}>
            <ThemedText style={dynamicStyles.errorText}>输入关键词开始搜索</ThemedText>
          </View>
        )
      )}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === 'tv' ? 50 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: "#2c2c2e",
      borderRadius: isMobile ? 8 : 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: "white",
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
      marginRight: deviceType !== 'mobile' ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    errorText: {
      color: "red",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
