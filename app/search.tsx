import React, { useEffect, useRef, useState } from "react";
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
import Logger from "@/utils/Logger";
import OpenCC from "opencc-js";

type TextInputRef = TextInput | null;

const converter: ((s: string) => string) | undefined =
  typeof OpenCC?.Converter === "function" ? OpenCC.Converter({ from: "tw", to: "cn" }) : undefined;

const logger = Logger.withTag("SearchScreen");

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // flag：上一次搜尋是否有結果（成功）
  const [lastSearchHadResults, setLastSearchHadResults] = useState(false);

  const textInputRef = useRef<TextInputRef>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);

  const runConverterSafe = (term: string) => {
    if (!converter) return term;
    try {
      return converter(term);
    } catch (e) {
      logger.debug("convert failed:", e);
      return term;
    }
  };

  // 搜尋邏輯：成功時標記 flag；不在此清空 keyword（等待使用者下一次 focus 再清）
  const handleSearch = async (term?: string) => {
    const t = typeof term === "string" ? term.trim() : keyword.trim();
    if (!t) {
      Keyboard.dismiss();
      return;
    }

    const simplifiedTerm = runConverterSafe(t);

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await api.searchVideos(simplifiedTerm);

      if (response?.results?.length > 0) {
        setResults(response.results);
        setLastSearchHadResults(true); // 成功：下一次 focus 時清空
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

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal("search");
  };

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={String(item.id)}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            { borderColor: isInputFocused ? Colors.dark.primary : "transparent" },
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
            // IME 提交雙保險（TV/手機）
            onEndEditing={({ nativeEvent }) => {
              const term = nativeEvent.text?.trim();
              if (term) handleSearch(term);
            }}
            onSubmitEditing={({ nativeEvent }) => {
              const term = nativeEvent?.text?.trim() ?? keyword.trim();
              if (term) handleSearch(term);
            }}
            onFocus={() => {
              setIsInputFocused(true);
              // 條件：上一次搜尋成功，且使用者再次點選輸入框 → 立即清空
              if (lastSearchHadResults) {
                setKeyword("");
                setLastSearchHadResults(false);
              }
            }}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            // RN 新版使用 autoComplete="off"，若你的專案仍是舊版 prop，保持 autoCompleteType 以相容
            // @ts-expect-error legacy RN prop for some environments
            autoCompleteType="off"
            autoComplete="off"
            underlineColorAndroid="transparent"
            keyboardType={Platform.OS === "android" && deviceType === "tv" ? "default" : undefined}
          />
        </TouchableOpacity>

        <StyledButton
          style={dynamicStyles.searchButton}
          onPress={() => {
            const term = keyword.trim();
            if (term) {
              handleSearch(term);
            } else {
              // 讓 IME 有機會 commit（尤其 TV）
              textInputRef.current?.blur();
            }
          }}
        >
          <Search size={deviceType === "mobile" ? 20 : 24} color="white" />
        </StyledButton>

        {deviceType !== "mobile" && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === "tv" ? 24 : 20} color="white" />
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

  if (deviceType === "tv") return content;

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "tv" ? 50 : 0,
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
      marginRight: deviceType !== "mobile" ? spacing / 2 : 0,
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
