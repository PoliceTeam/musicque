const { randomBytes } = require('node:crypto')
const sso = require('../services/sso.service')

const script = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
// Không biết lượt đăng nhập (state sai/hết hạn) thì trang tự quyết: báo cho cửa sổ mở popup, nếu không thì quay về web.
const complete = (res, ok, popup) => {
  const { origin } = sso.settings()
  const target = `${origin}/?auth=${ok ? 'sso' : 'sso-failed'}`
  res.set('Cache-Control', 'no-store')
  res.set('Referrer-Policy', 'no-referrer')
  if (popup === false) return res.redirect(target)
  const nonce = randomBytes(16).toString('base64url')
  res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`)
  return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>SSO</title><p>Đã xử lý đăng nhập. Bạn có thể đóng cửa sổ này.</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${script({ type: 'musicque:sso', ok })},${script(origin)});window.close();}else location.replace(${script(target)});</script>`)
}
exports.status = (_req, res) => {
  try {
    const config = sso.settings()
    res.json(config ? { enabled: true, accountUrl: `${config.issuer}/account`, handoffTargets: Object.keys(config.targets || {}) } : { enabled: false })
  } catch { res.status(503).json({ enabled: false }) }
}
exports.start = async (req, res) => {
  try { res.set('Cache-Control', 'no-store'); res.redirect(await sso.start(req, res)) }
  catch { res.status(503).json({ message: 'SSO chưa sẵn sàng.' }) }
}
exports.callback = async (req, res) => {
  try { if (!sso.settings()) return res.status(503).json({ message: 'SSO chưa sẵn sàng.' }) }
  catch { return res.status(503).json({ message: 'SSO chưa sẵn sàng.' }) }
  let attempt
  try {
    attempt = await sso.consumeAttempt(req)
    res.clearCookie(sso.ATTEMPT_COOKIE, { ...sso.cookieOptions(), path: '/api/auth/sso' })
    if (!attempt) throw new Error('Lượt đăng nhập đã hết hạn hoặc đã sử dụng.')
    await sso.finish(req, res, attempt)
    return complete(res, true, attempt.popup === true)
  } catch {
    return complete(res, false, attempt ? attempt.popup === true : undefined)
  }
}
exports.logout = async (req, res) => {
  if (sso.sessionToken(req.headers.cookie) && !require('../utils/cors').getAllowedOrigins().includes(req.get('Origin'))) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' })
  try {
    await sso.logout(req, res)
    const logoutUrl = undefined
    res.json({ ok: true, ...(logoutUrl ? { logoutUrl } : {}) })
  } catch { res.status(503).json({ message: 'Chưa thể đăng xuất. Vui lòng thử lại.' }) }
}
