import React, { useContext } from 'react';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { getYouTubeThumbnail } from '../../utils/reactions';
import { getAvatarColor, getInitials } from '../../utils/avatar';
import SkipNextButton from './SkipNextButton';

// Ba vạch equalizer nhấp nháy — dấu hiệu "đang phát" quen thuộc của Spotify
const Equalizer = () => (
  <span className="sp-eq" aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
);

const NowPlayingBar = () => {
  const { currentSong, currentSession, skipState, contributeToSkip } = useContext(PlaylistContext);

  if (!currentSession || !currentSong) {
    return null;
  }

  const thumbnail = getYouTubeThumbnail(currentSong.youtubeId);
  const addedBy =
    currentSong.addedBy?.displayName || currentSong.addedBy?.username || 'Ẩn danh';

  return (
    <div data-testid="now-playing-bar" className="sp-nowplaying">
      {thumbnail ? (
        <img className="sp-nowplaying__art" src={thumbnail} alt="" />
      ) : (
        <span className="sp-nowplaying__art" style={{ background: 'var(--sp-surface-active)' }} />
      )}

      <div className="sp-nowplaying__meta">
        <span className="sp-nowplaying__label">
          <Equalizer />
          Đang phát
        </span>
        <div className="sp-track__title" title={currentSong.title}>
          {currentSong.title}
        </div>
        <div className="sp-track__sub">
          <span className="sp-avatar" style={{ background: getAvatarColor(addedBy), width: 18, height: 18, fontSize: 9 }}>
            {getInitials(addedBy)}
          </span>
          <span>{addedBy}</span>
          {currentSong.message && (
            <>
              <span aria-hidden="true">·</span>
              <span className="sp-track__note">“{currentSong.message}”</span>
            </>
          )}
        </div>
      </div>

      <SkipNextButton
        songId={currentSong._id}
        skipState={skipState}
        onContribute={contributeToSkip}
      />
    </div>
  );
};

export default NowPlayingBar;
