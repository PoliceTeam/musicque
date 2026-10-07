const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/user.model')
const CoinTransaction = require('../models/coinTransaction.model')
const auth = require('../services/auth.service')

function setup(t, balance = 2000) {
  const state = { username: 'tien', displayName: 'Tiến', polites: balance, role: 'user', _id: new User()._id }
  const ledger = []
  const document = () => new User(state)
  t.mock.method(User, 'init', async () => User)
  t.mock.method(User, 'findById', async () => document())
  t.mock.method(User, 'findByUsername', async () => null)
  t.mock.method(CoinTransaction, 'create', async (entry) => { ledger.push(entry); return entry })
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    if (state.polites < filter.polites.$gte || state.username !== filter.username || state.displayName !== filter.displayName) return null
    Object.assign(state, update.$set)
    state.polites += update.$inc.polites
    return document()
  })
  return { state, ledger, user: document() }
}

test('đổi cả hai tên chỉ mất 1.000 PC và giữ nguyên ID, quyền', async (t) => {
  const { state, ledger, user } = setup(t)
  const result = await auth.updateProfile(user, { username: ' new_tien ', displayName: ' Tiến mới ' })
  assert.equal(result.username, 'new_tien')
  assert.equal(result.displayName, 'Tiến mới')
  assert.equal(result.polites, 1000)
  assert.equal(String(result._id), String(user._id))
  assert.equal(result.role, 'user')
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].amount, -1000)
  assert.equal(ledger[0].type, 'profile_rename')
  assert.equal(state.polites, 1000)
})

test('đúng 1.000 PC vẫn đổi được; đổi riêng display name có thu phí', async (t) => {
  const { user } = setup(t, 1000)
  const result = await auth.updateProfile(user, { username: 'tien', displayName: 'Tên mới' })
  assert.equal(result.polites, 0)
})

test('thiếu PC không đổi tên, không tạo giao dịch', async (t) => {
  const { user, state, ledger } = setup(t, 999)
  await assert.rejects(auth.updateProfile(user, { username: 'other', displayName: 'Tên mới' }), /1.000 PC/)
  assert.equal(state.username, 'tien')
  assert.equal(state.polites, 999)
  assert.equal(ledger.length, 0)
})

test('tên không hợp lệ và không thay đổi không thu phí', async (t) => {
  const { user, state, ledger } = setup(t)
  for (const profile of [
    { username: 'bad name', displayName: 'Tên' },
    { username: 'tien', displayName: ' ' },
    { username: 'tien', displayName: 'x'.repeat(41) },
    { username: ' tien ', displayName: ' Tiến ' },
  ]) await assert.rejects(auth.updateProfile(user, profile), { status: 400 })
  assert.equal(state.polites, 2000)
  assert.equal(ledger.length, 0)
})

test('username trùng khác hoa/thường không thu phí', async (t) => {
  const { user, state } = setup(t)
  User.findByUsername.mock.mockImplementation(async () => new User({ username: 'Other' }))
  await assert.rejects(auth.updateProfile(user, { username: 'OTHER', displayName: 'Tên' }), { status: 409 })
  assert.equal(state.polites, 2000)
})

test('lỗi unique index không trừ phí', async (t) => {
  const { user, state, ledger } = setup(t)
  User.findOneAndUpdate.mock.mockImplementation(async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }) })
  await assert.rejects(auth.updateProfile(user, { username: 'other', displayName: 'Tên' }), { code: 11000 })
  assert.equal(state.polites, 2000)
  assert.equal(ledger.length, 0)
})

test('hai request cùng lúc chỉ đổi và thu phí một lần', async (t) => {
  const { user, state, ledger } = setup(t, 3000)
  const results = await Promise.allSettled([
    auth.updateProfile(user, { username: 'other', displayName: 'Tên' }),
    auth.updateProfile(user, { username: 'other', displayName: 'Tên' }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(state.polites, 2000)
  assert.equal(ledger.length, 1)
})

test('admin giữ username, vẫn đổi được display name', async (t) => {
  const { user, state } = setup(t)
  state.role = 'admin'
  await assert.rejects(auth.updateProfile(user, { username: 'new_admin', displayName: 'Admin' }), { status: 403 })
  const result = await auth.updateProfile(user, { username: 'tien', displayName: 'Admin' })
  assert.equal(result.role, 'admin')
  assert.equal(result.polites, 1000)
})
