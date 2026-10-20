const sso = require('./sso.service')
const { createPasswordProvider } = require('./sso-password.service')
const Session = require('../models/sso-session.model')
const Handoff = require('../models/sso-handoff.model')
let cached
let lastSettings
const provider = () => {
  const settings = sso.settings()
  if (!settings) throw new Error('SSO chưa cấu hình.')
  const key = JSON.stringify(settings)
  if (!cached || key !== lastSettings) {
    cached = createPasswordProvider({ ...settings, clientSecret: settings.secret }, fetch, settings.origin)
    lastSettings = key
  }
  return cached
}
const find = (profile) => sso.findUser({ iss: profile.issuer, sub: profile.subject, name: profile.name, preferred_username: profile.username })
const signIn = async (body, register = false) => {
  body = body || {}
  const result = register ? await provider().register({ ...body, name: body.displayName || body.username }) : await provider().login(body?.username, body?.password)
  return { user: await find(result.profile), refresh: result.refresh }
}
const change = async (user, body) => {
  const identity = await require('../models/user.model').findById(user._id).select('+ssoIssuer +ssoSubject')
  if (!identity?.ssoSubject) throw Object.assign(new Error('Vui lòng đăng nhập lại.'), { status: 401 })
  return provider().change({ issuer: identity.ssoIssuer, subject: identity.ssoSubject, name: user.displayName }, body?.currentPassword, body?.newPassword)
}
const outgoing = async (token, target) => {
  if (!token) throw Object.assign(new Error('Vui lòng đăng nhập.'), { status: 401 })
  // Khoá lease Mongo để hai request không cùng xoay refresh token.
  const session = await Session.findOneAndUpdate({ tokenHash: sso.hash(token), expiresAt: { $gt: new Date() }, $or: [{ refreshLockUntil: null }, { refreshLockUntil: { $lt: new Date() } }] }, { $set: { refreshLockUntil: new Date(Date.now() + 30000) } }, { new: true }).select('+ssoRefresh')
  if (!session?.ssoRefresh) throw Object.assign(new Error('Vui lòng đăng nhập lại.'), { status: 401 })
  try {
    const result = await provider().outgoing(session.ssoRefresh, target)
    await Session.updateOne({ _id: session._id }, { $set: { ssoRefresh: result.refresh } })
    return { url: result.url, token: result.token }
  } finally { await Session.updateOne({ _id: session._id }, { $unset: { refreshLockUntil: 1 } }) }
}
const accept = async (token) => {
  if (typeof token !== 'string' || token.length > 16000) throw new Error('Bàn giao không hợp lệ.')
  const verified = await provider().verify(token)
  await Handoff.create({ jti: verified.jti, expiresAt: new Date(Date.now() + 120000) })
  const refresh = await provider().accept(token)
  return { user: await find(verified.profile), refresh }
}
module.exports = { provider, signIn, change, outgoing, accept }
