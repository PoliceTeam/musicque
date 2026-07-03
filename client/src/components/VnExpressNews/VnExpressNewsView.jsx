import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Alert, Button, Empty, Skeleton } from 'antd';
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
      bordered={false}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          <ReadOutlined />
          Du lịch VnExpress
        </span>
      }
      extra={
        <Button
          type="text"
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchNews}
          disabled={loading}
        />
      }
      styles={{ body: { padding: 0 } }}
      headStyle={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}
      style={{
        background: 'transparent',
        borderRadius: 24,
      }}
    >
      <div style={{ height: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
        {loading && articles.length === 0 ? (
        <div style={{ padding: '16px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <Skeleton.Button active block style={{ height: 120, borderRadius: 16, marginBottom: 8 }} />
              <Skeleton active title={{ width: '90%' }} paragraph={{ rows: 3, width: ['100%', '100%', '70%'] }} />
              <Skeleton.Button active size="small" style={{ width: 100, height: 14, marginTop: 8 }} />
            </div>
          ))}
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
                padding: '24px',
                borderBottom: '1px solid var(--border)',
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
                    height: 140,
                    objectFit: 'cover',
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                  loading="lazy"
                />
              )}
              <Text
                strong
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                  fontSize: 15,
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
      </div>
    </Card>
  );
};

export default VnExpressNewsView;
