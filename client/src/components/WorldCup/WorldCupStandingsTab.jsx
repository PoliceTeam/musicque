import React from "react";
import { Table, Typography, Select } from "antd";
import { getTeamFlag, getTeamAbbreviation } from "../../utils/worldCupUtils";

const { Text } = Typography;

const WorldCupStandingsTab = ({
  standings,
  selectedGroup,
  onGroupChange,
  getTeamFlagUrl,
}) => {
  if (!standings) return null;

  const groups = Array.isArray(standings) ? standings : Object.values(standings);
  const filteredGroups = selectedGroup === "all"
    ? groups
    : groups.filter(g => g.groupName === selectedGroup);

  const columns = [
    {
      title: "Hạng",
      dataIndex: "rank",
      key: "rank",
      width: 60,
      align: 'center',
      render: (rank) => (
        <span style={{ fontWeight: 700, color: rank <= 2 ? 'var(--wc-text-primary)' : 'var(--wc-text-secondary)' }}>{rank}</span>
      ),
    },
    {
      title: "Đội tuyển",
      dataIndex: "team",
      key: "team",
      render: (text) => {
        const flagEmoji = getTeamFlag(text);
        const flagUrl = getTeamFlagUrl ? getTeamFlagUrl(text) : null;
        
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--wc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {flagUrl ? (
                <img src={flagUrl} alt={`${text} flag`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : flagEmoji ? (
                <span style={{ fontSize: 16, lineHeight: 1 }}>{flagEmoji}</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700 }}>{getTeamAbbreviation(text)}</span>
              )}
            </div>
            <span style={{ fontWeight: 600 }}>{text || "TBD"}</span>
          </div>
        );
      },
    },
    {
      title: "W-D-L",
      key: "form",
      align: 'center',
      render: (_, record) => (
        <span style={{ fontSize: 13, color: 'var(--wc-text-secondary)' }}>
          {record.won}-{record.drawn}-{record.lost}
        </span>
      ),
    },
    {
      title: "HS",
      dataIndex: "goalDifference",
      key: "goalDifference",
      width: 60,
      align: 'center',
      render: (val) => <span style={{ color: 'var(--wc-text-secondary)' }}>{val > 0 ? `+${val}` : val}</span>,
    },
    {
      title: "Điểm",
      dataIndex: "points",
      key: "points",
      width: 70,
      align: 'center',
      render: (val) => <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--wc-text-primary)' }}>{val}</span>,
    },
  ];

  return (
    <div>
      <div className="wc-schedule-toolbar">
        <Select
          value={selectedGroup}
          onChange={onGroupChange}
          style={{ width: 160 }}
          bordered={false}
          className="is-dark-bg-secondary"
          dropdownStyle={{ borderRadius: 12 }}
          options={[
            { value: "all", label: "Tất cả bảng đấu" },
            ...groups.map(g => ({
              value: g.groupName,
              label: `Bảng ${g.groupName}`,
            })),
          ]}
        />
      </div>

      <div className="wc-standings-grid">
        {filteredGroups.map(group => (
          <div key={group.groupName} className="wc-standing-card">
            <div style={{ padding: '0 8px 16px', marginBottom: 8, borderBottom: '1px solid var(--wc-border)' }}>
              <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--wc-text-primary)' }}>Bảng {group.groupName}</h3>
            </div>
            <Table
              dataSource={group.teams}
              columns={columns}
              rowKey="team"
              pagination={false}
              size="small"
              rowClassName={(record) => record.rank <= 2 ? 'is-top-team' : ''}
              style={{
                '--ant-table-header-bg': 'transparent',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldCupStandingsTab;
