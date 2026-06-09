import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Alert, Button, Empty } from 'antd';
import { ReloadOutlined, ReadOutlined } from '@ant-design/icons';
import { getVnExpressNews } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const { Text, Paragraph } = Typography;

const formatPubDate = (pubDate) => {
  if (!pubDate) return '';
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return pubDate;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const VnExpressNewsView = () => {
  const { isDark } = useTheme();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getVnExpressNews();
      setArticles(response.data.data || []);
    } catch (err) {
      console.error('Error fetching VnExpress news:', err);
      setError(err.response?.data?.message || 'Không thể tải tin tức VnExpress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ReadOutlined />
          Du lịch VnExpress
        </span>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchNews}
          disabled={loading}
        />
      }
      styles={{
        body: {
          padding: 0,
        },
      }}
      style={{
        background: isDark ? '#1f1f1f' : '#fff',
        borderColor: isDark ? '#434343' : '#f0f0f0',
      }}
    >
      {loading && articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ margin: 16 }}
          action={
            <Button size="small" onClick={fetchNews}>
              Thử lại
            </Button>
          }
        />
      ) : articles.length === 0 ? (
        <Empty description="Chưa có tin tức" style={{ padding: '24px 16px' }} />
      ) : (
        <div className="vnexpress-news-list">
          {articles.map((article) => (
            <a
              key={article.link}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="vnexpress-news-item"
              style={{
                display: 'block',
                padding: '12px 16px',
                borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  loading="lazy"
                />
              )}
              <Text
                strong
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: isDark ? '#fff' : '#141414',
                  lineHeight: 1.4,
                }}
              >
                {article.title}
              </Text>
              {article.summary && (
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 3 }}
                  style={{ marginBottom: 6, fontSize: 13 }}
                >
                  {article.summary}
                </Paragraph>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatPubDate(article.pubDate)}
              </Text>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
};

export default VnExpressNewsView;
