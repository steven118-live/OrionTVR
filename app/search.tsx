import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  Platform,
  FlatList,
  ActivityIndicator,
  Modal,
  Text,
  BackHandler,
  TouchableWithoutFeedback,
} from "react-native";
import { useTVEventHandler } from "react-native";
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
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';
import OpenCC from 'opencc-js';

const cn2tw = (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;
const tw2cn = (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'tw', to: 'cn' }) : (s: string) => s;

const logger = Logger.withTag('SearchScreen');

export default function SearchScreen({ enableBackdropClose = true }: { enableBackdropClose?: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const flatListRef = useRef<FlatList<SearchResult>>(null);
  const [showBackToSearch, setShowBackToSearch] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  // 攔截 Android Back：浮層開啟時只關閉浮層，不退出 App
  useEffect(() => {
    if (!showBackToSearch) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowBackToSearch(false);
      return true;
    });
    return () => sub.remove();
  }, [showBackToSearch]);

  // TV 長按向上事件
  useTVEventHandler((evt) => {
    if (!Platform.isTV || !evt) return;
    if (evt.eventType === "up") {
      if (!pressTimer.current) {
        pressTimer.current = setTimeout(() => {
          setShowBackToSearch(true);
        }, 2000);
      }
    } else if (evt.eventType === "upRelease") {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }
  });

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage();
    }
  }, [lastMessage, targetPage]);

  const handleSearch = async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    if (!term.trim()) {
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
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
    <TouchableOpacity
      onLongPress={!Platform.isTV ? () => setShowBackToSearch(true) : undefined}
      onFocus={Platform.isTV ? () => setShowBackToSearch(true) : undefined}
    >
      <VideoCard
        id={item.id.toString()}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        sourceName={item.source_name}
        api={api}
      />
    </TouchableOpacity>
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
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color="white" />
        </StyledButton>
        {loading && <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginLeft: 8 }} />}
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
      ) : results.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={Platform.isTV ? 5 : 3}
          columnWrapperStyle={{ justifyContent: "flex-start" }}
          initialNumToRender={10}
          windowSize={5}
          removeClippedSubviews
          onEndReached={() => setShowBackToSearch(true)}
          onEndReachedThreshold={0.1}
        />
      ) : (
        !loading && (
          <View style={[commonStyles.center, { flex: 1 }]}>
            <ThemedText style={dynamicStyles.errorText}>输入关键词开始搜索</ThemedText>
          </View>
        )
      )}
      <RemoteControlModal />

// ...前面 import 與程式碼保持不變...

      {showBackToSearch && (
        <Modal
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBackToSearch(false)} // ✅ Android Back 對應
        >
          <View style={dynamicStyles.modal}>
            {enableBackdropClose && (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setShowBackToSearch(false)}
              />
            )}
            <TouchableWithoutFeedback>
              <View style={dynamicStyles.modalContent}>
                <TouchableOpacity
                  onPress={() => {
                    textInputRef.current?.focus?.();
                    setShowBackToSearch(false);
                  }}
                >
                  <Text style={dynamicStyles.modalText}>回到搜尋列</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
                    setShowBackToSearch(false);
                  }}
                >
                  <Text style={dynamicStyles.modalText}>回到第一頁</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowBackToSearch(false)}>
                  <Text style={dynamicStyles.modalText}>取消</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </Modal>
      )}
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
    modal: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: "rgba(0,0,0,0.8)",
      padding: 20,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    modalText: {
      color: "white",
      fontSize: 18,
      marginVertical: 10,
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
