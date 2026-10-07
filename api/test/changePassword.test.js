const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/user.model')
const coins = require('../services/coins.service')
const auth = require('../services/auth.service')

async function setup(t) {
  const user = new User({ username: 'tien', displayName: 'Tiến', polites: 0 })
  user.password = await User.hashPassword('old-password')
  t.mock.method(User, 'findById', () => ({ select: async () => user }))
  t.mock.method(coins, 'debit', () => { throw new Error('Không được trừ PC') })
  t.mock.method(coins, 'recordTransaction', () => { throw new Error('Không được tạo giao dịch PC') })
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(String(filter._id), String(user._id))
    assert.equal(filter.password, user.password)
    assert.deepEqual(Object.keys(update), ['$set'])
    assert.deepEqual(Object.keys(update.$set), ['password'])
    user.password = update.$set.password
    return user
  })
  return user
}

test('đổi mật khẩu miễn phí kể cả số dư 0, lưu hash và đăng nhập bằng mật khẩu mới', async (t) => {
  const user = await setup(t)
  await auth.changePassword(user, { currentPassword: 'old-password', newPassword: 'new-password' })
  assert.equal(user.polites, 0)
  assert.notEqual(user.password, 'new-password')
  assert.equal(await user.comparePassword('new-password'), true)
  assert.equal(await user.comparePassword('old-password'), false)
  assert.equal(user.toPublicJSON().password, undefined)
  assert.equal(coins.debit.mock.callCount(), 0)
  assert.equal(coins.recordTransaction.mock.callCount(), 0)
})

test('mật khẩu hiện tại sai không cập nhật và không trả 401 gây đăng xuất', async (t) => {
  const user = await setup(t)
  await assert.rejects(auth.changePassword(user, { currentPassword: 'wrong', newPassword: 'new-password' }), { status: 400 })
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0)
  assert.equal(await user.comparePassword('old-password'), true)
})

test('chặn mật khẩu thiếu, quá ngắn, quá 72 byte hoặc trùng mật khẩu cũ', async (t) => {
  const user = await setup(t)
  for (const newPassword of [undefined, 123456, 'short', 'a'.repeat(73), 'ấ'.repeat(25), 'old-password']) {
    await assert.rejects(auth.changePassword(user, { currentPassword: 'old-password', newPassword }), { status: 400 })
  }
  await assert.rejects(auth.changePassword(user, { newPassword: 'new-password' }), { status: 400 })
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0)
})

test('mật khẩu vừa đổi đồng thời không bị ghi đè', async (t) => {
  const user = await setup(t)
  User.findOneAndUpdate.mock.mockImplementation(async () => null)
  await assert.rejects(auth.changePassword(user, { currentPassword: 'old-password', newPassword: 'new-password' }), { status: 409 })
})

test('admin dùng mật khẩu từ cấu hình máy chủ', async (t) => {
  const user = await setup(t)
  user.role = 'admin'
  await assert.rejects(auth.changePassword(user, { currentPassword: 'old-password', newPassword: 'new-password' }), { status: 403 })
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0)
})
