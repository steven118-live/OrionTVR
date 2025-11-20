import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { API } from '@/services/api';

// 導入不同平台的VideoCard組件
import VideoCardMobile from './VideoCard.mobile';
import VideoCardTablet from './VideoCard.tablet';
import VideoCardTV from './VideoCard.tv';

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

/**
 * ������ 修正點 1: 使用 React.memo 包裹整個組件
 * 這確保當 CustomScrollView (父組件) 由於不相關的狀態變更而重新渲染時，
 * 只要傳遞給 VideoCard 的 props 沒有變動，就不會重新執行選擇邏輯。
 */
const VideoCardComponent = React.forwardRef<any, VideoCardProps>((props, ref) => {
  const { deviceType } = useResponsiveLayout();

  switch (deviceType) {
    case 'mobile':
      return <VideoCardMobile {...props} ref={ref} />;
    
    case 'tablet':
      return <VideoCardTablet {...props} ref={ref} />;
    
    case 'tv':
    default:
      // 確保所有 TV 焦點和點擊事件的 props 都被正確傳遞給 VideoCardTV
      return <VideoCardTV {...props} ref={ref} />;
  }
});

VideoCardComponent.displayName = 'VideoCard';

// 導出 memo 化後的組件
const VideoCard = React.memo(VideoCardComponent);

export default VideoCard;
