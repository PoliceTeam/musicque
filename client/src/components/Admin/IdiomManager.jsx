import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Button, Tag, Typography, Space, message, Tooltip } from 'antd';
import { ReloadOutlined, LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import { getDailyIdioms, rerollIdioms } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const { Text } = Typography;

// Bỏ xuống dòng để hiển thị gọn trong danh sách
const oneLine = (s) => (s || '').replace(/\s+/g, ' ').trim();

const IdiomManager = () => {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rerolling, setRerolling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getDailyIdioms()
      .then(({ data: res }) => setData(res))
      .catch(() => message.error('Không tải được danh sách câu hôm nay'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReroll = () => {
    setRerolling(true);
    rerollIdioms()
      .then(({ data: res }) => {
        setData(res);
        message.success(`Đã đổi bộ câu (còn ${res.remainingRerolls} lượt)`);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || 'Không re-roll được';
        message.warning(msg);
        // Nếu hết lượt, cập nhật lại số liệu từ server
        if (err?.response?.status === 429) load();
      })
      .finally(() => setRerolling(false));
  };

  const remaining = data?.remainingRerolls ?? 0;
  const idioms = data?.idioms || [];

  return (
    <Card
      title='Câu hôm nay'
      loading={loading}
      extra={
        <Space size={8}>
          <Text type='secondary' style={{ fontSize: 12 }}>
            {data?.date} · còn {remaining} lượt
          </Text>
          <Tooltip title={remaining > 0 ? 'Đổi sang bộ 8 câu khác' : 'Đã hết lượt hôm nay'}>
            <Button
              size='small'
              icon={<ReloadOutlined />}
              loading={rerolling}
              disabled={remaining <= 0}
              onClick={handleReroll}
            >
              Re-roll
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <List
        size='small'
        dataSource={idioms}
        rowKey={(it) => it.id}
        renderItem={(it, idx) => (
          <List.Item
            style={{ alignItems: 'flex-start', gap: 8 }}
            actions={[
              <Tag
                key='like'
                color={it.likes > 0 ? 'green' : 'default'}
                style={{ margin: 0 }}
              >
                <LikeOutlined /> {it.likes}
              </Tag>,
              <Tag
                key='dislike'
                color={it.dislikes > 0 ? 'red' : 'default'}
                style={{ margin: 0 }}
              >
                <DislikeOutlined /> {it.dislikes}
              </Tag>,
            ]}
          >
            <Space align='start' size={8}>
              <Text
                type='secondary'
                style={{ fontVariantNumeric: 'tabular-nums', minWidth: 18 }}
              >
                {idx + 1}.
              </Text>
              <Text style={{ color: isDark ? '#d9d9d9' : '#333' }}>
                {oneLine(it.text)}
              </Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
};

export default IdiomManager;
