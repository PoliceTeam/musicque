const test = require('node:test')
const assert = require('node:assert/strict')
const User = require('../models/user.model')
const Session = require('../models/sso-session.model')
const Attempt = require('../models/sso-attempt.model')
const sso = require('../services/sso.service')

const profile = { iss: 'https://sso.test/realms/sso', sub: 'subject-1', name: 'Lan' }

test('SSO config rejects partial settings and non-TLS production issuers', () => {
  assert.equal(sso.settings({}), null)
  assert.throws(() => sso.settings({ SSO_ISSUER: profile.iss }))
  const settings = { SSO_ISSUER: 'http://localhost:8180/realms/sso', SSO_CLIENT_ID: 'musicque', SSO_CLIENT_SECRET: 'secret', SSO_REDIRECT_URI: 'http://localhost:8080/api/auth/sso/callback', SSO_WEB_ORIGIN: 'http://localhost:8080' }
  assert.equal(sso.settings(settings).clientId, 'musicque')
  assert.throws(() => sso.settings({ ...settings, NODE_ENV: 'production' }))
})

test('SSO-only accounts cannot be claimed through legacy registration', async () => {
  const user = new User({ username: 'sso_user', ssoSubject: 'subject-1', ssoIssuer: profile.iss })
  assert.equal(user.isClaimable(), false)
  assert.equal(new User({ username: 'legacy' }).isClaimable(), true)
})

test('SSO signs a known identity into its existing user and never merges by username', async (t) => {
  const existing = { _id: 'old-user', polites: 5432, role: 'admin' }
  t.mock.method(User, 'findOne', async (query) => {
    assert.deepEqual(query, { ssoIssuer: profile.iss, ssoSubject: profile.sub })
    return existing
  })
  t.mock.method(User, 'create', async () => assert.fail('must not create a second profile'))
  assert.equal(await sso.findUser(profile), existing)
})

test('new SSO profiles reuse a free Keycloak username, otherwise an internal one, with an empty wallet', async (t) => {
  t.mock.method(User, 'findOne', async () => null)
  const taken = new Set(['lan'])
  t.mock.method(User, 'findByUsername', async (name) => (taken.has(name) ? { _id: 'someone' } : null))
  t.mock.method(User, 'create', async (values) => values)
  const free = await sso.findUser({ ...profile, preferred_username: 'mai.anh' })
  assert.equal(free.username, 'mai.anh')
  assert.equal(free.role, 'user')
  assert.equal(free.polites, 0)
  assert.equal(free.password, undefined)
  assert.ok((await sso.findUser({ ...profile, preferred_username: 'lan' })).username.startsWith('sso_'))
  assert.ok((await sso.findUser({ ...profile, preferred_username: 'x' })).username.startsWith('sso_'))
})

test('with SSO enabled only the SSO cookie authenticates; local credentials are closed', async (t) => {
  const keys = { SSO_ISSUER: 'http://localhost:8180/realms/sso', SSO_CLIENT_ID: 'musicque', SSO_CLIENT_SECRET: 'secret', SSO_REDIRECT_URI: 'http://localhost:8080/api/auth/sso/callback', SSO_WEB_ORIGIN: 'http://localhost:8080', JWT_SECRET: 'jwt-test' }
  const previous = Object.fromEntries(Object.keys(keys).map((key) => [key, process.env[key]]))
  Object.assign(process.env, keys)
  t.after(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value })
  const jwt = require('jsonwebtoken')
  const { authenticate, localCredentials } = require('../middlewares/auth.middleware')
  const { resolveUserFromToken } = require('../services/auth.service')
  t.mock.method(User, 'findById', async (id) => ({ _id: id }))
  const bearer = jwt.sign({ userId: 'legacy' }, 'jwt-test')
  let status
  const response = { status(value) { status = value; return this }, json() {} }
  await authenticate({ method: 'GET', headers: { authorization: `Bearer ${bearer}` } }, response, () => assert.fail('JWT must not authenticate'))
  assert.equal(status, 401)
  assert.equal(await resolveUserFromToken(bearer, ''), null)
  status = undefined
  localCredentials({}, response, () => assert.fail('local login must be closed'))
  assert.equal(status, 404)
})

test('opaque cookie sessions enforce expiry and hash the lookup token', async (t) => {
  const token = 'a'.repeat(43)
  t.mock.method(Session, 'findOne', async (query) => {
    assert.equal(query.tokenHash, sso.hash(token))
    assert.ok(query.expiresAt.$gt instanceof Date)
    return { userId: 'user' }
  })
  t.mock.method(User, 'findById', async (id) => ({ _id: id }))
  assert.equal((await sso.resolveSession(token))._id, 'user')
  assert.equal(await sso.resolveSession('invalid'), null)
  assert.equal(sso.sessionToken(`other=x; ${sso.COOKIE}=${token}`), token)
})

