import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, TouchableOpacity } from "react-native";
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

// 引入 opencc-js
import OpenCC from "opencc-js";

type TextInputRef = TextInput | null;

type TranslatedCacheValue = {
  id: string;
  title: string;
  source_name?: string;
  original: SearchResult;
};

const logger = Logger.withTag('SearchScreen');

export default function SearchScreen() {
  // core states
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  // authoritative refs + guards
  const [lastSearchSuccessful, setLastSearchSuccessful] = useState<boolean | null>(null);
  const lastSearchSuccessfulRef = useRef<boolean | null>(null);
  const clearedOnRefocusRef = useRef(false);
  const lastBlurTimeRef = useRef<number | null>(null);
  const isSearchingRef = useRef(false);

  // translation cache & paging
  const translatedCacheRef = useRef<Map<string, TranslatedCacheValue>>(new Map());
  const [page, setPage] = useState(1);
  const pageSize = 20; // adjust as needed or derive from responsiveConfig

  // responsive
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  // keep ref in sync with state
  useEffect(() => {
    lastSearchSuccessfulRef.current = lastSearchSuccessful;
  }, [lastSearchSuccessful]);

  // memoize converter instance and cache to avoid repeated init and repeated conversions
  const conversionCacheRef = useRef<Map<string, string> | null>(null);
  const memoizedConverter = useMemo(() => {
    conversionCacheRef.current = new Map<string, string>();
    if (typeof OpenCC?.Converter === "function") {
      try {
        return OpenCC.Converter({ from: "tw", to: "cn" });
      } catch (e) {
        logger.debug("OpenCC init failed:", e);
        return undefined;
      }
    }
    return undefined;
  }, []);

  const runConverterSafeCached = (term: string) => {
    if (!term) return term;
    const cache = conversionCacheRef.current;
    if (cache && cache.has(term)) {
      return cache.get(term)!;
    }
    if (!memoizedConverter) return term;
    try {
      const converted = memoizedConverter(term);
      cache?.set(term, converted);
      return converted;
    } catch (e) {
      logger.debug("convert failed:", e);
      return term;
    }
  };

  // helper: get page items
  const getPageItems = (all: SearchResult[], pageNum: number) => {
    const start = (pageNum - 1) * pageSize;
    return all.slice(start, start + pageSize);
  };

  // translate items on current page if needed; synchronous because runConverterSafeCached is sync
  const translatePageIfNeeded = useCallback(async (pageNum: number) => {
    if (!results || results.length === 0) return;
    const pageItems = getPageItems(results, pageNum);
    const toTranslate: SearchResult[] = [];

    pageItems.forEach(it => {
      const key = it.id.toString();
      if (!translatedCacheRef.current.has(key)) {
        toTranslate.push(it);
      }
    });

    // perform conversion synchronously per item and cache
    toTranslate.forEach(it => {
      const key = it.id.toString();
      const convertedTitle = runConverterSafeCached(it.title ?? "");
      const v: TranslatedCacheValue = { id: key, title: convertedTitle, source_name: it.source_name, original: it };
      translatedCacheRef.current.set(key, v);
    });
  }, [results, pageSize]);

  // handleSearch: stable, awaitable, updates refs
  const runSearch = useCallback(async (term?: string) => {
    const t = typeof term === "string" ? term.trim() : keyword.trim();
    if (!t) {
      Keyboard.dismiss();
      return;
    }

    isSearchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const simplifiedTerm = runConverterSafeCached(t);
      const response = await api.searchVideos(simplifiedTerm);

      if (response && Array.isArray(response.results) && response.results.length > 0) {
        setResults(response.results);
        setLastSearchSuccessful(true);
        lastSearchSuccessfulRef.current = true;
        clearedOnRefocusRef.current = false;

        // reset translation cache on new search and reset to first page
        translatedCacheRef.current.clear();
        conversionCacheRef.current && conversionCacheRef.current.clear();
        setPage(1);
        // translate first page eagerly (so UI shows converted titles immediately)
        await translatePageIfNeeded(1);
      } else {
        setResults([]);
        setError("没有找到相关内容");
        setLastSearchSuccessful(false);
        lastSearchSuccessfulRef.current = false;
        clearedOnRefocusRef.current = true;
        // clear cache
        translatedCacheRef.current.clear();
      }
    } catch (err) {
      setResults([]);
      setError("搜索失败，请稍后重试。");
      setLastSearchSuccessful(false);
      lastSearchSuccessfulRef.current = false;
      clearedOnRefocusRef.current = true;
      translatedCacheRef.current.clear();
      logger.info("Search failed:", err);
    } finally {
      isSearchingRef.current = false;
      setLoading(false);
    }
  }, [keyword, translatePageIfNeeded]);

  // remote input effect: await search then clear message
  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);

      (async () => {
        await runSearch(realMessage);
        clearMessage();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage, runSearch]);

  const onSearchPress = () => void runSearch();

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

  const renderItem = ({ item }: { item: SearchResult; index: number }) => {
    const key = item.id.toString();
    const cached = translatedCacheRef.current.get(key);
    const displayTitle = cached ? cached.title : item.title;
    return (
      <VideoCard
        id={item.id.toString()}
        source={item.source}
        title={displayTitle}
        poster={item.poster}
        year={item.year}
        sourceName={item.source_name}
        api={api}
      />
    );
  };

  // focus / blur handlers with guards
  const handleInputFocus = () => {
    setIsInputFocused(true);
    if (isSearchingRef.current) return;
    if (!lastSearchSuccessfulRef.current) return;
    if (clearedOnRefocusRef.current) return;

    const now = Date.now();
    const blurTime = lastBlurTimeRef.current ?? 0;
    if (blurTime && now - blurTime < 80) return;

    clearedOnRefocusRef.current = true;
    setKeyword("");
    setLastSearchSuccessful(null);
    lastSearchSuccessfulRef.current = null;
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    lastBlurTimeRef.current = Date.now();
    if (lastSearchSuccessfulRef.current) {
      clearedOnRefocusRef.current = false;
    } else {
      clearedOnRefocusRef.current = true;
    }
  };

  // page change handler (awaits translation)
  const onPageChange = async (newPage: number) => {
    // bounds check
    const maxPage = Math.max(1, Math.ceil(results.length / pageSize));
    const target = Math.min(Math.max(1, newPage), maxPage);
    setPage(target);
    await translatePageIfNeeded(target);
  };

  // ensure current page is translated when results or page change (defensive)
  useEffect(() => {
    void translatePageIfNeeded(page);
  }, [results, page, translatePageIfNeeded]);

  // dynamic styles
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  // render current page items into CustomScrollView (so existing component continues to work)
  const pageItems = getPageItems(results, page);

  return (
    <ResponsiveWrapper
      deviceType={deviceType}
      commonStyles={commonStyles}
      dynamicStyles={dynamicStyles}
      isFirstPage={page === 1}
      content={
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
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                returnKeyType="search"
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
              data={pageItems}
              renderItem={renderItem}
              loading={loading}
              error={error}
              emptyMessage="输入关键词开始搜索"
            />
          )}

          {/* simple pagination controls (TV/desktop can use other UI) */}
          {results.length > pageSize && (
            <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
              <StyledButton onPress={() => void onPageChange(page - 1)} style={{ marginRight: 8 }}>
                上一页
              </StyledButton>
              <ThemedText style={{ alignSelf: "center", marginHorizontal: 8 }}>
                第 {page} / {Math.max(1, Math.ceil(results.length / pageSize))} 页
              </ThemedText>
              <StyledButton onPress={() => void onPageChange(page + 1)} style={{ marginLeft: 8 }}>
                下一页
              </StyledButton>
            </View>
          )}

          <RemoteControlModal />
        </>
      }
    />
  );
}

/**
 * Responsive wrapper component inlined to keep top-level render simple and avoid duplicating logic.
 * Preserves previous behavior: don't wrap with ResponsiveNavigation on TV.
 */
function ResponsiveWrapper({
  deviceType,
  commonStyles,
  dynamicStyles,
  isFirstPage,
  content,
}: {
  deviceType: string;
  commonStyles: any;
  dynamicStyles: any;
  isFirstPage: boolean;
  content: React.ReactNode;
}) {
  const inner = <ThemedView style={[commonStyles.container, dynamicStyles.container]}>{content}</ThemedView>;
  if (deviceType === 'tv') return <>{inner}</>;
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {inner}
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
