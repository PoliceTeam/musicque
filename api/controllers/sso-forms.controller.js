const sso = require('../services/sso.service')
const forms = require('../services/sso-forms.service')
const origin = (req) => require('../utils/cors').getAllowedOrigins().includes(req.get('Origin'))
const failure = (res, error) => res.status(error.status || 503).json({ message: error.status ? error.message : 'Đăng nhập chưa sẵn sàng.', ...(error.code ? { code: error.code } : {}) })
const credential = (register) => async (req, res, next) => {
  if (!sso.enabled()) return next()
  if (!origin(req)) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' })
  try {
    const result = await forms.signIn(req.body, register)
    await sso.logout(req, res)
    await sso.createSession(res, result.user, result.refresh)
    return res.status(register ? 201 : 200).json({ user: result.user.toPublicJSON() })
  } catch (error) { return failure(res, error) }
}
exports.login = credential(false)
exports.register = credential(true)
exports.forgot = async (req, res) => {
  if (!sso.enabled()) return res.status(404).json({ message: 'Chức năng chưa sẵn sàng.' })
  if (!origin(req)) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' })
  await forms.provider().forgot(req.body?.identifier)
  return res.json({ ok: true })
}
exports.change = async (req, res, next) => {
  if (!sso.enabled()) return next()
  try { await forms.change(req.user, req.body); return res.json({ ok: true }) }
  catch (error) { return failure(res, error) }
}
exports.handoff = async (req, res) => {
  if (!origin(req)) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' })
  try {
    const result = await forms.outgoing(sso.sessionToken(req.headers.cookie), req.body?.target)
    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) { return failure(res, error) }
}
exports.accept = async (req, res) => {
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
  const settings = sso.settings()
  const target = settings?.origin || '/'
  try {
    // Token chứng minh tài khoản chứ không chứng minh ai gửi: chỉ trang của mình và đối tác cấu hình được POST,
    // nếu không trang bất kỳ có thể đăng nhập người xem vào tài khoản kẻ tấn công (login CSRF).
    const source = req.get('Origin')
    if (!source || ![settings.origin, ...(settings.handoffOrigins || [])].includes(source)) throw new Error('Nguồn bàn giao không tin cậy.')
    const result = await forms.accept(req.body?.token)
    await sso.logout(req, res)
    await sso.createSession(res, result.user, result.refresh)
    return res.redirect(`${target}/`)
  } catch { return res.redirect(`${target}/?auth=handoff-failed`) }
}
