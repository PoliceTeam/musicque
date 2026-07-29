const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
require('dotenv').config()

const extractToken = (req) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim() || null
}

// Trả về User document hoặc null. Không ném lỗi — caller quyết định 401 hay bỏ qua.
const resolveUser = async (req) => {
  const token = extractToken(req)
  if (!token) return null

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded?.userId) return null

    return await User.findById(decoded.userId)
  } catch {
    return null
  }
}

// Bắt buộc đăng nhập
exports.authenticate = async (req, res, next) => {
  try {
    const user = await resolveUser(req)

    if (!user) {
      return res
        .status(401)
        .json({ message: 'Vui lòng đăng nhập để tiếp tục', code: 'UNAUTHENTICATED' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Gắn req.user nếu có token hợp lệ, không có thì vẫn cho đi tiếp (route công khai)
exports.optionalAuthenticate = async (req, res, next) => {
  try {
    req.user = (await resolveUser(req)) || null
  } catch {
    req.user = null
  }
  next()
}

// Bắt buộc đăng nhập + role admin
exports.requireAdmin = async (req, res, next) => {
  try {
    const user = await resolveUser(req)

    if (!user) {
      return res
        .status(401)
        .json({ message: 'Vui lòng đăng nhập để tiếp tục', code: 'UNAUTHENTICATED' })
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập', code: 'FORBIDDEN' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Alias giữ tương thích với các route đang import tên cũ
exports.authenticateAdmin = exports.requireAdmin
exports.authenticateUser = exports.authenticate
