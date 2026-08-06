import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getTechNews } from '../../services/api';
import {
  CardArticle,
  GridSkeleton,
  HeroArticle,
  NewsState,
  RailSkeleton,
  RowArticle,
} from '../News/ArticleItems';

const PAGE_SIZE = 7;

/**
 * Tin công nghệ trộn từ Hacker News / Dev.to / Lobsters.
 *
 * Dùng chung ngôn ngữ thị giác với VnExpressNewsView: `variant='rail'` cho cột
 * phải, `variant='reader'` cho lưới trong NewsReaderModal. Cuộn tới cuối thì
 * nạp thêm trang qua IntersectionObserver.
 */
const TechNewsWidget = ({ variant = 'rail' }) => {
  const isReader = variant === 'reader';
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const seedRef = useRef(Math.random());
  const sentinelRef = useRef(null);

  const fetchNews = useCallback(async (pageNum) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const response = await getTechNews(pageNum, PAGE_SIZE, seedRef.current);
      const newArticles = response.data.data || [];
      setArticles((prev) => (pageNum === 1 ? newArticles : [...prev, ...newArticles]));
      setHasMore(Boolean(response.data.hasMore));
      pageRef.current = pageNum;
    } catch (err) {
      console.error('Error fetching Tech news:', err);
      if (pageNum === 1) {
        setError(err.response?.data?.message || 'Không thể tải tin công nghệ');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(1);
  }, [fetchNews]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchNews(pageRef.current + 1);
  }, [fetchNews, hasMore, loading, loadingMore]);

  // Cuộn chạm đáy thì nạp tiếp — thay cho virtualiser cũ, pool tin vốn chỉ
  // vài chục bài nên không cần ảo hoá.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleRefresh = () => {
    seedRef.current = Math.random();
    pageRef.current = 1;
    setArticles([]);
    setHasMore(true);
    fetchNews(1);
  };

  const renderBody = () => {
    if (loading && articles.length === 0) {
      return isReader ? <GridSkeleton /> : <RailSkeleton hero={false} />;
    }

    if (error) {
      return <NewsState message={error} onRetry={() => fetchNews(1)} />;
    }

    if (articles.length === 0) {
      return <NewsState message="Chưa có tin tức" />;
    }

    if (isReader) {
      return (
        <div className="news-grid">
          {articles.map((article, index) => (
            <CardArticle key={article.id || article.link} article={article} lead={index === 0} />
          ))}
          <div className="news-loadmore" ref={sentinelRef}>
            {loadingMore ? <Spin size="small" /> : null}
          </div>
        </div>
      );
    }

    // Bài đầu chỉ lên hero khi có ảnh — tin HN thường không có, hero trống thì xấu.
    const [first, ...rest] = articles;
    const useHero = Boolean(first.imageUrl);

    return (
      <div className="news-list">
        {useHero ? <HeroArticle article={first} /> : <RowArticle article={first} />}
        {rest.map((article) => (
          <RowArticle key={article.id || article.link} article={article} />
        ))}
        <div className="news-loadmore" ref={sentinelRef}>
          {loadingMore ? <Spin size="small" /> : null}
        </div>
      </div>
    );
  };

  return (
    <div className="news-view" style={{ '--news-accent': '#10b981' }}>
      <div className="news-toolbar">
        <span className="news-source">
          <span className="news-source__dot" />
          Hacker News · Dev.to · Lobsters
        </span>
        <button
          type="button"
          className="news-refresh"
          onClick={handleRefresh}
          disabled={loading || loadingMore}
          aria-label="Trộn lại tin công nghệ"
          title="Trộn lại"
        >
          <ReloadOutlined spin={loading || loadingMore} />
        </button>
      </div>

      {/* Chiều cao do khung cha quyết định (.sp-newsdock / .news-reader) */}
      <div className="news-scroll">{renderBody()}</div>
    </div>
  );
};

export default TechNewsWidget;
