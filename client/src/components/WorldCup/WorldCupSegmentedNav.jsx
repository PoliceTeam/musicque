import React from "react";

const WorldCupSegmentedNav = ({ activeTab, onChange }) => {
  const tabs = [
    { key: "schedule", label: "Lịch đấu" },
    { key: "standings", label: "Bảng xếp hạng" },
    { key: "bracket", label: "Knockout" },
  ];

  return (
    <div className="wc-segmented-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`wc-pill ${activeTab === tab.key ? "is-active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default WorldCupSegmentedNav;
