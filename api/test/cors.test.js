const test = require('node:test')
const assert = require('node:assert/strict')
const { getAllowedOrigins, createCorsOrigin } = require('../utils/cors')

test('mở rộng localhost và 127.0.0.1 trên cùng cổng', () => {
  assert.deepEqual(getAllowedOrigins('http://localhost:8080'), [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ])
})

test('hỗ trợ nhiều origin cấu hình bằng dấu phẩy', () => {
  assert.deepEqual(getAllowedOrigins('https://musicque.example, http://localhost:8080'), [
    'https://musicque.example',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ])
})

test('từ chối origin ngoài danh sách nhưng cho phép request không có origin', async () => {
  const validate = createCorsOrigin(['http://localhost:8080'])

  await new Promise((resolve) => validate(undefined, (error, allowed) => {
    assert.equal(error, null)
    assert.equal(allowed, true)
    resolve()
  }))

  await new Promise((resolve) => validate('http://example.com', (error) => {
    assert.match(error.message, /Origin không được phép/)
    resolve()
  }))
})
