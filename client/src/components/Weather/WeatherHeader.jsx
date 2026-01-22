import React, { useState, useEffect } from "react";
import { Typography } from "antd";
import { getCurrentWeather } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";

const { Text } = Typography;

// Weather condition icons
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

const WeatherHeader = () => {
  const { isDark } = useTheme();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await getCurrentWeather();
        setWeather(response.data.data);
      } catch (err) {
        console.error("Error fetching weather:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  const getWeatherIcon = (conditionCode, conditionText, tempC) => {
    const code = conditionCode;
    const text = conditionText?.toLowerCase() || "";

    // Temperature-based icons
    if (tempC < 15) {
      return <ColdIcon size={32} color={isDark ? "#1890ff" : "#1890ff"} />;
    } else if (tempC > 30) {
      return <HotIcon size={32} color={isDark ? "#ff4d4f" : "#ff4d4f"} />;
    }

    // Condition-based icons
    if (
      (code >= 1150 && code <= 1201) ||
      (code >= 1240 && code <= 1246) ||
      code === 1063 || code === 1087 ||
      (code >= 1273 && code <= 1276) || code === 1282 ||
      text.includes("rain") || text.includes("drizzle") || text.includes("shower")
    ) {
      return <RainIcon size={32} color={isDark ? "#1890ff" : "#1890ff"} />;
    }

    if (code === 1000 || text.includes("sunny") || text.includes("clear")) {
      return <SunnyIcon size={32} color={isDark ? "#faad14" : "#faad14"} />;
    }

    return <CloudyIcon size={32} color={isDark ? "#8c8c8c" : "#8c8c8c"} />;
  };

  if (loading || !weather || !weather.current) {
    return null;
  }

  const { current } = weather;
  const tempC = current.temp_c;
  const feelsLikeC = current.feelslike_c;
  const conditionCode = current.condition?.code;
  const conditionText = current.condition?.text;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "12px",
        marginLeft: "20px",
        paddingLeft: "20px",
        borderLeft: `1px solid ${isDark ? "#434343" : "#f0f0f0"}`,
      }}
    >
      {getWeatherIcon(conditionCode, conditionText, tempC)}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "2px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            gap: "4px",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: isDark ? "#fff" : "#000",
            }}
          >
            {Math.round(tempC)}
          </span>
          <span
            style={{
              fontSize: "14px",
              color: isDark ? "#8c8c8c" : "#8c8c8c",
            }}
          >
            °C
          </span>
        </div>
        <Text
          style={{
            fontSize: "11px",
            color: isDark ? "#8c8c8c" : "#8c8c8c",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Cảm giác như {Math.round(feelsLikeC)}°
        </Text>
      </div>
    </div>
  );
};

export default WeatherHeader;
