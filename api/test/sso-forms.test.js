const test = require('node:test')
const assert = require('node:assert/strict')
const { generateKeyPairSync, sign } = require('node:crypto')
const { createPasswordProvider, tokenVault } = require('../services/sso-password.service')
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' }
const issuer = 'https://sso.test/realms/sso'
const settings = { issuer, clientId: 'musicque', clientSecret: 'secret', tokenKey: 'ab'.repeat(32), targets: { 'musicque-farm': 'https://farm.test/api/auth/handoff/accept' } }
const jwt = (overrides = {}, forged = false) => {
  const now = Math.floor(Date.now() / 1000)
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const input = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({ iss: issuer, sub: 'user-1', aud: 'musicque', azp: 'musicque-farm', iat: now, exp: now + 60, jti: 'once', preferred_username: 'lan', ...overrides })}`
  return `${input}.${forged ? 'AAAA' : sign('sha256', Buffer.from(input), keys.privateKey).toString('base64url')}`
}
let idOverrides = {}
let forgedId = false
const calls = []
const transport = async (input, init) => {
  const url = String(input)
  calls.push({ url, method: init?.method })
  if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/protocol/openid-connect/certs`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_post'] })
  if (url.endsWith('/certs')) return Response.json({ keys: [jwk] })
  if (url.endsWith('/token')) {
    const body = new URLSearchParams(init.body)
    assert.equal(body.get('client_secret'), 'secret')
    if (body.get('password') === 'wrong') return Response.json({ error: 'invalid_grant' }, { status: 400 })
    return Response.json({ access_token: 'server-access', token_type: 'Bearer', refresh_token: 'server-refresh', expires_in: 60, ...(body.get('grant_type') === 'password' ? { id_token: jwt(idOverrides, forgedId) } : {}) })
  }
  if (url.includes('/admin/realms/')) {
    if (init?.method === 'POST' || init?.method === 'PUT') {
      if (init.body?.includes('duplicate')) return Response.json({ errorMessage: 'User exists with same username' }, { status: 409 })
      return new Response(null, { status: 204 })
    }
    return Response.json(url.includes('/users?') ? (url.includes('missing') ? [] : [{ id: 'user-1', email: 'lan@example.test' }]) : { username: 'lan' })
  }
  throw new Error('Endpoint không mong đợi')
}
const provider = createPasswordProvider(settings, transport, 'https://musicque.test')
test('form login validates identity and encrypts refresh token; bad credentials stay generic', async () => {
  const result = await provider.login('lan', 'correct horse')
  assert.equal(result.profile.subject, 'user-1')
  assert.ok(!result.refresh.includes('server-refresh'))
  assert.equal(tokenVault(settings.tokenKey).open(result.refresh), 'server-refresh')
  await assert.rejects(provider.login('lan', 'wrong'), e => e.status === 401 && e.code === 'INVALID_CREDENTIALS')
  await assert.rejects(provider.login('missing', 'wrong'), e => e.code === 'INVALID_CREDENTIALS')
})
test('password login rejects ID tokens with invalid audience, issuer, expiry or signature', async () => {
  try {
    for (const claims of [{ aud: 'wrong' }, { iss: 'https://evil.test' }, { exp: 1 }]) {
      idOverrides = claims
      await assert.rejects(provider.login('lan', 'correct horse'), e => e.code === 'INVALID_CREDENTIALS')
    }
    idOverrides = {}; forgedId = true
    await assert.rejects(provider.login('lan', 'correct horse'), e => e.code === 'INVALID_CREDENTIALS')
  } finally { idOverrides = {}; forgedId = false }
})
test('registration uses Admin API and maps duplicates and invalid passwords', async () => {
  assert.equal((await provider.register({ username: 'lan', password: 'correct horse', name: 'Lan' })).profile.subject, 'user-1')
  await assert.rejects(provider.register({ username: 'duplicate', password: 'correct horse', name: 'Lan' }), e => e.code === 'USERNAME_TAKEN')
  await assert.rejects(provider.register({ username: 'lan', password: 'short', name: 'Lan' }), e => e.code === 'INVALID_INPUT')
})
test('forgot returns identically for known/missing accounts and SMTP failure', async () => {
  assert.equal(await provider.forgot('lan'), undefined)
  assert.equal(await provider.forgot('missing'), undefined)
  const unavailable = createPasswordProvider(settings, async () => { throw new Error('SMTP') }, 'https://musicque.test')
  assert.equal(await unavailable.forgot('lan'), undefined)
})
test('password change verifies current credentials before calling reset-password', async () => {
  const profile = { issuer, subject: 'user-1', name: 'Lan' }
  const before = calls.filter(c => c.url.includes('reset-password')).length
  await assert.rejects(provider.change(profile, 'wrong', 'new password'), e => e.code === 'INVALID_CREDENTIALS')
  assert.equal(calls.filter(c => c.url.includes('reset-password')).length, before)
  await provider.change(profile, 'correct horse', 'new password')
  assert.equal(calls.filter(c => c.url.includes('reset-password')).length, before + 1)
})
test('handoff validates signature, issuer, audience, authorized party and short expiry', async () => {
  assert.equal((await provider.verify(jwt())).profile.subject, 'user-1')
  for (const overrides of [{ aud: 'farm' }, { azp: 'evil' }, { iss: 'https://evil.test' }, { exp: 1 }, { iat: 1 }, { exp: Math.floor(Date.now() / 1000) + 300 }]) await assert.rejects(provider.verify(jwt(overrides)))
  await assert.rejects(provider.verify(jwt({}, true)))
})
test('handoff consumes jti atomically; outgoing controller requires origin', async (t) => {
  const forms = require('../services/sso-forms.service')
  const Handoff = require('../models/sso-handoff.model')
  const User = require('../models/user.model')
  const sso = require('../services/sso.service')
  t.mock.method(forms, 'provider', () => provider)
  // Service gọi hàm provider nội bộ: mock môi trường và fetch trước khi dùng.
  t.mock.method(sso, 'settings', () => ({ ...settings, secret: settings.clientSecret, origin: 'https://musicque.test' }))
  t.mock.method(global, 'fetch', transport)
  t.mock.method(User, 'findOne', async () => ({ _id: 'existing' }))
  let used = false
  t.mock.method(Handoff, 'create', async () => { if (used) throw Object.assign(new Error('Replay'), { code: 11000 }); used = true })
  assert.equal((await forms.accept(jwt())).user._id, 'existing')
  await assert.rejects(forms.accept(jwt()), /Replay/)
  const controller = require('../controllers/sso-forms.controller')
  let status
  const response = { status(value) { status = value; return this }, json() {} }
  await controller.handoff({ get: () => 'https://evil.test' }, response)
  assert.equal(status, 403)
  await assert.rejects(forms.outgoing(null, 'musicque-farm'), e => e.status === 401)
})
test('vault authenticates ciphertext and refuses an incorrect key', () => {
  const encrypted = tokenVault(settings.tokenKey).seal('secret')
  assert.throws(() => tokenVault('cd'.repeat(32)).open(encrypted))
  assert.throws(() => tokenVault('bad').seal('secret'))
})

test('handoff accept only takes posts from our own or configured partner web origins (login CSRF)', async (t) => {
  const sso = require('../services/sso.service')
  const forms = require('../services/sso-forms.service')
  const controller = require('../controllers/sso-forms.controller')
  t.mock.method(sso, 'settings', () => ({ origin: 'https://musicque.test', handoffOrigins: ['https://farm.test'] }))
  const accepted = t.mock.method(forms, 'accept', async () => { throw new Error('stop after origin check') })
  const post = async (origin) => {
    let location
    const res = { set() { return this }, redirect(value) { location = value } }
    await controller.accept({ get: (name) => (name === 'Origin' ? origin : undefined), body: { token: 'signed' } }, res)
    return location
  }
  assert.match(await post(undefined), /handoff-failed/)
  assert.match(await post('https://evil.test'), /handoff-failed/)
  assert.equal(accepted.mock.callCount(), 0)
  await post('https://farm.test')
  await post('https://musicque.test')
  assert.equal(accepted.mock.callCount(), 2)
})
