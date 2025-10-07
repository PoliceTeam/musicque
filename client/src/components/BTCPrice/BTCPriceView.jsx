import React, { useState, useEffect } from "react";
import { Card, Typography, Spin, Alert, Space, Tag, Row, Col } from "antd";
import {
  ReloadOutlined,
  DollarOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { getTodayBTCPrice } from "../../services/api";

const { Text } = Typography;

const BTCPriceView = () => {
  const [btcPrice, setBtcPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBTCPrice = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTodayBTCPrice();
      setBtcPrice(response.data.data);
    } catch (err) {
      console.error("Error fetching BTC price:", err);
      setError(err.response?.data?.message || "Không thể lấy giá Bitcoin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBTCPrice();
  }, []);

  const formatPrice = (price) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatChange = (change) => {
    if (!change) return "N/A";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(change)}`;
  };

  const formatPercent = (percent) => {
    if (!percent) return "N/A";
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getStatusIcon = (change) => {
    if (change > 0) {
      return <CaretUpOutlined style={{ color: "#52c41a" }} />;
    } else if (change < 0) {
      return <CaretDownOutlined style={{ color: "#ff4d4f" }} />;
    } else {
      return <MinusOutlined style={{ color: "#1890ff" }} />;
    }
  };

  const getStatusColor = (change) => {
    if (change > 0) {
      return "success";
    } else if (change < 0) {
      return "error";
    } else {
      return "processing";
    }
  };

  const getStatusText = (change) => {
    if (change > 0) {
      return "Tăng";
    } else if (change < 0) {
      return "Giảm";
    } else {
      return "Giữ nguyên";
    }
  };

  if (loading && !btcPrice) {
    return (
      <Card title="Giá Bitcoin hôm nay" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Đang tải giá Bitcoin...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Giá Bitcoin hôm nay" style={{ height: "100%" }}>
        <Alert
          message="Lỗi tải dữ liệu"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchBTCPrice}
              style={{ cursor: "pointer" }}
            />
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <DollarOutlined style={{ color: "#f7931a" }} />
          Giá Bitcoin hôm nay
        </Space>
      }
    >
      {btcPrice ? (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>₿ Bitcoin (BTC)</Text>
                <Tag color="orange">Crypto</Tag>
              </div>
            </Space>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #f6f9fc 0%, #e9f7fe 100%)",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div style={{ textAlign: "center" }}>
                <Text
                  type="secondary"
                  style={{ fontSize: "12px", textTransform: "uppercase" }}
                >
                  Giá hiện tại tầm tầm
                </Text>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#f7931a",
                  }}
                >
                  {formatPrice(btcPrice.price)}
                </div>
              </div>

              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ textAlign: "center" }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "10px", textTransform: "uppercase" }}
                    >
                      24h Change
                    </Text>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color:
                          btcPrice.priceChange24h >= 0 ? "#52c41a" : "#ff4d4f",
                      }}
                    >
                      {formatChange(btcPrice.priceChange24h)}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: "center" }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "10px", textTransform: "uppercase" }}
                    >
                      24h %
                    </Text>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color:
                          btcPrice.priceChangePercent24h >= 0
                            ? "#52c41a"
                            : "#ff4d4f",
                      }}
                    >
                      {formatPercent(btcPrice.priceChangePercent24h)}
                    </div>
                  </div>
                </Col>
              </Row>
            </Space>
          </div>

          <div style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: "11px" }}>
              Cập nhật từ: {btcPrice.source || "API-Ninjas"}
            </Text>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Text type="secondary">Không có dữ liệu giá Bitcoin</Text>
        </div>
      )}
    </Card>
  );
};

export default BTCPriceView;
