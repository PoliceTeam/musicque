const authService = require('../services/auth.service')

const handleError = (res, error) => {
  if (error instanceof authService.AuthError) {
    return res.status(error.status).json({ message: error.message })
  }

  // Trùng username do hai request đăng ký cùng lúc
  if (error?.code === 11000) {
    return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' })
  }

  console.error('[Auth] Lỗi không mong đợi:', error)
  return res.status(500).json({ message: 'Lỗi server', error: error.message })
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, password, displayName } = req.body
    const result = await authService.register({
      username,
      password,
      displayName,
      deviceId: req.get('X-Musicque-Device'),
    })

    res.status(201).json({
      message: result.claimed
        ? 'Đã kích hoạt tài khoản và giữ lại lịch sử cũ của bạn'
        : result.welcomeGrant
          ? 'Đăng ký thành công'
          : 'Đăng ký thành công. Vốn khởi tạo đã được nhận trên trình duyệt này.',
      ...result,
    })
  } catch (error) {
    handleError(res, error)
  }
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body
    const result = await authService.login({ username, password })

    res.status(200).json({ message: 'Đăng nhập thành công', ...result })
  } catch (error) {
    handleError(res, error)
  }
}

// GET /api/auth/me — dùng để khôi phục phiên khi load lại trang
exports.me = async (req, res) => {
  res.status(200).json({ user: req.user.toPublicJSON() })
}

// POST /api/auth/admin/login — vẫn là login thường, chỉ chặn thêm người không phải admin
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body
    const result = await authService.login({ username, password })

    if (result.user.role !== 'admin') {
      return res.status(403).json({ message: 'Tài khoản này không có quyền admin' })
    }

    res.status(200).json({ message: 'Đăng nhập thành công', ...result })
  } catch (error) {
    handleError(res, error)
  }
}
