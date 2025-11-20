import { create } from "zustand";
import { api, SearchResult, PlayRecord } from "@/services/api";
import { PlayRecordManager } from "@/services/storage";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";

export type RowItem = (SearchResult | PlayRecord) & {
    id: string;
    source: string;
    title: string;
    poster: string;
    progress?: number;
    play_time?: number;
    lastPlayed?: number;
    episodeIndex?: number;
    sourceName?: string;
    totalEpisodes?: number;
    year?: string;
    rate?: string;
};

export interface Category {
    title: string;
    type?: "movie" | "tv" | "record";
    tag?: string;
    tags?: string[];
}

const initialCategories: Category[] = [
    { title: "最近播放", type: "record" },
    { title: "热门剧集", type: "tv", tag: "热门" },
    { title: "电视剧", type: "tv", tags: ["国产剧", "美剧", "英剧", "韩剧", "日剧", "港剧", "纪录片"] },
    { title: "动漫", type: "tv", tags: ["日本动画", "国产动画", "欧美动画"] },
    { title: "电影", type: "movie", tags: ["热门", "最新", "经典", "豆瓣高分", "冷门佳片", "华语", "欧美", "韩国", "日本", "动作", "喜剧", "爱情", "科幻", "悬疑", "恐怖"] },
    { title: "综艺", type: "tv", tag: "综艺" },
    { title: "豆瓣 Top250", type: "movie", tag: "top250" },
];

