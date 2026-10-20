const { createHash, randomBytes } = require('node:crypto')
const User = require('../models/user.model')
const Session = require('../models/sso-session.model')
const Attempt = require('../models/sso-attempt.model')

const COOKIE = 'musicque_session'
const ATTEMPT_COOKIE = 'musicque_sso_attempt'
const SESSION_MS = 8 * 60 * 60 * 1000
const hash = (value) => createHash('sha256').update(value).digest('hex')
const readCookie = (header, name) => {
  const item = String(header || '').split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))
  return item ? item.slice(name.length + 1) : null
}
const sessionToken = (header) => readCookie(header, COOKIE)

const settings = (env = process.env) => {
  const values = [env.SSO_ISSUER, env.SSO_CLIENT_ID, env.SSO_CLIENT_SECRET, env.SSO_REDIRECT_URI, env.SSO_WEB_ORIGIN]
  if (!values.some(Boolean)) return null
  if (!values.every(Boolean)) throw new Error('SSO cần issuer, client id, secret, redirect URI và web origin.')
  const issuer = new URL(env.SSO_ISSUER)
  const redirect = new URL(env.SSO_REDIRECT_URI)
  const origin = new URL(env.SSO_WEB_ORIGIN)
  for (const url of [issuer, redirect, origin]) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'http:'))) throw new Error('SSO cần HTTPS; HTTP chỉ dùng cho localhost ở môi trường phát triển.')
  }
  if (origin.href !== `${origin.origin}/`) throw new Error('SSO_WEB_ORIGIN chỉ được chứa origin.')
  const targets = Object.fromEntries((env.SSO_HANDOFF_TARGETS || '').split(',').filter(Boolean).map((entry) => { const at = entry.indexOf('='); const url = new URL(entry.slice(at + 1)); if (at < 1 || url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'))) throw new Error('Đích bàn giao không hợp lệ.'); return [entry.slice(0, at), url.href] }))
  const handoffOrigins = (env.SSO_HANDOFF_ORIGINS || '').split(',').filter(Boolean).map((value) => new URL(value.trim()).origin)
  return { tokenKey: env.SSO_TOKEN_KEY, targets, handoffOrigins, issuer: issuer.href.replace(/\/$/, ''), clientId: env.SSO_CLIENT_ID, secret: env.SSO_CLIENT_SECRET, redirect: redirect.href, origin: origin.origin }
}

let configuration
let cachedSettings
const client = async () => {
  const config = settings()
  if (!config) throw new Error('SSO chưa được cấu hình.')
  const oidc = await import('openid-client')
  if (!configuration || JSON.stringify(config) !== cachedSettings) {
    cachedSettings = JSON.stringify(config)
    configuration = oidc.discovery(new URL(config.issuer), config.clientId, config.secret, undefined, {
      execute: [oidc.enableNonRepudiationChecks, ...(config.issuer.startsWith('http:') ? [oidc.allowInsecureRequests] : [])],
    }).catch((error) => { configuration = null; throw error })
  }
  return { oidc, config, provider: await configuration }
}

const resolveSession = async (token) => {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } })
  return session ? User.findById(session.userId) : null
}
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
const createSession = async (res, user, ssoRefresh) => {
  const token = randomBytes(32).toString('base64url')
  await Session.create({ ssoRefresh, tokenHash: hash(token), userId: user._id, expiresAt: new Date(Date.now() + SESSION_MS) })
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS })
  return token
}
const logout = async (req, res) => {
  const token = sessionToken(req.headers.cookie)
  if (token) await Session.deleteOne({ tokenHash: hash(token) })
  res.clearCookie(COOKIE, cookieOptions())
}
// register=1 mở trang đăng ký của Keycloak thay cho form đăng nhập.
const start = async (req, res) => {
  const { oidc, config, provider } = await client()
  const token = sessionToken(req.headers.cookie)
  const state = oidc.randomState()
  const verifier = oidc.randomPKCECodeVerifier()
  const nonce = oidc.randomNonce()
  await Attempt.create({ stateHash: hash(state), verifier, nonce, sessionHash: token ? hash(token) : null, popup: req.query.popup === '1', expiresAt: new Date(Date.now() + 600000) })
  res.cookie(ATTEMPT_COOKIE, state, { ...cookieOptions(), path: '/api/auth/sso', maxAge: 600000 })
  return oidc.buildAuthorizationUrl(provider, { redirect_uri: config.redirect, scope: 'openid profile', state, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', ...(req.query.register === '1' ? { prompt: 'create' } : {}) }).href
}
// Keycloak kết thúc phiên SSO rồi quay về web; session ứng dụng đã bị thu hồi trước đó.
const logoutUrl = async () => {
  const { oidc, config, provider } = await client()
  return oidc.buildEndSessionUrl(provider, { post_logout_redirect_uri: `${config.origin}/` }).href
}
const consumeAttempt = async (req) => {
  const state = readCookie(req.headers.cookie, ATTEMPT_COOKIE)
  if (!state || state.length > 200 || state !== req.query.state) throw new Error('Lượt đăng nhập không hợp lệ.')
  return Attempt.findOneAndDelete({ stateHash: hash(state), expiresAt: { $gt: new Date() } }).select('+verifier')
}
const USERNAME = /^[a-zA-Z0-9._-]{3,24}$/
// Danh tính là (issuer, subject); không tự gộp theo username/email hay cấp thêm thưởng vào ví.
const findUser = async (profile) => {
  const identity = { ssoIssuer: profile.iss, ssoSubject: profile.sub }
  const existing = await User.findOne(identity)
  if (existing) return existing
  const preferred = typeof profile.preferred_username === 'string' ? profile.preferred_username : ''
  const username = USERNAME.test(preferred) && !await User.findByUsername(preferred) ? preferred : `sso_${hash(`${profile.iss}\n${profile.sub}`).slice(0, 20)}`
  return User.create({ ...identity, username, displayName: String(profile.name || preferred || 'Người dùng').slice(0, 40), role: 'user', polites: 0 })
}
const finish = async (req, res, attempt) => {
  const { oidc, config, provider } = await client()
  const token = sessionToken(req.headers.cookie)
  if ((token ? hash(token) : null) !== (attempt.sessionHash || null)) throw new Error('Phiên đăng nhập đã thay đổi.')
  const url = new URL(req.originalUrl, config.redirect)
  const tokens = await oidc.authorizationCodeGrant(provider, url, { pkceCodeVerifier: attempt.verifier, expectedNonce: attempt.nonce, expectedState: readCookie(req.headers.cookie, ATTEMPT_COOKIE), idTokenExpected: true })
  const claims = tokens.claims()
  if (!claims?.sub || claims.sub.length > 255) throw new Error('Thiếu định danh SSO.')
  let user
  try { user = await findUser(claims) } catch (error) {
    if (error.code !== 11000) throw error
    user = await User.findOne({ ssoIssuer: claims.iss, ssoSubject: claims.sub })
    if (!user) throw error
  }
  await logout(req, res)
  await createSession(res, user, tokens.refresh_token ? require('./sso-password.service').tokenVault(config.tokenKey).seal(tokens.refresh_token) : undefined)
}
const enabled = () => Boolean(settings())
module.exports = { COOKIE, ATTEMPT_COOKIE, settings, enabled, readCookie, sessionToken, cookieOptions, resolveSession, start, consumeAttempt, finish, logout, logoutUrl, hash, findUser, createSession }
