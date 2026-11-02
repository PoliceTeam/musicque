import { beforeEach, expect, it, vi } from 'vitest'
beforeEach(() => { vi.resetModules(); localStorage.clear() })
it('khách đánh dấu ngay và giữ qua lần mở trang mới', async () => {
  const { claimGuestIntro, ICE_CITY_GUEST_SEEN_KEY } = await import('./intro-state')
  expect(await claimGuestIntro()).toBe(true)
  expect(localStorage.getItem(ICE_CITY_GUEST_SEEN_KEY)).toBe('1')
  expect(await claimGuestIntro()).toBe(false)
  vi.resetModules(); const nextVisit = await import('./intro-state')
  expect(await nextVisit.claimGuestIntro()).toBe(false)
})
it('storage bị chặn vẫn chỉ hiện một lần trong lượt mở trang', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  const { claimGuestIntro } = await import('./intro-state')
  expect(await claimGuestIntro()).toBe(true); expect(await claimGuestIntro()).toBe(false)
  get.mockRestore(); set.mockRestore()
})
