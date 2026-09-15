const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test('saveChatImage stores a PNG and returns a chat image URL', async (t) => {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicque-chat-'))
  process.env.CHAT_UPLOAD_DIR = uploadDir
  t.after(() => {
    delete process.env.CHAT_UPLOAD_DIR
    fs.rmSync(uploadDir, { recursive: true, force: true })
  })

  const chatService = require('../services/chat.service')
  const dataUrl = `data:image/png;base64,${PNG_1x1.toString('base64')}`
  const result = await chatService.saveChatImage({ dataUrl })

  assert.match(result.url, /^\/api\/chat\/images\/[A-Za-z0-9._-]+\.png$/)
  const filename = path.basename(result.url)
  const saved = fs.readFileSync(path.join(uploadDir, filename))
  assert.equal(Buffer.compare(saved, PNG_1x1), 0)
})

test('saveChatImage rejects non-image payloads', async () => {
  const chatService = require('../services/chat.service')
  await assert.rejects(
    () => chatService.saveChatImage({ dataUrl: 'data:image/png;base64,not-an-image' }),
    (error) => error.status === 400,
  )
})