test('cookie sessions slide on HTTP use, at most once per renewal window, and never from sockets', async (t) => {
  const token = 'b'.repeat(43)
  const now = Date.now()
  let session
  const updates = []
  t.mock.method(Session, 'findOne', async () => session)
  t.mock.method(Session, 'updateOne', async (filter, update) => { updates.push({ filter, update }) })
  t.mock.method(User, 'findById', async (id) => ({ _id: id }))
  const cookies = []
  const res = { headersSent: false, cookie: (...args) => cookies.push(args) }

  // Phiên vừa gia hạn: không ghi gì.
  session = { _id: 's1', userId: 'user', expiresAt: new Date(now + sso.SESSION_MS - 60000) }
  assert.equal((await sso.resolveSession(token, res))._id, 'user')
  assert.equal(updates.length, 0)
  assert.equal(cookies.length, 0)

  // Phiên 8 giờ cũ hoặc phiên đã quá cửa sổ gia hạn: đẩy hạn lên đủ SESSION_MS và đặt lại cookie.
  session = { _id: 's2', userId: 'user', expiresAt: new Date(now + 60 * 60 * 1000) }
  await sso.resolveSession(token, res)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0].filter, { _id: 's2', expiresAt: session.expiresAt })
  assert.ok(updates[0].update.$set.expiresAt.getTime() >= now + sso.SESSION_MS)
  assert.equal(cookies[0][0], sso.COOKIE)
  assert.equal(cookies[0][1], token)
  assert.equal(cookies[0][2].maxAge, sso.SESSION_MS)

  // Socket không có res: không gia hạn để Mongo không sống lâu hơn cookie.
  await sso.resolveSession(token)
  assert.equal(updates.length, 1)
})

test('SSO callback consumes the state atomically and rejects forged state', async (t) => {
  let used = false
  t.mock.method(Attempt, 'findOneAndDelete', (query) => {
    assert.equal(query.stateHash, sso.hash('state'))
    const value = used ? null : { verifier: 'secret' }; used = true
    return { select: async () => value }
  })
  const request = { headers: { cookie: 'musicque_sso_attempt=state' }, query: { state: 'state' } }
  assert.ok(await sso.consumeAttempt(request))
  assert.equal(await sso.consumeAttempt(request), null)
  await assert.rejects(sso.consumeAttempt({ ...request, query: { state: 'forged' } }))
})

test('logout handles database failure without an unhandled async rejection', async (t) => {
  const controller = require('../controllers/sso.controller')
  t.mock.method(sso, 'logout', async () => { throw new Error('database unavailable') })
  let status
  const response = { status(value) { status = value; return this }, json() {} }
  await controller.logout({ headers: {} }, response)
  assert.equal(status, 503)
})

test('callback without a known attempt reports to the opener or returns to the web', async (t) => {
  const controller = require('../controllers/sso.controller')
  t.mock.method(sso, 'settings', () => ({ origin: 'http://localhost:8080' }))
  const headers = {}
  let body
  let redirected
  const response = { set(name, value) { headers[name] = value }, type() { return this }, send(value) { body = value }, redirect(value) { redirected = value }, clearCookie() {} }
  await controller.callback({ headers: { cookie: 'musicque_sso_attempt=state' }, query: { state: 'forged' } }, response)
  assert.equal(redirected, undefined)
  assert.match(body, /"ok":false/)
  assert.match(body, /location\.replace\("http:\/\/localhost:8080\/\?auth=sso-failed"\)/)
  assert.match(headers['Content-Security-Policy'], /script-src 'nonce-/)
})

test('đăng ký SSO dùng thưởng hiện có đúng một lần, giữ hạn mức trình duyệt', async (t) => {
  const grants = require('../services/signupGrant.service')
  const coins = require('../services/coins.service')
  let saved
  let granted = true
  const reservations = []
  const ledger = []
  t.mock.method(User, 'findOne', async () => saved || null)
  t.mock.method(User, 'findByUsername', async () => null)
  t.mock.method(User, 'create', async values => { saved = values; return values })
  t.mock.method(grants, 'reserveWelcomeGrant', async input => { reservations.push(input); return { granted } })
  t.mock.method(coins, 'recordTransaction', async (...args) => ledger.push(args))
  const first = await sso.findUser(profile, { deviceId: 'device-id-for-test' })
  assert.equal(first.polites, 100)
  assert.equal(first.lastDailyBonusAt, null)
  assert.equal(reservations[0].deviceId, 'device-id-for-test')
  assert.equal(ledger[0][2].operationKey, `signup_grant:${first._id}`)
  assert.equal(await sso.findUser(profile, { deviceId: 'another-device-id' }), first)
  assert.equal(reservations.length, 1)
  assert.equal(ledger.length, 1)
  saved = null
  granted = false
  const second = await sso.findUser({ ...profile, sub: 'second' }, { deviceId: 'device-id-for-test' })
  assert.equal(second.polites, 0)
  assert.ok(second.lastDailyBonusAt instanceof Date)
  assert.equal(ledger.length, 1)
})

test('SSO hoàn tác lượt thưởng khi tạo hồ sơ thất bại', async (t) => {
  const grants = require('../services/signupGrant.service')
  t.mock.method(User, 'findOne', async () => null)
  t.mock.method(grants, 'reserveWelcomeGrant', async () => ({ granted: true }))
  const released = t.mock.method(grants, 'releaseWelcomeGrant', async () => {})
  t.mock.method(User, 'create', async () => { throw new Error('database down') })
  await assert.rejects(sso.findUser(profile, { deviceId: 'device-id-for-test' }), /database down/)
  assert.equal(released.mock.callCount(), 1)
})

test('cookie SSO dùng Secure khi issuer HTTPS dù runtime thiếu NODE_ENV', (t) => {
  const keys = { SSO_ISSUER: 'https://sso.test/realms/sso', SSO_CLIENT_ID: 'musicque', SSO_CLIENT_SECRET: 'secret', SSO_REDIRECT_URI: 'https://musicque.test/api/auth/sso/callback', SSO_WEB_ORIGIN: 'https://musicque.test' }
  const before = Object.fromEntries(Object.keys(keys).map(k => [k, process.env[k]]))
  Object.assign(process.env, keys)
  t.after(() => { for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v })
  assert.equal(sso.cookieOptions().secure, true)
})
