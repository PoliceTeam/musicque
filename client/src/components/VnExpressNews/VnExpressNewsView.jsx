import React, { useCallback, useEffect, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { getVnExpressNews } from '../../services/api';
import {
  CardArticle,
  GridSkeleton,
  HeroArticle,
  NewsState,
  RailSkeleton,
  RowArticle,
} from '../News/ArticleItems';

const SOURCE_LABEL = 'VnExpress · Tin nổi bật';

/**
 * Tin nổi bật trong ngày (RSS vnexpress.net/rss/tin-noi-bat.rss).
 *
 * `variant='rail'` là widget hẹp ở cột phải Home; `variant='reader'` là lưới
 * tạp chí trong NewsReaderModal. Cùng một nguồn dữ liệu, khác cách bày.
 */
const VnExpressNewsView = ({ variant = 'rail' }) => {
  const isReader = variant === 'reader';
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getVnExpressNews();
      setArticles(response.data.data || []);
    } catch (err) {
      console.error('Error fetching VnExpress news:', err);
      setError(err.response?.data?.message || 'Không thể tải tin nổi bật VnExpress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const renderBody = () => {
    if (loading && articles.length === 0) {
      return isReader ? <GridSkeleton /> : <RailSkeleton />;
    }

    if (error) {
      return <NewsState message={error} onRetry={fetchNews} />;
    }

    if (articles.length === 0) {
      return <NewsState message="Chưa có tin tức" />;
    }

    if (isReader) {
      return (
        <div className="news-grid">
          {articles.map((article, index) => (
            <CardArticle key={article.link} article={article} lead={index === 0} />
          ))}
        </div>
      );
    }

    const [hero, ...rest] = articles;

    return (
      <div className="news-list">
        <HeroArticle article={hero} />
        {rest.map((article) => (
          <RowArticle key={article.link} article={article} />
        ))}
      </div>
    );
  };

  return (
    <div className="news-view" style={{ '--news-accent': '#e11d48' }}>
      <div className="news-toolbar">
        <span className="news-source">
          <span className="news-source__dot" />
          {SOURCE_LABEL}
        </span>
        <button
          type="button"
          className="news-refresh"
          onClick={fetchNews}
          disabled={loading}
          aria-label="Tải lại tin nổi bật"
          title="Tải lại"
        >
          <ReloadOutlined spin={loading} />
        </button>
      </div>

      {/* Chiều cao do khung cha quyết định (.sp-newsdock / .news-reader) */}
      <div className="news-scroll">{renderBody()}</div>
    </div>
  );
};

export default VnExpressNewsView;
