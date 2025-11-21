import React, { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  Pressable, 
  TouchableOpacity, 
  Alert, 
  Animated, 
  Platform 
} from "react-native";
import { useRouter } from "expo-router";
import { Star, Play } from "lucide-react-native";
import { PlayRecordManager } from "@/services/storage";
import { API } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import Logger from '@/utils/Logger';
// ⚠️ 移除 useResponsiveLayout，因為這已經是 .tv 專用組件

const logger = Logger.withTag('VideoCardTV');

interface VideoCardProps extends React.ComponentProps<typeof TouchableOpacity> {
  id: string;
  source: string;
  title: string;
  poster: string;
  year?: string;
  rate?: string;
  sourceName?: string;
  progress?: number; 
  playTime?: number; 
  episodeIndex?: number; 
  totalEpisodes?: number; 
  onFocus?: () => void;
  onRecordDeleted?: () => void;
  api: API;
}

// ������ 優化 1: 使用 React.memo 包裹組件，防止 FlatList 滾動時不必要的重渲染
const VideoCardTV = React.memo(forwardRef<View, VideoCardProps>(
  (
    {
      id,
      source,
      title,
      poster,
      year,
      rate,
      sourceName,
      progress,
      episodeIndex,
      onFocus,
      onRecordDeleted,
      api,
      playTime = 0,
      totalEpisodes,
    }: VideoCardProps,
    ref
  ) => {
    const router = useRouter();
    const [isFocused, setIsFocused] = useState(false);
    
    // ������ 僅保留一次性淡入動畫的狀態和引用
    const fadeAnim = useRef(new Animated.Value(0)).current; 
    const longPressTriggered = useRef(false);
    const scale = useRef(new Animated.Value(1)).current;

    const animatedStyle = {
      transform: [{ scale }],
    };

    // ������ 優化 2: 移除 FlatList 內的隨機延遲淡入動畫
    // 在 FlatList 內使用隨機延遲會導致組件載入時間不一致，造成明顯卡頓感。
    useEffect(() => {
      // 僅執行一次淡入，讓卡片快速顯示
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200, // 縮短至 200ms
        delay: 0, // 移除隨機延遲
        useNativeDriver: true,
      }).start();
    }, [fadeAnim]);


    const handlePress = useCallback(() => {
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      // 保持原有邏輯
      const targetPath = (progress !== undefined && episodeIndex !== undefined) ? "/play" : "/detail";
      const params = (progress !== undefined && episodeIndex !== undefined)
        ? { source, id, episodeIndex: episodeIndex - 1, title, position: playTime * 1000 }
        : { source, q: title };

      router.push({ pathname: targetPath, params });
      
    }, [router, source, id, title, progress, episodeIndex, playTime]);

    // ������ 優化 3: 確保焦點動畫使用 Native Driver 且回調函數優化
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      Animated.spring(scale, {
        toValue: 1.05,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true, // 保持開啟 Native Driver
      }).start();
      onFocus?.();
    }, [scale, onFocus]); // 依賴項已優化

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      Animated.spring(scale, {
        toValue: 1.0,
        damping: 15, // 增加 damping 參數，讓動畫回彈更自然
        stiffness: 200,
        useNativeDriver: true, // 保持開啟 Native Driver
      }).start();
    }, [scale]); // 依賴項已優化

    const handleLongPress = useCallback(() => {
      // Only allow long press for items with progress (play records)
      if (progress === undefined) return;

      longPressTriggered.current = true;

      // Show confirmation dialog to delete play record
      Alert.alert("删除观看记录", `确定要删除"${title}"的观看记录吗？`, [
        {
          text: "取消",
          style: "cancel",
          onPress: () => { longPressTriggered.current = false; } // 取消時重置
        },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              await PlayRecordManager.remove(source, id);
              onRecordDeleted?.();
            } catch (error) {
              logger.info("Failed to delete play record:", error);
              Alert.alert("错误", "删除观看记录失败，请重试");
            } finally {
               // 確保在刪除完成或失敗後重置
               longPressTriggered.current = false; 
            }
          },
        },
      ]);
    }, [progress, title, source, id, onRecordDeleted]); // 依賴項已優化

    // 是否是繼續觀看的視頻
    const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

    return (
      // ������ 優化 4: 移除最外層不必要的 Animated.View，將動畫直接應用於 Pressable
      // 將 Pressable 作為 ref 的實際目標 (如果需要 ref)
      <Animated.View style={[styles.wrapper, animatedStyle, { opacity: fadeAnim }]} ref={ref as any}> 
        <Pressable
          // ������ 保持 TV 平台的 Pressable 設置
          android_ripple={Platform.isTV ? { color: 'transparent' } : { color: Colors.dark.link }}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          // ������ 將 zIndex 判斷移到 onFocus/onBlur 處理，避免每次渲染都計算
          style={styles.pressable} 
          delayLongPress={1000}
        >
          <View style={styles.card}>
            {/* 圖像載入: 使用 Image 組件，確保圖片優化 */}
            <Image source={{ uri: api.getImageProxyUrl(poster) }} style={styles.poster} resizeMode="cover" />

            {/* 新增集數標籤 */}
            {episodeIndex !== undefined && totalEpisodes !== undefined && totalEpisodes > 1 && (
              <View style={styles.episodeBadge}>
                <Text style={styles.badgeText}>
                  {episodeIndex}/{totalEpisodes}
                </Text>
              </View>
            )}

            {isFocused && (
              <View style={styles.overlay}>
                {isContinueWatching && (
                  <View style={styles.continueWatchingBadge}>
                    <Play size={16} color="#ffffff" fill="#ffffff" />
                    <ThemedText style={styles.continueWatchingText}>繼續觀看</ThemedText>
                  </View>
                )}
              </View>
            )}

            {/* 进度条 */}
            {isContinueWatching && (
              <View style={styles.progressContainer}>
                {/* ⚠️ 提醒: 如果 progress 動態更新頻繁，這可能仍是瓶頸。 */}
                <View style={[styles.progressBar, { width: `${(progress || 0) * 100}%` }]} />
              </View>
            )}

            {/* 其他徽章 (不變) */}
            {rate && (
              <View style={styles.ratingContainer}>
                <Star size={12} color="#FFD700" fill="#FFD700" />
                <ThemedText style={styles.ratingText}>{rate}</ThemedText>
              </View>
            )}
            {year && (
              <View style={styles.yearBadge}>
                <Text style={styles.badgeText}>{year}</Text>
              </View>
            )}
            {sourceName && (
              <View style={styles.sourceNameBadge}>
                <Text style={styles.badgeText}>{sourceName}</Text>
              </View>
            )}
          </View>
          <View style={styles.infoContainer}>
            <ThemedText numberOfLines={1}>{title}</ThemedText>
            {isContinueWatching && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.continueLabel}>
                  第{episodeIndex}集 已觀看 {Math.round((progress || 0) * 100)}%
                </ThemedText>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }
));

VideoCardTV.displayName = "VideoCardTV";

export default VideoCardTV;

const CARD_WIDTH = 160;
const CARD_HEIGHT = 240;

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 8,
  },
  pressable: {
    width: CARD_WIDTH + 20,
    height: CARD_HEIGHT + 60,
    justifyContent: 'center',
    alignItems: "center",
    overflow: "visible", // 確保動畫不會被裁剪
  },
  card: {
    marginTop: 10,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#222",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderColor: Colors.dark.primary,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // ... (其他樣式保持不變)
  buttonRow: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  favButton: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  ratingContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  infoContainer: {
    width: CARD_WIDTH,
    marginTop: 8,
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  yearBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sourceNameBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.dark.primary,
  },
  continueWatchingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  continueWatchingText: {
    color: "white",
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "bold",
  },
  continueLabel: {
    color: Colors.dark.primary,
    fontSize: 12,
  },
  episodeBadge: {
    position: "absolute",
    top: "35%",
    left: "50%",
    transform: [{ translateX: -24 }, { translateY: -10 }],
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
});
