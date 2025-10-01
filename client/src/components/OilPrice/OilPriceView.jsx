import React, { useState, useEffect } from "react";
import { Card, Typography, Spin, Alert, Space, Tag, Row, Col } from "antd";
import {
  ReloadOutlined,
  DollarOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { getTodayOilPrice } from "../../services/api";

const { Text } = Typography;

const OilPriceView = () => {
  const [oilPrice, setOilPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOilPrice = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTodayOilPrice();
      setOilPrice(response.data.data);
    } catch (err) {
      console.error("Error fetching oil price:", err);
      setError(err.response?.data?.message || "Không thể lấy giá xăng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOilPrice();
  }, []);

  const formatPrice = (price) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("vi-VN").format(price) + " VND";
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
      return `+${change}`;
    } else if (change < 0) {
      return `${change}`;
    } else {
      return "0";
    }
  };

  if (loading && !oilPrice) {
    return (
      <Card title="Giá xăng hôm nay" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Đang tải giá xăng...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Giá xăng hôm nay" style={{ height: "100%" }}>
        <Alert
          message="Lỗi tải dữ liệu"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchOilPrice}
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
          Giá xăng hôm nay
        </Space>
      }
    >
      {oilPrice && oilPrice.products ? (
        <div>
          <Row gutter={[8, 8]}>
            {oilPrice.products.map((product, index) => (
              <Col span={24} key={index}>
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #f6f9fc 0%, #e9f7fe 100%)",
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ marginBottom: "8px" }}>
                    <Text strong style={{ fontSize: "12px" }}>
                      {product.name}
                    </Text>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: "10px" }}>
                        GIÁ
                      </Text>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "bold",
                          color: "#1890ff",
                        }}
                      >
                        {formatPrice(product.price)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <Text type="secondary" style={{ fontSize: "10px" }}>
                        THAY ĐỔI SO VỚI LẦN GẦN NHẤT
                      </Text>
                      <div>
                        <Tag
                          color={getStatusColor(product.change)}
                          icon={getStatusIcon(product.change)}
                          style={{ margin: 0 }}
                        >
                          {getStatusText(product.change)}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <Text type="secondary" style={{ fontSize: "10px" }}>
              {oilPrice.updatedAtText || "Cập nhật từ: PVOIL"}
            </Text>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Text type="secondary">Không có dữ liệu giá xăng</Text>
        </div>
      )}
    </Card>
  );
};

export default OilPriceView;
