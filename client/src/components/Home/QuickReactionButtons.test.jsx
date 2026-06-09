import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickReactionButtons from './QuickReactionButtons';

describe('QuickReactionButtons', () => {
  it('calls onVote with mapped vote type when emoji is clicked', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
      />,
    );

    await user.click(screen.getByLabelText('Fire upvote'));
    expect(onVote).toHaveBeenCalledWith('song-1', 'up', '🔥');

    await user.click(screen.getByLabelText('Downvote'));
    expect(onVote).toHaveBeenCalledWith('song-1', 'down', '👎');
  });

  it('does not call vote when clicking another up emoji while already upvoted', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
        userVote="up"
        lastReactionEmoji="🔥"
      />,
    );

    await user.click(screen.getByLabelText('Clap upvote'));
    expect(onVote).not.toHaveBeenCalled();
  });

  it('does not unvote when pressing the same up emoji again', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
        userVote="up"
        lastReactionEmoji="🔥"
      />,
    );

    await user.click(screen.getByLabelText('Fire upvote'));
    expect(onVote).not.toHaveBeenCalled();
  });

  it('clears vote when pressing the balance icon', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
        userVote="up"
        lastReactionEmoji="🔥"
      />,
    );

    await user.click(screen.getByLabelText('Balanced - remove vote'));
    expect(onVote).toHaveBeenCalledWith('song-1', 'neutral', '⚖️');
  });

  it('ignores balance icon when there is no vote', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
        userVote={null}
      />,
    );

    await user.click(screen.getByLabelText('Balanced - remove vote'));
    expect(onVote).not.toHaveBeenCalled();
  });

  it('does not vote when disabled', async () => {
    const user = userEvent.setup();
    const onVote = vi.fn().mockResolvedValue(true);

    render(
      <QuickReactionButtons
        songId="song-1"
        onVote={onVote}
        disabled
      />,
    );

    await user.click(screen.getByLabelText('Fire upvote'));
    expect(onVote).not.toHaveBeenCalled();
  });
});
