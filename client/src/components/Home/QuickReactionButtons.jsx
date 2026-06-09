import React, { useRef, useState } from 'react';
import { Button, Space } from 'antd';
import { QUICK_REACTIONS, shouldRequestVote, isReactionActive } from '../../utils/reactions';
import './QuickReactionButtons.css';

const QuickReactionButtons = ({
  songId,
  onVote,
  disabled = false,
  userVote = null,
  lastReactionEmoji = null,
}) => {
  const containerRef = useRef(null);
  const [bursts, setBursts] = useState([]);

  const spawnBurst = (emoji, event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setBursts((prev) => [...prev, { id, emoji, x, y }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 900);
  };

  const handleReaction = async (reaction, event) => {
    if (disabled || !onVote) return;

    spawnBurst(reaction.emoji, event);

    if (!shouldRequestVote(userVote, reaction)) {
      return;
    }

    await onVote(songId, reaction.voteType, reaction.emoji);
  };

  return (
    <div ref={containerRef} className="quick-reaction-buttons" data-testid="quick-reaction-buttons">
      <Space size={4}>
        {QUICK_REACTIONS.map((reaction) => {
          const isActive = isReactionActive(userVote, reaction, lastReactionEmoji);

          return (
            <Button
              key={`${songId}-${reaction.emoji}`}
              type={isActive ? 'primary' : 'default'}
              size="small"
              aria-label={reaction.label}
              disabled={disabled}
              onClick={(event) => handleReaction(reaction, event)}
              style={{ minWidth: 34, paddingInline: 6 }}
            >
              {reaction.emoji}
            </Button>
          );
        })}
      </Space>
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="reaction-burst"
          style={{ left: burst.x, top: burst.y }}
          aria-hidden="true"
        >
          {burst.emoji}
        </span>
      ))}
    </div>
  );
};

export default QuickReactionButtons;
