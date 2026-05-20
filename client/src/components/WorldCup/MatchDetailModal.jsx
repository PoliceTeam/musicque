import React from "react";
import { Modal, Space, Tag, Typography } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";

const { Text } = Typography;

const normalizePlayers = (match, side) => {
  const squad = match?.squads?.[side] || match?.[`${side}Squad`] || match?.lineups?.[side] || [];
  return Array.isArray(squad) ? squad : [];
};

const PlayerList = ({ title, players }) => (
  <div className="wc-squad-panel">
    <Text strong>{title}</Text>
    <div style={{ marginTop: 8 }}>
      {players.length ? (
        players.map((player, index) => (
          <div className="wc-player-row" key={player.id || player.name || index}>
            <Text type="secondary">#{player.number || player.shirtNumber || "-"}</Text>
            <div>
              <Text strong>{player.name || player.player_name || "TBD"}</Text>
              <Text type="secondary" style={{ display: "block", fontSize: 11 }}>
                {player.position || player.role || "Position TBD"}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {player.club || player.team || ""}
            </Text>
          </div>
        ))
      ) : null}
    </div>
  </div>
);

const getTeamAbbreviation = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

const TeamHero = ({ name, align, getTeamFlag, getTeamFlagUrl }) => {
  const flagUrl = getTeamFlagUrl?.(name);
  const emoji = getTeamFlag?.(name);

  return (
    <div className={`wc-team-hero ${align === "right" ? "is-right" : ""}`}>
      <span className="wc-hero-flag">
        {flagUrl ? (
          <img src={flagUrl} alt={`${name} flag`} />
        ) : emoji ? (
          emoji
        ) : (
          <span className="wc-flag-fallback" style={{ fontSize: "20px" }}>{getTeamAbbreviation(name)}</span>
        )}
      </span>
      <Text strong style={{ fontSize: 20, lineHeight: 1.2 }}>
        {name || "TBD"}
      </Text>
    </div>
  );
};

const MatchDetailModal = ({
  match,
  open,
  onClose,
  status,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
}) => {
  const homePlayers = normalizePlayers(match, "home");
  const awayPlayers = normalizePlayers(match, "away");

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={760}
      className="wc-modal"
    >
      {match && (
        <div className="wc-modal-shell">
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <div className="wc-section-head" style={{ paddingRight: 34 }}>
              <Space size={8} wrap>
                <Tag color="blue" style={{ margin: 0 }}>
                  {getGroupLabel(match)}
                </Tag>
                <Tag color={status.color} style={{ margin: 0 }}>
                  {status.label}
                </Tag>
              </Space>
              <Text type="secondary">Match preview</Text>
            </div>

            <div
              className="wc-modal-scoreboard"
              transition={{ duration: 0.24 }}
            >
              <TeamHero name={match.homeTeam} getTeamFlag={getTeamFlag} getTeamFlagUrl={getTeamFlagUrl} />
              <div>
                <Text type="secondary" style={{ display: "block", textAlign: "center", fontSize: 11 }}>
                  SCORE
                </Text>
                <div className="wc-big-score">
                  {match.homeScore !== null && match.awayScore !== null
                    ? `${match.homeScore}-${match.awayScore}`
                    : "VS"}
                </div>
              </div>
              <TeamHero name={match.awayTeam} align="right" getTeamFlag={getTeamFlag} getTeamFlagUrl={getTeamFlagUrl} />
            </div>

            <div className="wc-info-grid">
              <div className="wc-info-tile">
                <Text type="secondary" style={{ fontSize: 11 }}>
                  THỜI GIAN (GIỜ VN) {' '}
                </Text>
                <div className="wc-time-value">
                  <ClockCircleOutlined /> <Text strong>{formatKickoff(match.kickoffUtc)}</Text>
                </div>
              </div>
              <div className="wc-info-tile">
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SÂN / THÀNH PHỐ
                </Text>
                <div style={{ marginTop: 6 }}>
                  <EnvironmentOutlined />{" "}
                  <Text strong>{[match.stadium, match.city].filter(Boolean).join(", ") || "Chưa cập nhật"}</Text>
                </div>
              </div>
            </div>

            {(homePlayers.length > 0 || awayPlayers.length > 0) && (
              <div className="wc-squad-grid">
                <PlayerList title={match.homeTeam || "Đội nhà"} players={homePlayers} />
                <PlayerList title={match.awayTeam || "Đội khách"} players={awayPlayers} />
              </div>
            )}
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default MatchDetailModal;
