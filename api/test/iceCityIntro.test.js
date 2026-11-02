const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/user.model')
const auth = require('../services/auth.service')
const controller = require('../controllers/auth.controller')

test('claim có điều kiện, hỗ trợ user cũ và chỉ một request thắng', async (t) => {
  const seen = new Set()
  t.mock.method(User, 'updateOne', async (filter, update) => {
    assert.equal(filter.iceCityIntroSeenAt, null)
    assert.ok(update.$set.iceCityIntroSeenAt instanceof Date)
    if (seen.has(filter._id)) return { modifiedCount: 0 }
    seen.add(filter._id); return { modifiedCount: 1 }
  })
  const claims = await Promise.all([auth.claimIceCityIntro('alice'), auth.claimIceCityIntro('alice')])
  assert.equal(claims.filter((result) => result.show).length, 1)
  assert.deepEqual(await auth.claimIceCityIntro('alice'), { show: false })
  assert.deepEqual(await auth.claimIceCityIntro('bob'), { show: true })
})
test('controller lấy tài khoản từ phiên, bỏ qua userId trong body', async (t) => {
  t.mock.method(auth, 'claimIceCityIntro', async (id) => {
    assert.equal(id, 'authenticated-user'); return { show: true }
  })
  const res = { status(code) { assert.equal(code, 200); return this }, json(value) { assert.deepEqual(value, { show: true }) } }
  await controller.claimIceCityIntro({ user: { _id: 'authenticated-user' }, body: { userId: 'someone-else' } }, res)
})
test('route claim yêu cầu xác thực', () => {
  const router = require('../routes/auth.routes')
  const { authenticate } = require('../middlewares/auth.middleware')
  const route = router.stack.find((layer) => layer.route?.path === '/me/ice-city-intro').route
  assert.equal(route.methods.post, true); assert.equal(route.stack[0].handle, authenticate)
})
