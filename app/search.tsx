import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  Platform,
} from "react-native";
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

// 只 import opencc-js 安全建立 converter（ts/运行期都 guard）
import OpenCC from "opencc-js";
import { convertFastIfCached, convertSafeAsync, shouldSkipConvert } from "@/utils/convertSafe";

const logger = Logger.withTag('SearchScreen');

// 建立 converter（若 opencc-js 無此 API，保持 undefined）
const converter: any = (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'tw', to: 'cn' }) : undefined;

// 簡單判斷是否為 TV 環境（可視情況擴充）
function isTvPlatform() {
  if ((Platform as any).isTV) return true;
  // 部分環境會透過 Platform.OS/Brand 表示，留空容錯
  const os = Platform?.OS || '';
  return /android/i.test(os) && /tv|androidtv|googletv/i.test(((Platform as any)?.Brand || '') as string);
}

// 判斷是否包含注音字符（Bopomofo 範圍）
function containsBopomofo(s?: string | null) {
  if (!s) return false;
  return /[\u3100-\u312F\u31A0-\u31BF]/.test(s);
}

// 封裝一次安全轉換流程：先跳過不該轉換的字串，再快取轉換，再安全轉換
async function safeConvertForSearch(s: string) {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  if (containsBopomofo(s)) return s;
  try {
    const fast = convertFastIfCached(s);
    if (fast && fast !== s) return fast;
    const converted = await convertSafeAsync(s);
    return converted || s;
  } catch (e) {
    logger.debug('safeConvertForSearch failed', e);
    return s;
  }
}

// optional small debounce helper for future use (not used aggressively to avoid IME issues)
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const tvMode = isTvPlatform();

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      // remote input 當作確定輸入，直接發起搜尋（走 safeConvert）
      handleSearch(realMessage);
      clearMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);

  // 主搜尋函式：只在 submit / remote / blur 時呼叫
  const handleSearch = useCallback(async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    if (!term.trim()) {
      Keyboard.dismiss();
      return;
    }

    // 若使用者正在組字（IME composition）中，不立即送出搜尋
    if (isComposing) {
      logger.debug('Search skipped: composition in progress');
      return;
    }

    let queryToSend = term;
    try {
      // TV 環境或包含注音時，保守不做繁簡轉換
      if (!containsBopomofo(term) && !shouldSkipConvert(term) && converter) {
        queryToSend = await safeConvertForSearch(term);
      } else {
        queryToSend = term;
      }
    } catch (e) {
      logger.debug('Conversion error in handleSearch:', e);
      queryToSend = term;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const response = await api.searchVideos(queryToSend);
      if (response.results.length > 0) {
        setResults(response.results);
      } else {
        setResults([]);
        setError("没有找到相关内容");
      }
    } catch (err) {
      setResults([]);
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, isComposing]);

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

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
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

  // 動態樣式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  // onChangeText 只更新 keyword（避免在輸入時做轉換）
  const onChangeText = (t: string) => {
    setKeyword(t);
  };

  // composition handlers（若平台支援）
  const onCompositionStart = () => setIsComposing(true);
  const onCompositionEnd = () => {
    setIsComposing(false);
    // 使用者結束組字後不自動搜尋，保留手動 submit 或 remote submit 行為
  };

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
            onChangeText={onChangeText}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
            // 放在 TextInput 的 props 區段的末尾（取代原先的 onCompositionStart/onCompositionEnd）
            {...(Platform.OS === 'web' ? ({ onCompositionStart, onCompositionEnd } as any) : {})}
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType !== 'mobile' && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === 'tv' ? 24 : 20} color="white" />
          </StyledButton>
        )}
      </View>

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={loading}
          error={error}
          emptyMessage="输入关键词开始搜索"
        />
      )}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

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
