import React, { useState, useEffect } from "react";
import { Card, Typography, Spin, Alert, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { getCurrentWeather } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";

const { Text } = Typography;

// SVG Icons
const ColdIcon = ({ size = 24, color = "#1890ff" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 19.07L16.24 16.24M19.07 4.93L16.24 7.76M4.93 4.93L7.76 7.76M4.93 19.07L7.76 16.24M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ModerateIcon = ({ size = 24, color = "#52c41a" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2V6M12 18V22M6 12H2M22 12H18M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HotIcon = ({ size = 24, color = "#ff4d4f" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="5" fill={color} />
    <path
      d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const RainIcon = ({ size = 24, color = "#1890ff" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 10C18 7.79 16.21 6 14 6C13.45 6 12.95 6.15 12.5 6.4C12.05 6.15 11.55 6 11 6C8.79 6 7 7.79 7 10C7 10.5 7.1 11 7.25 11.4C7.1 11.6 7 11.8 7 12C7 13.1 7.9 14 9 14H18C19.1 14 20 13.1 20 12C20 11.8 19.9 11.6 19.75 11.4C19.9 11 20 10.5 20 10H18Z"
      fill={color}
    />
    <path
      d="M9 17L8 20M13 17L12 20M17 17L16 20"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const SunnyIcon = ({ size = 24, color = "#faad14" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="5" fill={color} />
    <path
      d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const CloudyIcon = ({ size = 24, color = "#8c8c8c" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 10C18 7.79 16.21 6 14 6C13.45 6 12.95 6.15 12.5 6.4C12.05 6.15 11.55 6 11 6C8.79 6 7 7.79 7 10C7 10.5 7.1 11 7.25 11.4C7.1 11.6 7 11.8 7 12C7 13.1 7.9 14 9 14H18C19.1 14 20 13.1 20 12C20 11.8 19.9 11.6 19.75 11.4C19.9 11 20 10.5 20 10H18Z"
      fill={color}
    />
  </svg>
);

const WeatherView = () => {
  const { isDark } = useTheme();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getCurrentWeather();
      setWeather(response.data.data);
    } catch (err) {
      console.error("Error fetching weather:", err);
      setError(err.response?.data?.message || "Unable to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getTemperatureIcon = (tempC) => {
    if (tempC < 15) {
      return <ColdIcon size={32} color="#1890ff" />;
    } else if (tempC > 30) {
      return <HotIcon size={32} color="#ff4d4f" />;
    } else {
      return <ModerateIcon size={32} color="#52c41a" />;
    }
  };

  const getWeatherConditionIcon = (conditionCode, conditionText) => {
    const code = conditionCode;
    const text = conditionText?.toLowerCase() || "";

    // Rain codes: 1063, 1087, 1150-1201, 1240-1246, 1273-1276, 1282
    if (
      code >= 1150 && code <= 1201 ||
      code >= 1240 && code <= 1246 ||
      code === 1063 || code === 1087 ||
      (code >= 1273 && code <= 1276) || code === 1282 ||
      text.includes("rain") || text.includes("drizzle") || text.includes("shower")
    ) {
      return <RainIcon size={24} color="#1890ff" />;
    }

    // Sunny/Clear codes: 1000
    if (code === 1000 || text.includes("sunny") || text.includes("clear")) {
      return <SunnyIcon size={24} color="#faad14" />;
    }

    // Cloudy codes: 1003, 1006, 1009
    if (code === 1003 || code === 1006 || code === 1009 || text.includes("cloud")) {
      return <CloudyIcon size={24} color="#8c8c8c" />;
    }

    return <CloudyIcon size={24} color="#8c8c8c" />;
  };

  const getTemperatureColor = (tempC) => {
    if (tempC < 15) return "#1890ff";
    if (tempC > 30) return "#ff4d4f";
    return "#52c41a";
  };

  if (loading && !weather) {
    return (
      <Card title="Weather" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Loading weather data...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="Weather"
        style={{ height: "100%" }}
        extra={
          <ReloadOutlined
            onClick={fetchWeather}
            style={{ cursor: "pointer", color: "#1890ff" }}
          />
        }
      >
        <Alert
          message="Error loading data"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchWeather}
              style={{ cursor: "pointer" }}
            />
          }
        />
      </Card>
    );
  }

  if (!weather || !weather.current) {
    return (
      <Card title="Weather" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Text type="secondary">No weather data available</Text>
        </div>
      </Card>
    );
  }

  const { current, location } = weather;
  const tempC = current.temp_c;
  const conditionCode = current.condition?.code;
  const conditionText = current.condition?.text;

  return (
    <Card
      title="Weather"
      style={{ height: "100%" }}
      extra={
        <ReloadOutlined
          onClick={fetchWeather}
          style={{ cursor: "pointer", color: "#1890ff" }}
        />
      }
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          {getTemperatureIcon(tempC)}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                color: getTemperatureColor(tempC),
                lineHeight: 1,
              }}
            >
              {Math.round(tempC)}°C
            </div>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {location?.name || "Unknown"}
            </Text>
          </div>
        </div>

        <div
          style={{
            background: isDark
              ? "linear-gradient(135deg, #1f1f1f 0%, #262626 100%)"
              : "linear-gradient(135deg, #f6f9fc 0%, #e9f7fe 100%)",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {getWeatherConditionIcon(conditionCode, conditionText)}
              <Text>{conditionText || "Unknown"}</Text>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
              }}
            >
              <Text type="secondary">Feels like:</Text>
              <Text strong>{Math.round(current.feelslike_c)}°C</Text>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
              }}
            >
              <Text type="secondary">Humidity:</Text>
              <Text strong>{current.humidity}%</Text>
            </div>
            {current.precip_mm > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <Text type="secondary">Precipitation:</Text>
                <Text strong>{current.precip_mm}mm</Text>
              </div>
            )}
          </Space>
        </div>

        <div style={{ textAlign: "center" }}>
          <Text type="secondary" style={{ fontSize: "11px" }}>
            Updated: {current.last_updated || "Unknown"}
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default WeatherView;
