const express = require('express')
const authController = require('../controllers/auth.controller')
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

// Đăng ký tài khoản mới
router.post('/register', authController.register)

// Đăng nhập
router.post('/login', authController.login)

// Thông tin người đang đăng nhập
router.get('/me', authenticate, authController.me)
router.patch('/me/avatar', authenticate, authController.updateAvatar)

// ── Route cũ, giữ lại cho client chưa cập nhật ────────────────────────
router.get('/verify', authenticate, authController.me)
router.post('/admin/login', authController.loginAdmin)
router.get('/admin/verify', requireAdmin, authController.me)

module.exports = router
