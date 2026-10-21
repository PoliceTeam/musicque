import { afterEach, expect, it, vi } from 'vitest'
const post = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { create: () => ({ post, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } }) } }))
import { handoff } from './api'
afterEach(() => vi.restoreAllMocks())
it('POST token trong form ẩn tới tab đã mở, không đặt token trên URL', async () => {
  post.mockResolvedValue({ data: { url: 'https://farm.test/auth/handoff', token: 'test-token' } })
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function () {
    expect(this.method).toBe('post')
    expect(this.target).toBe('farm-tab')
    expect(this.action).toBe('https://farm.test/auth/handoff')
    expect(this.hidden).toBe(true)
    expect(this.elements.token.value).toBe('test-token')
  })
  await handoff('musicque-farm', 'farm-tab')
  expect(post).toHaveBeenCalledWith('/api/auth/handoff', { target: 'musicque-farm' })
  expect(submit).toHaveBeenCalledOnce()
  expect(document.querySelector('form')).toBeNull()
})

it('xóa form chứa token ngay cả khi submit thất bại', async () => {
  post.mockResolvedValue({ data: { url: 'https://farm.test/auth/handoff', token: 'test-token' } })
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => { throw new Error('submit failed') })
  await expect(handoff('musicque-farm', 'farm-tab')).rejects.toThrow('submit failed')
  expect(document.querySelector('form')).toBeNull()
})