interface CacheItem {
    data: RowItem[];
    timestamp: number;
    type: 'movie' | 'tv' | 'record';
    hasMore: boolean;
    nextOffset: number; 
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟过期
const MAX_CACHE_SIZE = 10; // 最大缓存容量
const MAX_ITEMS_PER_CACHE = 40; // 每个缓存最大条目数

const getCacheKey = (category: Category) => {
    return `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
};

const isValidCache = (cacheItem: CacheItem) => {
    return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
};

/**
 * ������ HomeState 修正：添加缺失的動作類型
 */
export interface HomeState {
    categories: Category[];
    selectedCategory: Category;
    contentData: RowItem[];
    loading: boolean;
    loadingMore: boolean;
    pageStart: number;
    hasMore: boolean;
    error: string | null;
    fetchInitialData: () => Promise<void>;
    loadMoreData: () => Promise<void>;
    selectCategory: (category: Category) => void;
    refreshPlayRecords: () => Promise<void>;
    clearError: () => void;
    
    // ✅ 1. 添加 setPlayRecords 類型 (用於 app/_layout.tsx 中的錯誤回退)
    setPlayRecords: (records: RowItem[]) => void; 
    // ✅ 2. 添加 initEpisodeSelection 類型 (用於 app/_layout.tsx 中的初始化)
    initEpisodeSelection: () => void;
}

// 内存缓存，应用生命周期内有效
const dataCache = new Map<string, CacheItem>();

const useHomeStore = create<HomeState>((set, get) => ({
    categories: initialCategories,
    selectedCategory: initialCategories[0],
    contentData: [],
    loading: true,
    loadingMore: false,
    pageStart: 0,
    hasMore: true,
    error: null,

    // ������ HomeState 修正：實作缺失的 setPlayRecords 動作
    setPlayRecords: (records) => {
        set({ contentData: records });
    },

    // ������ HomeState 修正：實作缺失的 initEpisodeSelection 動作
    initEpisodeSelection: () => {
        // 假設這裡是用來初始化選集相關狀態的，如果沒有實際邏輯可以留空
        // 或是根據需要設定預設值
        // set({ someEpisodeState: null }); 
    },

    fetchInitialData: async () => {
        const { apiBaseUrl } = useSettingsStore.getState();
        await useAuthStore.getState().checkLoginStatus(apiBaseUrl); 

        const { selectedCategory } = get();
        const cacheKey = getCacheKey(selectedCategory);

        // 最近播放不缓存，始终实时获取
        if (selectedCategory.type === 'record') {
            set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null });
            await get().loadMoreData();
            return;
        }

        // 檢查快取
        if (dataCache.has(cacheKey) && isValidCache(dataCache.get(cacheKey)!)) {
            const cachedData = dataCache.get(cacheKey)!;
            set({
                loading: false,
                contentData: cachedData.data,
                pageStart: cachedData.nextOffset, 
                hasMore: cachedData.hasMore,
                error: null
            });
            return;
        }

        set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null });
        await get().loadMoreData();
    },

    loadMoreData: async () => {
        const { selectedCategory, pageStart, loadingMore, hasMore } = get();
        if (loadingMore || !hasMore) return;

        if (pageStart > 0) {
            set({ loadingMore: true });
        } else {
            set({ loading: true });
        }

        try {
            if (selectedCategory.type === "record") {
                const { isLoggedIn } = useAuthStore.getState();
                if (!isLoggedIn) {
                    set({ contentData: [], hasMore: false });
                    return;
                }
                const records = await PlayRecordManager.getAll();
                const rowItems = Object.entries(records)
                    .map(([key, record]) => {
                        const [source, id] = key.split("+");
                        return {
                            ...record,
                            id,
                            source,
                            progress: record.play_time / record.total_time,
                            poster: record.cover,
                            sourceName: record.source_name,
                            episodeIndex: record.index,
                            totalEpisodes: record.total_episodes,
                            lastPlayed: record.save_time,
                            play_time: record.play_time,
                        };
                    })
                    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

                set({ contentData: rowItems, hasMore: false });
            } else if (selectedCategory.type && selectedCategory.tag) {
                const result = await api.getDoubanData(
                    selectedCategory.type,
                    selectedCategory.tag,
                    20,
                    pageStart
                );

                const newItems = result.list.map((item) => ({
                    ...item,
                    id: item.title,
                    source: "douban",
                })) as RowItem[];

                const cacheKey = getCacheKey(selectedCategory);

                if (pageStart === 0) {
                    // 清理過期快取
                    for (const [key, value] of dataCache.entries()) {
                        if (!isValidCache(value)) {
                            dataCache.delete(key);
                        }
                    }

                    // 如果快取太大，刪除最舊的項
                    if (dataCache.size >= MAX_CACHE_SIZE) {
                        const oldestKey = Array.from(dataCache.keys())[0];
                        dataCache.delete(oldestKey);
                    }

                    // 限制快取的數據條目數
                    const cacheItems = newItems.slice(0, MAX_ITEMS_PER_CACHE);

                    dataCache.set(cacheKey, {
                        data: cacheItems,
                        timestamp: Date.now(),
                        type: selectedCategory.type,
                        hasMore: true, 
                        nextOffset: newItems.length,
                    });

                    set({
                        contentData: newItems,
                        pageStart: newItems.length,
                        hasMore: result.list.length !== 0,
                    });
                } else {
                    // 增量載入時更新快取
                    const existingCache = dataCache.get(cacheKey);
                    if (existingCache) {
                        // 只有當快取數據少於最大限制時才更新快取
                        if (existingCache.data.length < MAX_ITEMS_PER_CACHE) {
                            const updatedData = [...existingCache.data, ...newItems];
                            const limitedCacheData = updatedData.slice(0, MAX_ITEMS_PER_CACHE);

                            dataCache.set(cacheKey, {
                                ...existingCache,
                                data: limitedCacheData,
                                hasMore: true,
                                nextOffset: existingCache.nextOffset + newItems.length,
                            });
                        }
                    }

                    // 更新狀態時使用所有數據
                    set((state) => ({
                        contentData: [...state.contentData, ...newItems],
                        pageStart: state.pageStart + newItems.length,
                        hasMore: result.list.length !== 0,
                    }));
                }
            } else if (selectedCategory.tags) {
                // It's a container category, do not load content, but clear current content
                set({ contentData: [], hasMore: false });
            } else {
                set({ hasMore: false });
            }
        } catch (err: any) {
            let errorMessage = "加載失敗，請重試";

            if (err.message === "API_URL_NOT_SET") {
                errorMessage = "請點擊右上角設置按鈕，配置您的伺服器地址";
            } else if (err.message === "UNAUTHORIZED") {
                errorMessage = "認證失敗，請重新登錄";
            } else if (err.message.includes("Network")) {
                errorMessage = "網絡連接失敗，請檢查網絡連接";
            } else if (err.message.includes("timeout")) {
                errorMessage = "請求超時，請檢查網絡或伺服器狀態";
            } else if (err.message.includes("404")) {
                errorMessage = "伺服器API路徑不正確，請檢查伺服器配置";
            } else if (err.message.includes("500")) {
                errorMessage = "伺服器內部錯誤，請聯繫管理員";
            } else if (err.message.includes("403")) {
                errorMessage = "訪問被拒絕，請檢查權限設置";
            }

            set({ error: errorMessage });
        } finally {
            set({ loading: false, loadingMore: false });
        }
    },

    selectCategory: (category: Category) => {
        const currentCategory = get().selectedCategory;
        const cacheKey = getCacheKey(category);

        if (currentCategory.title !== category.title || currentCategory.tag !== category.tag) {
            set({
                selectedCategory: category,
                contentData: [],
                pageStart: 0,
                hasMore: true,
                error: null
            });

            if (category.type === 'record') {
                get().fetchInitialData();
                return;
            }

            const cachedData = dataCache.get(cacheKey);
            if (cachedData && isValidCache(cachedData)) {
                set({
                    contentData: cachedData.data,
                    pageStart: cachedData.nextOffset,
                    hasMore: cachedData.hasMore,
                    loading: false
                });
            } else {
                // 刪除過期快取
                if (cachedData) {
                    dataCache.delete(cacheKey);
                }
                get().fetchInitialData();
            }
        }
    },

    refreshPlayRecords: async () => {
        const { apiBaseUrl } = useSettingsStore.getState();
        await useAuthStore.getState().checkLoginStatus(apiBaseUrl);
        const { isLoggedIn } = useAuthStore.getState();
        if (!isLoggedIn) {
            set((state) => {
                const recordCategoryExists = state.categories.some((c) => c.type === "record");
                if (recordCategoryExists) {
                    const newCategories = state.categories.filter((c) => c.type !== "record");
                    if (state.selectedCategory.type === "record") {
                        get().selectCategory(newCategories[0] || initialCategories[1]);
                    }
                    return { categories: newCategories };
                }
                return {};
            });
            return;
        }
        const records = await PlayRecordManager.getAll();
        const hasRecords = Object.keys(records).length > 0;
        set((state) => {
            const recordCategoryExists = state.categories.some((c) => c.type === "record");
            if (hasRecords && !recordCategoryExists) {
                const recordCategory = initialCategories.find(c => c.type === 'record');
                if (recordCategory) {
                    if (!state.categories.find(c => c.type === 'record')) {
                        return { categories: [recordCategory, ...state.categories] };
                    }
                }
            }
            if (!hasRecords && recordCategoryExists) {
                const newCategories = state.categories.filter((c) => c.type !== "record");
                if (state.selectedCategory.type === "record") {
                    get().selectCategory(newCategories[0] || initialCategories[1]);
                }
                return { categories: newCategories };
            }
            return {};
        });

        if (get().selectedCategory.type === 'record') {
             get().fetchInitialData();
        }
    },

    clearError: () => {
        set({ error: null });
    },
}));

export default useHomeStore;
