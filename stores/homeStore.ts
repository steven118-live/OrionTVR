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
  { title: "熱門劇集", type: "tv", tag: "熱門" },
  { title: "電視劇", type: "tv", tags: ["國產劇", "美劇", "英劇", "韓劇", "日劇", "港劇", "紀錄片"] },
  { title: "動漫", type: "tv", tags: ["日本動畫", "國產動畫", "歐美動畫"] },
  { title: "電影", type: "movie", tags: ["熱門", "最新", "經典", "豆瓣高分", "冷門佳片", "華語", "歐美", "韓國", "日本", "動作", "喜劇", "愛情", "科幻", "懸疑", "恐怖"] },
  { title: "綜藝", type: "tv", tag: "綜藝" },
  { title: "豆瓣 Top250", type: "movie", tag: "top250" },
];

// 新增快取項介面
interface CacheItem {
  data: RowItem[];
  timestamp: number;
  type: 'movie' | 'tv' | 'record';
  hasMore: boolean;
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分鐘過期
const MAX_CACHE_SIZE = 10; // 最大快取容量
const MAX_ITEMS_PER_CACHE = 40; // 每個快取最大條目數

const getCacheKey = (category: Category) => {
  return `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
};

const isValidCache = (cacheItem: CacheItem) => {
  return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
};

interface HomeState {
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
}

// 記憶體快取，應用生命週期內有效
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

  fetchInitialData: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);

    const { selectedCategory } = get();
    const cacheKey = getCacheKey(selectedCategory);

    // 最近播放不快取，始終即時取得
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
        pageStart: cachedData.data.length,
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
          // .filter((record) => record.progress !== undefined && record.progress > 0 && record.progress < 1)
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

          // 限制快取的資料條目數，但不限制顯示的資料
          const cacheItems = newItems.slice(0, MAX_ITEMS_PER_CACHE);

          // 儲存新快取
          dataCache.set(cacheKey, {
            data: cacheItems,
            timestamp: Date.now(),
            type: selectedCategory.type,
            hasMore: true // 始終為 true，因為我們允許繼續加載
          });

          set({
            contentData: newItems, // 使用完整的新資料
            pageStart: newItems.length,
            hasMore: result.list.length !== 0,
          });
        } else {
          // 增量加載時更新快取
          const existingCache = dataCache.get(cacheKey);
          if (existingCache) {
            // 只有當快取資料少於最大限制時才更新快取
            if (existingCache.data.length < MAX_ITEMS_PER_CACHE) {
              const updatedData = [...existingCache.data, ...newItems];
              const limitedCacheData = updatedData.slice(0, MAX_ITEMS_PER_CACHE);

              dataCache.set(cacheKey, {
                ...existingCache,
                data: limitedCacheData,
                hasMore: true // 始終為 true，因為我們允許繼續加載
              });
            }
          }

          // 更新狀態時使用所有資料
          set((state) => ({
            contentData: [...state.contentData, ...newItems],
            pageStart: state.pageStart + newItems.length,
            hasMore: result.list.length !== 0,
          }));
        }
      } else if (selectedCategory.tags) {
        // 這是容器類別，不載入內容，但清除目前內容
        set({ contentData: [], hasMore: false });
      } else {
        set({ hasMore: false });
      }
    } catch (err: any) {
      let errorMessage = "載入失敗，請重試";

      if (err.message === "API_URL_NOT_SET") {
        errorMessage = "請點擊右上角設定按鈕，配置您的伺服器地址";
      } else if (err.message === "UNAUTHORIZED") {
        errorMessage = "認證失敗，請重新登入";
      } else if (err.message.includes("Network")) {
        errorMessage = "網路連線失敗，請檢查網路連線";
      } else if (err.message.includes("timeout")) {
        errorMessage = "請求逾時，請檢查網路或伺服器狀態";
      } else if (err.message.includes("404")) {
        errorMessage = "伺服器 API 路徑不正確，請檢查伺服器設定";
      } else if (err.message.includes("500")) {
        errorMessage = "伺服器內部錯誤，請聯絡管理員";
      } else if (err.message.includes("403")) {
        errorMessage = "存取被拒絕，請檢查權限設定";
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
          pageStart: cachedData.data.length,
          hasMore: cachedData.hasMore,
          loading: false
        });
      } else {
        // 刪除過期緩存
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
            get().selectCategory(newCategories[0] || null);
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
        return { categories: [initialCategories[0], ...state.categories] };
      }
      if (!hasRecords && recordCategoryExists) {
        const newCategories = state.categories.filter((c) => c.type !== "record");
        if (state.selectedCategory.type === "record") {
          get().selectCategory(newCategories[0] || null);
        }
        return { categories: newCategories };
      }
      return {};
    });

    get().fetchInitialData();
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useHomeStore;