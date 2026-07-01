import React, { useContext, useEffect, useRef, useState } from "react";
import { Alert, Spin, Empty } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  getWorldCupBracket,
  getWorldCupMatches,
  getWorldCupStandings,
} from "../../services/api";
import { PlaylistContext } from "../../contexts/PlaylistContext";

import "./WorldCup.css";

import {
  STATUS_MAP,
  formatKickoff,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  isLiveMatch,
  isTodayMatch,
  groupMatchesByDate,
} from "../../utils/worldCupUtils";

import WorldCupHero from "./WorldCupHero";
import WorldCupLiveRail from "./WorldCupLiveRail";
import WorldCupSegmentedNav from "./WorldCupSegmentedNav";
import WorldCupScheduleTab from "./WorldCupScheduleTab";
import WorldCupStandingsTab from "./WorldCupStandingsTab";
import WorldCupBracketTab from "./WorldCupBracketTab";
import MatchDetailModal from "./MatchDetailModal";

const WorldCupScheduleView = () => {
  const { socket } = useContext(PlaylistContext);
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [standings, setStandings] = useState(null);
  const [bracket, setBracket] = useState(null);
  
  const [socketConnected, setSocketConnected] = useState(true); // default true assuming socket is connected

  const fetchTournamentDetails = async () => {
    const [standingsResult, bracketResult] = await Promise.allSettled([
      getWorldCupStandings(),
      getWorldCupBracket(),
    ]);

    if (standingsResult.status === "fulfilled") {
      const payload = standingsResult.value.data.data;
      setStandings(payload?.groups || payload);
    }
    if (bracketResult.status === "fulfilled") {
      const payload = bracketResult.value.data.data;
      setBracket(payload?.rounds || payload);
    }
  };

  const fetchSchedule = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await getWorldCupMatches(104);
      if (response.data && response.data.data) {
        setSchedule(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch WC matches", err);
      if (!schedule) setError(err.message || "Failed to load schedule");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    fetchTournamentDetails();
  }, []);

  // Socket IO logic
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    const handleScheduleUpdated = (data) => {
      if (data && Array.isArray(data.matches)) {
        setSchedule(data);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("world_cup_schedule_updated", handleScheduleUpdated);

    // Initial check
    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("world_cup_schedule_updated", handleScheduleUpdated);
    };
  }, [socket]);

  // Fallback timer
  useEffect(() => {
    if (schedule?.refreshAfterMs && schedule.refreshAfterMs > 0) {
      const timer = setTimeout(() => {
        fetchSchedule(true);
      }, schedule.refreshAfterMs);
      return () => clearTimeout(timer);
    }
  }, [schedule]);

  // Visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSchedule(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (loading && !schedule) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !schedule) {
    return (
      <div style={{ padding: "100px 20px", maxWidth: 600, margin: "0 auto" }}>
        <Alert
          message="Lỗi Tải Dữ Liệu World Cup"
          description={error}
          type="error"
          showIcon
          action={
            <button onClick={() => fetchSchedule()} style={{ background: 'none', border: '1px solid currentColor', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>
              <ReloadOutlined /> Thử lại
            </button>
          }
        />
      </div>
    );
  }

  const matches = schedule?.matches || [];
  const liveMatches = matches.filter(isLiveMatch);
  const todayMatches = matches.filter(isTodayMatch);

  return (
    <div className="wc-page">
      {matches.length ? (
        <>
          <WorldCupHero 
            matches={matches} 
            liveMatches={liveMatches} 
            todayMatches={todayMatches} 
            socketConnected={socketConnected}
            lastUpdatedAt={schedule?.updatedAt || schedule?.lastUpdatedAt}
          />

          <WorldCupLiveRail 
            liveMatches={liveMatches}
            getTeamFlag={getTeamFlag}
            getTeamFlagUrl={getTeamFlagUrl}
            getGroupLabel={getGroupLabel}
            formatKickoff={formatKickoff}
            STATUS_MAP={STATUS_MAP}
            onSelectMatch={setSelectedMatch}
          />

          <WorldCupSegmentedNav 
            activeTab={activeTab} 
            onChange={setActiveTab} 
          />

          <div style={{ marginTop: 24 }}>
            {activeTab === "schedule" && (
              <WorldCupScheduleTab 
                matches={matches}
                STATUS_MAP={STATUS_MAP}
                getTeamFlag={getTeamFlag}
                getTeamFlagUrl={getTeamFlagUrl}
                getGroupLabel={getGroupLabel}
                formatKickoff={formatKickoff}
                onSelectMatch={setSelectedMatch}
                groupMatchesByDate={groupMatchesByDate}
              />
            )}
            
            {activeTab === "standings" && (
              <WorldCupStandingsTab 
                standings={standings}
                selectedGroup={selectedGroup}
                onGroupChange={setSelectedGroup}
                getTeamFlagUrl={getTeamFlagUrl}
              />
            )}

            {activeTab === "bracket" && (
              <WorldCupBracketTab 
                bracket={bracket}
                STATUS_MAP={STATUS_MAP}
                isLiveMatch={isLiveMatch}
                getTeamFlag={getTeamFlag}
                getTeamFlagUrl={getTeamFlagUrl}
                getGroupLabel={getGroupLabel}
                formatKickoff={formatKickoff}
                onSelectMatch={setSelectedMatch}
              />
            )}
          </div>
        </>
      ) : (
        <div className="wc-empty-state">
          <Empty description="Chưa có dữ liệu World Cup 2026" />
        </div>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        open={!!selectedMatch}
        match={selectedMatch}
        status={
          selectedMatch
            ? STATUS_MAP[String(selectedMatch.status).toLowerCase()] || STATUS_MAP.scheduled
            : STATUS_MAP.scheduled
        }
        onClose={() => setSelectedMatch(null)}
        getTeamFlag={getTeamFlag}
        getTeamFlagUrl={getTeamFlagUrl}
        getGroupLabel={getGroupLabel}
        formatKickoff={formatKickoff}
      />
    </div>
  );
};

export default WorldCupScheduleView;
