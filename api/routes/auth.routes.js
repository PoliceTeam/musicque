const express = require('express')
const authController = require('../controllers/auth.controller')
const { authenticate, authenticateAdmin } = require('../middlewares/auth.middleware')
const jwt = require('jsonwebtoken')

const router = express.Router()

// Đăng nhập
router.post(
  '/login',
  authController.login || ((req, res) => res.status(501).json({ message: 'Not implemented' })),
)

// Xác thực token
router.get(
  '/verify',
  authenticate,
  authController.verifyToken || ((req, res) => res.status(200).json({ user: req.user })),
)

// Đăng nhập admin
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body
    
    // Kiểm tra thông tin đăng nhập với biến môi trường
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác' })
    }
    
    // Tạo token
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )
    
    res.status(200).json({
      token,
      user: {
        username,
        isAdmin: true
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Xác thực token admin
router.get('/admin/verify', authenticateAdmin, (req, res) => {
  res.status(200).json({
    user: {
      username: req.admin.username,
      isAdmin: true
    }
  })
})

module.exports = router
