const express = require('express')
const authController = require('../controllers/auth.controller')
const { authenticate, localCredentials, requireAdmin } = require('../middlewares/auth.middleware')

const forms = require('../controllers/sso-forms.controller')
const router = express.Router()
router.post('/forgot-password', forms.forgot)
router.post('/handoff', authenticate, forms.handoff)
router.post('/handoff/accept', express.urlencoded({ extended: false, limit: '17kb' }), forms.accept)

// Đăng ký tài khoản mới
router.post('/register', forms.register, localCredentials, authController.register)

// Đăng nhập
router.post('/login', forms.login, localCredentials, authController.login)

// Thông tin người đang đăng nhập
router.get('/me', authenticate, authController.me)
router.post('/me/ice-city-intro', authenticate, authController.claimIceCityIntro)
router.patch('/me/avatar', authenticate, authController.updateAvatar)
router.patch('/me/profile', authenticate, authController.updateProfile)
router.patch('/me/password', authenticate, forms.change, localCredentials, authController.changePassword)

// ── Route cũ, giữ lại cho client chưa cập nhật ────────────────────────
router.get('/verify', authenticate, authController.me)
router.post('/admin/login', localCredentials, authController.loginAdmin)
router.get('/admin/verify', requireAdmin, authController.me)

module.exports = router
