import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Spin, Alert, Button, Empty, Tag, Space, Avatar, Skeleton } from 'antd';
import { ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { Virtuoso } from 'react-virtuoso';
import { getTechNews } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const { Text, Paragraph } = Typography;

const TechNewsWidget = () => {
  const { isDark } = useTheme();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const seedRef = useRef(Math.random());

  const fetchNews = async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const response = await getTechNews(pageNum, 7, seedRef.current);
      const newArticles = response.data.data || [];
      if (pageNum === 1) {
        setArticles(newArticles);
      } else {
        setArticles(prev => [...prev, ...newArticles]);
      }
      setHasMore(response.data.hasMore);
    } catch (err) {
      console.error('Error fetching Tech news:', err);
      if (pageNum === 1) setError(err.response?.data?.message || 'Không thể tải tin tức Công nghệ');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNews(page);
  }, [page]);

  const handleRefresh = () => {
    seedRef.current = Math.random();
    if (page === 1) {
      setArticles([]);
      fetchNews(1);
    } else {
      setArticles([]);
      setPage(1);
    }
  };

  const formatPubDate = (pubDate) => {
    if (!pubDate) return '';
    try {
      const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
      const timeMs = new Date(pubDate).getTime();
      const diffMins = Math.round((timeMs - Date.now()) / (1000 * 60));
      const diffHours = Math.round((timeMs - Date.now()) / (1000 * 60 * 60));
      const diffDays = Math.round((timeMs - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
      if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
      if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
      
      return new Date(pubDate).toLocaleDateString('vi-VN');
    } catch (e) {
      return new Date(pubDate).toLocaleDateString('vi-VN');
    }
  };

  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: isDark ? '#10b981' : '#059669', fontWeight: 'bold' }}>
          <CodeOutlined />
          Tech News
        </span>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={loading || loadingMore} />}
          onClick={handleRefresh}
          disabled={loading || loadingMore}
        />
      }
      styles={{ body: { padding: 0 } }}
      style={{
        background: isDark ? '#1f1f1f' : '#fff',
        borderColor: isDark ? '#434343' : '#f0f0f0',
      }}
    >
      <div style={{ height: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
        {loading && articles.length === 0 ? (
        <div style={{ padding: '16px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ marginBottom: 24 }}>
              <Skeleton.Image style={{ width: '100%', height: 140, marginBottom: 12 }} active />
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ margin: 16 }}
          action={<Button size="small" onClick={() => fetchNews(1)}>Thử lại</Button>}
        />
      ) : articles.length === 0 ? (
        <Empty description="Chưa có tin tức" style={{ padding: '24px 16px' }} />
      ) : (
        <Virtuoso
          className="tech-news-list"
          style={{ height: '100%' }}
          data={articles}
          endReached={() => {
            if (!loading && !loadingMore && hasMore) {
              setPage(prev => prev + 1);
            }
          }}
          overscan={200}
          itemContent={(index, article) => (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="tech-news-item"
              style={{
                display: 'block',
                padding: '16px',
                borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                color: 'inherit',
                textDecoration: 'none',
                transition: 'background-color 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#fafafa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  style={{
                    width: '100%',
                    height: 140,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  loading="lazy"
                />
              )}
              
              <div style={{ marginBottom: 8, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {article.source && (
                  <Tag color={article.source === 'Hacker News' ? '#ff6600' : article.source === 'Dev.to' ? (isDark ? '#3b49df' : '#000000') : article.source === 'Lobsters' ? '#ac0000' : '#0a0a23'} style={{ border: 'none', fontWeight: 'bold', margin: 0 }}>
                    {article.source}
                  </Tag>
                )}
                {article.tags?.slice(0, 3).map(tag => (
                  <Tag key={tag} color={isDark ? "blue-inverse" : "blue"} style={{ border: 'none', margin: 0 }}>
                    #{tag}
                  </Tag>
                ))}
              </div>

              <Text
                strong
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: '15px',
                  color: isDark ? '#fff' : '#141414',
                  lineHeight: 1.4,
                }}
              >
                {article.title}
              </Text>
              
              {article.summary && (
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2 }}
                  style={{ marginBottom: 12, fontSize: 13 }}
                >
                  {article.summary}
                </Paragraph>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={8}>
                  {article.authorImage && <Avatar src={article.authorImage} size="small" />}
                  <Text type="secondary" style={{ fontSize: 12 }}>{article.author}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatPubDate(article.pubDate)}
                </Text>
              </div>
            </a>
          )}
          components={{
            Footer: () => (
              loadingMore ? (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <Spin size="small" />
                </div>
              ) : null
            )
          }}
        />
      )}
      </div>
    </Card>
  );
};

export default TechNewsWidget;
