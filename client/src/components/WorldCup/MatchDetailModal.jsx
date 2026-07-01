import React from "react";
import { Modal, Space, Tag, Typography } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { getTeamAbbreviation } from "../../utils/worldCupUtils";

const { Text } = Typography;

const normalizePlayers = (match, side) => {
  const squad = match?.squads?.[side] || match?.[`${side}Squad`] || match?.lineups?.[side] || [];
  return Array.isArray(squad) ? squad : [];
};

const PlayerList = ({ title, players }) => (
  <div>
    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--wc-text-primary)' }}>{title}</span>
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {players.length ? (
        players.map((player, index) => (
          <div key={player.id || player.name || index} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--wc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--wc-text-secondary)' }}>
              {player.number || player.shirtNumber || "-"}
            </div>
            <div>
              <span style={{ display: "block", lineHeight: 1.2, fontWeight: 700, fontSize: 15, color: 'var(--wc-text-primary)' }}>{player.name || player.player_name || "TBD"}</span>
              <span style={{ fontSize: 13, color: 'var(--wc-text-secondary)', fontWeight: 500 }}>
                {player.position || player.role || "Position TBD"}
                {player.club || player.team ? ` • ${player.club || player.team}` : ""}
              </span>
            </div>
          </div>
        ))
      ) : (
        <span style={{ color: 'var(--wc-text-secondary)' }}>Đội hình sẽ được cập nhật trước giờ bóng lăn.</span>
      )}
    </div>
  </div>
);

const TeamHero = ({ name, align, getTeamFlag, getTeamFlagUrl }) => {
  const flagUrl = getTeamFlagUrl?.(name);
  const emoji = getTeamFlag?.(name);

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: 20, textAlign: align, minWidth: 0 }}>
      <div className="wc-team__flag" style={{ width: 80, height: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--wc-border)' }}>
        {flagUrl ? (
          <img src={flagUrl} alt={`${name} flag`} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : emoji ? (
          <span style={{ fontSize: 56, lineHeight: 1 }}>{emoji}</span>
        ) : (
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--wc-text-secondary)' }}>{getTeamAbbreviation(name)}</span>
        )}
      </div>
      <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--wc-text-primary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {name || "TBD"}
      </span>
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
      className="wc-detail-modal"
    >
      {match && (
        <div>
          <div style={{ padding: '24px 32px 0' }}>
            <Space size={8} wrap style={{ marginBottom: 16 }}>
              <Tag color="blue" style={{ margin: 0, borderRadius: 999 }}>
                {getGroupLabel(match)}
              </Tag>
              <Tag color={status.color} style={{ margin: 0, borderRadius: 999 }}>
                {status.label}
              </Tag>
            </Space>
          </div>

          <div className="wc-detail-scoreboard" style={{ gap: 24 }}>
            <TeamHero name={match.homeTeam} getTeamFlag={getTeamFlag} getTeamFlagUrl={getTeamFlagUrl} />
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div className="wc-score" style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', whiteSpace: 'nowrap' }}>
                {match.homeScore !== null && match.awayScore !== null
                  ? `${match.homeScore} - ${match.awayScore}`
                  : <span style={{ color: 'var(--wc-border-hover)' }}>VS</span>}
              </div>
            </div>
            <TeamHero name={match.awayTeam} align="right" getTeamFlag={getTeamFlag} getTeamFlagUrl={getTeamFlagUrl} />
          </div>

          <div className="wc-detail-info-grid">
            <div className="wc-detail-info-tile">
              <span className="wc-detail-info-tile-label">THỜI GIAN (GIỜ VN)</span>
              <div className="wc-detail-info-tile-value">
                <ClockCircleOutlined style={{ marginRight: 8, color: 'var(--wc-accent)' }} />
                <span>{formatKickoff(match.kickoffUtc)}</span>
              </div>
            </div>
            <div className="wc-detail-info-tile">
              <span className="wc-detail-info-tile-label">SÂN / THÀNH PHỐ</span>
              <div className="wc-detail-info-tile-value">
                <EnvironmentOutlined style={{ marginRight: 8, color: 'var(--wc-accent)' }} />
                <span>{[match.stadium, match.city].filter(Boolean).join(", ") || "Chưa cập nhật"}</span>
              </div>
            </div>
          </div>

          <div className="wc-squad-grid">
            <PlayerList title={match.homeTeam || "Đội nhà"} players={homePlayers} />
            <PlayerList title={match.awayTeam || "Đội khách"} players={awayPlayers} />
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MatchDetailModal;
