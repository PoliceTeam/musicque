import React, { useEffect, useState } from "react";
import { Alert, Card, Space, Spin, Tag, Typography } from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { getWorldCupMatches } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";

const { Text } = Typography;

const STATUS_MAP = {
  scheduled: { color: "processing", label: "Sắp đá" },
  live: { color: "red", label: "Đang đá" },
  in_progress: { color: "red", label: "Đang đá" },
  finished: { color: "default", label: "Đã xong" },
  completed: { color: "default", label: "Đã xong" },
};

const formatRound = (match) => {
  if (match.groupName) return `Bảng ${match.groupName}`;
  if (!match.round) return "World Cup 2026";

  return String(match.round)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatKickoff = (kickoffUtc) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoffUtc));

const WorldCupScheduleView = () => {
  const { isDark } = useTheme();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getWorldCupMatches(6);
      setSchedule(response.data.data);
    } catch (err) {
      console.error("Error fetching World Cup schedule:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Không thể lấy lịch thi đấu World Cup"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  if (loading && !schedule) {
    return (
      <Card title="Lịch thi đấu World Cup" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Đang tải lịch thi đấu...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Lịch thi đấu World Cup" style={{ height: "100%" }}>
        <Alert
          message="Lỗi tải dữ liệu"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchSchedule}
              style={{ cursor: "pointer" }}
            />
          }
        />
      </Card>
    );
  }

  const matches = schedule?.matches || [];

  return (
    <Card
      title={
        <Space>
          <TrophyOutlined style={{ color: "#1677ff" }} />
          Lịch thi đấu World Cup
        </Space>
      }
    >
      {matches.length ? (
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          {matches.map((match) => {
            const status =
              STATUS_MAP[String(match.status).toLowerCase()] ||
              STATUS_MAP.scheduled;
            const hasScore =
              match.homeScore !== null && match.awayScore !== null;

            return (
              <div
                key={`${match.id}-${match.kickoffUtc}`}
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, #1f1f1f 0%, #262626 100%)"
                    : "linear-gradient(135deg, #f6f9fc 0%, #eef6ff 100%)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: "11px" }}>
                    {formatRound(match)}
                  </Text>
                  <Tag color={status.color} style={{ margin: 0 }}>
                    {status.label}
                  </Tag>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <Text strong style={{ fontSize: "13px" }}>
                    {match.homeTeam}
                  </Text>
                  <Text strong style={{ color: "#1677ff" }}>
                    {hasScore ? `${match.homeScore} - ${match.awayScore}` : "vs"}
                  </Text>
                  <Text strong style={{ fontSize: "13px", textAlign: "right" }}>
                    {match.awayTeam}
                  </Text>
                </div>

                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Text type="secondary" style={{ fontSize: "11px" }}>
                    <ClockCircleOutlined /> {formatKickoff(match.kickoffUtc)}
                  </Text>
                  {(match.stadium || match.city) && (
                    <Text type="secondary" style={{ fontSize: "11px" }}>
                      <EnvironmentOutlined /> {[match.stadium, match.city]
                        .filter(Boolean)
                        .join(", ")}
                    </Text>
                  )}
                </Space>
              </div>
            );
          })}

          <div style={{ textAlign: "center", marginTop: "6px" }}>
            <Text type="secondary" style={{ fontSize: "10px" }}>
              <CalendarOutlined /> Cập nhật từ:{" "}
              {schedule.source || "WC2026 API"}
            </Text>
          </div>
        </Space>
      ) : (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Text type="secondary">Chưa có lịch thi đấu World Cup</Text>
        </div>
      )}
    </Card>
  );
};

export default WorldCupScheduleView;
