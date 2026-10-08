import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import HomePage from './HomePage'
import { renderWithProviders } from '../test/testUtils'

// HomePage ghép rất nhiều widget; chỉ giữ lại sidebar và thay phần còn lại bằng vỏ rỗng.
vi.mock('../services/api', () => ({ warmupTTS: vi.fn(() => Promise.resolve()) }))
vi.mock('../components/Layout/SidebarNav', () => ({ default: ({ children }) => <nav>{children}</nav> }))
vi.mock('../components/Werewolf/WerewolfLauncher', () => ({ default: () => <div data-banner='werewolf' /> }))
vi.mock('../components/Jungle/JungleLauncher', () => ({ default: () => <div data-banner='jungle' /> }))
vi.mock('../components/Audition/AuditionLauncher', () => ({ default: () => <div data-banner='audition' /> }))
vi.mock('../components/Home/CardGamesPromo', () => ({ default: () => <div data-banner='card-games' /> }))
vi.mock('../components/Playlist/AddSongForm', () => ({ default: () => null }))
vi.mock('../components/Playlist/PlaylistView', () => ({ default: () => null }))
vi.mock('../components/Home/NowPlayingBar', () => ({ default: () => null }))
vi.mock('../components/Home/LiveActivityFeed', () => ({ default: () => null }))
vi.mock('../components/Weather/WeatherHeader', () => ({ default: () => null }))
vi.mock('../components/Auth/UserMenu', () => ({ default: () => null }))
vi.mock('../components/Core/CoreLaunchPopup', () => ({ default: () => null }))
vi.mock('../components/Core/CoreMembershipModal', () => ({ default: () => null }))
vi.mock('../components/Chohan/ChohanPanel', () => ({ default: () => null }))
vi.mock('../components/Billiards/BilliardsPanel', () => ({ default: () => null }))
vi.mock('../components/Lottery/LotteryPanel', () => ({ default: () => null }))
vi.mock('../components/WordChain/WordChainOverlay', () => ({ default: () => null }))
vi.mock('../components/RedLight/RedLightOverlay', () => ({ default: () => null }))
vi.mock('../components/Chat/ChatBox', () => ({ default: () => null }))
vi.mock('../components/TetCountdown/TetCountdown', () => ({ default: () => null }))
vi.mock('../components/NationalDay/NationalDayBanner', () => ({ default: () => null }))
vi.mock('../components/DailyIdiom/DailyIdiom', () => ({ default: () => null }))

it('stacks the game banners under the quick-toys row: Ma Sói, Cờ thú, Neon Dance, then Game bài', () => {
  const { container } = renderWithProviders(<MemoryRouter><HomePage /></MemoryRouter>)
  const order = [...container.querySelectorAll('.sp-quicktoys, [data-banner]')].map(node => node.dataset.banner || 'quick-toys')
  expect(order).toEqual(['quick-toys', 'werewolf', 'jungle', 'audition', 'card-games'])
})
