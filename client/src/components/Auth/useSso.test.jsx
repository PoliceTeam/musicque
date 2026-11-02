import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSso } from './useSso'
const status = vi.hoisted(() => vi.fn())
vi.mock('../../services/api', () => ({ fetchSsoStatus: status }))
afterEach(() => vi.restoreAllMocks())
it('reads SSO availability without opening a popup', async () => {
  status.mockResolvedValue({ data: { enabled: true } })
  const open = vi.spyOn(window, 'open')
  const { result } = renderHook(() => useSso())
  await waitFor(() => expect(result.current.enabled).toBe(true))
  expect(result.current.start).toBeUndefined()
  expect(open).not.toHaveBeenCalled()
})
it('keeps local forms available when SSO is disabled', async () => {
  status.mockResolvedValue({ data: { enabled: false } })
  const { result } = renderHook(() => useSso())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.enabled).toBe(false)
})
