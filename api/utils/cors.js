const DEFAULT_CLIENT_URL = 'http://localhost:3000'

const expandLocalAliases = (url) => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost') {
      const alias = new URL(parsed)
      alias.hostname = '127.0.0.1'
      return [parsed.origin, alias.origin]
    }
    if (parsed.hostname === '127.0.0.1') {
      const alias = new URL(parsed)
      alias.hostname = 'localhost'
      return [parsed.origin, alias.origin]
    }
    return [parsed.origin]
  } catch {
    return [url]
  }
}

const getAllowedOrigins = (clientUrls = process.env.CLIENT_URL || DEFAULT_CLIENT_URL) =>
  [...new Set(
    clientUrls
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .flatMap(expandLocalAliases),
  )]

const createCorsOrigin = (allowedOrigins = getAllowedOrigins()) => (origin, callback) => {
  // Request không có Origin (curl, healthcheck, server-to-server) vẫn được phép.
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
  return callback(new Error(`Origin không được phép: ${origin}`))
}

module.exports = { getAllowedOrigins, createCorsOrigin }
