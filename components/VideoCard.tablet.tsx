import React, { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Star, Play } from "lucide-react-native";
import { PlayRecordManager } from "@/services/storage";
import { API } from "@/services/api";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('VideoCardTablet');

interface VideoCardTabletProps extends React.ComponentProps<typeof TouchableOpacity> {
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

const VideoCardTabletComponent = forwardRef<View, VideoCardTabletProps>(
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
        }: VideoCardTabletProps,
        ref
    ) => {
        const router = useRouter();
        const { cardWidth, cardHeight, spacing } = useResponsiveLayout();
        
        // ������ 優化：使用 useRef 來儲存 Animated.Value，避免在每次渲染時重新創建
        const fadeAnim = useRef(new Animated.Value(0)).current; 
        const [isPressed, setIsPressed] = useState(false);

        const longPressTriggered = useRef(false);
        const scale = useRef(new Animated.Value(1)).current;

        const handlePress = useCallback(() => {
            if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
            }
            
            const targetPath = (progress !== undefined && episodeIndex !== undefined) ? "/play" : "/detail";
            const params = (progress !== undefined && episodeIndex !== undefined)
                ? { source, id, episodeIndex: episodeIndex - 1, title, position: playTime * 1000 }
                : { source, q: title };

            router.push({ pathname: targetPath, params });
        }, [router, source, id, title, progress, episodeIndex, playTime]); // 依賴項已優化

        // 保持按壓動畫邏輯不變，已使用 Native Driver 和 useCallback
        const handlePressIn = useCallback(() => {
            setIsPressed(true);
            Animated.spring(scale, {
                toValue: 0.96,
                damping: 15,
                stiffness: 300,
                useNativeDriver: true,
            }).start();
        }, [scale]);

        const handlePressOut = useCallback(() => {
            setIsPressed(false);
            Animated.spring(scale, {
                toValue: 1.0,
                damping: 15,
                stiffness: 300,
                useNativeDriver: true,
            }).start();
        }, [scale]);

        // ������ 優化 2: 移除列表項目的隨機延遲 (delay: Math.random() * 150)
        // 列表載入時的隨機延遲會導致視覺上的不一致和卡頓感。
        useEffect(() => {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: DeviceUtils.getAnimationDuration(200), // 縮短至 200ms
                delay: 0, // 移除隨機延遲
                useNativeDriver: true,
            }).start();
        }, [fadeAnim]);

        const handleLongPress = useCallback(() => {
            if (progress === undefined) return;

            longPressTriggered.current = true;

            Alert.alert("删除观看记录", `确定要删除"${title}"的观看记录吗？`, [
                {
                    text: "取消",
                    style: "cancel",
                    onPress: () => { longPressTriggered.current = false; }
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
                            longPressTriggered.current = false;
                        }
                    },
                },
            ]);
        }, [progress, title, source, id, onRecordDeleted]); // 依賴項已優化

        const isContinueWatching = progress !== undefined && progress > 0 && progress < 1;

        const animatedStyle = {
            transform: [{ scale }],
        };

        // ������ 樣式創建：由於 cardWidth, cardHeight, spacing 來自 useResponsiveLayout()，
        // 且這些值在生命週期中理論上不會改變，因此保持其在組件內部調用是可接受的。
        const styles = createTabletStyles(cardWidth, cardHeight, spacing);

        return (
            <Animated.View style={[styles.wrapper, animatedStyle, { opacity: fadeAnim }]} ref={ref}>
                <TouchableOpacity
                    onPress={handlePress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onLongPress={handleLongPress}
                    style={styles.pressable}
                    activeOpacity={1}
                    delayLongPress={900}
                >
                    <View style={[styles.card, isPressed && styles.cardPressed]}>
                        <Image source={{ uri: api.getImageProxyUrl(poster) }} style={styles.poster} />
                        {/* 新增集數標籤 */}
                        {episodeIndex !== undefined && totalEpisodes !== undefined && totalEpisodes > 1 && (
                            <View style={styles.episodeBadge}>
                                <Text style={styles.badgeText}>
                                    {episodeIndex}/{totalEpisodes}
                                </Text>
                            </View>
                        )}

                        {/* 悬停效果遮罩 (isPressed 在平板上模擬 hover 效果) */}
                        {isPressed && (
                            <View style={styles.pressOverlay}>
                                {isContinueWatching && (
                                    <View style={styles.continueWatchingBadge}>
                                        <Play size={16} color="#ffffff" fill="#ffffff" />
                                        <Text style={styles.continueWatchingText}>繼續觀看</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 进度条 */}
                        {isContinueWatching && (
                            <View style={styles.progressContainer}>
                                <View style={[styles.progressBar, { width: `${(progress || 0) * 100}%` }]} />
                            </View>
                        )}

                        {/* 评分 */}
                        {rate && (
                            <View style={styles.ratingContainer}>
                                <Star size={12} color="#FFD700" fill="#FFD700" />
                                <Text style={styles.ratingText}>{rate}</Text>
                            </View>
                        )}

                        {/* 年份 */}
                        {year && (
                            <View style={styles.yearBadge}>
                                <Text style={styles.badgeText}>{year}</Text>
                            </View>
                        )}

                        {/* 来源 */}
                        {sourceName && (
                            <View style={styles.sourceNameBadge}>
                                <Text style={styles.badgeText}>{sourceName}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.infoContainer}>
                        <ThemedText numberOfLines={2} style={styles.title}>{title}</ThemedText>
                        {isContinueWatching && (
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.continueLabel} numberOfLines={1}>
                                    第{episodeIndex! + 1}集 已觀看 {Math.round((progress || 0) * 100)}%
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    }
);

VideoCardTabletComponent.displayName = "VideoCardTablet";

// ������ 核心優化：使用 React.memo 包裹導出
const VideoCardTablet = React.memo(VideoCardTabletComponent);

export default VideoCardTablet;

const createTabletStyles = (cardWidth: number, cardHeight: number, spacing: number) => {
    return StyleSheet.create({
        wrapper: {
            width: cardWidth,
            marginHorizontal: spacing / 2,
            marginBottom: spacing,
        },
        pressable: {
            alignItems: 'center',
        },
        card: {
            width: cardWidth,
            height: cardHeight,
            borderRadius: 10,
            backgroundColor: "#222",
            overflow: "hidden",
        },
        cardPressed: {
            borderColor: Colors.dark.primary,
            borderWidth: 2,
        },
        poster: {
            width: "100%",
            height: "100%",
            resizeMode: 'cover',
        },
        pressOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 10,
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
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
        },
        continueWatchingText: {
            color: "white",
            marginLeft: 6,
            fontSize: 14,
            fontWeight: "bold",
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
            fontSize: 11,
            fontWeight: "bold",
            marginLeft: 3,
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
            fontSize: 11,
            fontWeight: "bold",
        },
        infoContainer: {
            width: cardWidth,
            marginTop: 8,
            alignItems: "flex-start",
            paddingHorizontal: 4,
        },
        infoRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 2,
        },
        title: {
            fontSize: 15,
            lineHeight: 18,
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
};
