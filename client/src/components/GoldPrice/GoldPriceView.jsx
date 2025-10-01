import React, { useState, useEffect } from "react";
import { Card, Typography, Spin, Alert, Space, Tag } from "antd";
import {
  ReloadOutlined,
  DollarOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { getTodayGoldPrice } from "../../services/api";

const { Text } = Typography;

const GoldPriceView = () => {
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGoldPrice = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTodayGoldPrice();
      setGoldPrice(response.data.data);
    } catch (err) {
      console.error("Error fetching gold price:", err);
      setError(err.response?.data?.message || "Không thể lấy giá vàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldPrice();
  }, []);

  const formatPrice = (price) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("vi-VN").format(price) + " VND";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "up":
        return <CaretUpOutlined style={{ color: "#52c41a" }} />;
      case "down":
        return <CaretDownOutlined style={{ color: "#ff4d4f" }} />;
      case "flat":
        return <MinusOutlined style={{ color: "#1890ff" }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "up":
        return "success";
      case "down":
        return "error";
      case "flat":
        return "processing";
      default:
        return "default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "up":
        return "Tăng";
      case "down":
        return "Giảm";
      case "flat":
        return "Giữ nguyên";
      default:
        return "Không xác định";
    }
  };

  if (loading && !goldPrice) {
    return (
      <Card title="Giá vàng hôm nay" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Đang tải giá vàng...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="Giá vàng hôm nay"
        style={{ height: "100%" }}
        extra={
          <ReloadOutlined
            onClick={fetchGoldPrice}
            style={{ cursor: "pointer", color: "#1890ff" }}
          />
        }
      >
        <Alert
          message="Lỗi tải dữ liệu"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchGoldPrice}
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
          <DollarOutlined style={{ color: "#faad14" }} />
          Giá vàng hôm nay
        </Space>
      }
    >
      {goldPrice ? (
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
                <Text>
                  {goldPrice.brand} {goldPrice.hamLuong}
                </Text>
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
                  Giá Chốt Lời
                </Text>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#52c41a",
                  }}
                >
                  +{formatPrice(goldPrice.buyPrice)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <Text
                  type="secondary"
                  style={{ fontSize: "12px", textTransform: "uppercase" }}
                >
                  Giá Tích Luỹ
                </Text>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  -{formatPrice(goldPrice.sellPrice)}
                </div>
              </div>
            </Space>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <Text strong>So với hôm qua:</Text>
            <Tag
              color={getStatusColor(goldPrice.status)}
              icon={getStatusIcon(goldPrice.status)}
            >
              {getStatusText(goldPrice.status)}
            </Tag>
          </div>
          <div style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: "11px" }}>
              {goldPrice.updatedAtText || "Cập nhật từ BTMC"}
            </Text>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Text type="secondary">Không có dữ liệu giá vàng</Text>
        </div>
      )}
    </Card>
  );
};

export default GoldPriceView;
