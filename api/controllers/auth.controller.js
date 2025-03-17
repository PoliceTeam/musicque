const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const bcrypt = require('bcryptjs')
require('dotenv').config()

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body

    // Kiểm tra nếu là admin
    if (username === process.env.ADMIN_USERNAME) {
      // Kiểm tra mật khẩu admin
      const isMatch = await bcrypt.compare(
        password,
        await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
      )

      if (!isMatch) {
        return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác' })
      }

      // Tìm hoặc tạo tài khoản admin trong DB
      let adminUser = await User.findOne({ username })

      if (!adminUser) {
        adminUser = await User.create({
          username,
          password: await bcrypt.hash(password, 10),
          role: 'admin',
        })
      }

      // Tạo token
      const token = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' })

      return res.status(200).json({
        token,
        user: {
          _id: adminUser._id,
          username: adminUser.username,
          role: adminUser.role,
        },
      })
    }

    // Xử lý đăng nhập cho user thông thường
    const user = await User.findOne({ username })

    if (!user) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác' })
    }

    const isMatch = await user.comparePassword(password)

    if (!isMatch) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác' })
    }

    // Tạo token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Xác thực token
exports.verifyToken = async (req, res) => {
  try {
    res.status(200).json({
      user: {
        _id: req.user._id,
        username: req.user.username,
        role: req.user.role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Đăng ký user (nếu cần)
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body

    // Kiểm tra username đã tồn tại chưa
    const existingUser = await User.findOne({ username })

    if (existingUser) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' })
    }

    // Tạo user mới
    const newUser = await User.create({
      username,
      password,
      role: 'user',
    })

    // Tạo token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' })

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        username: newUser.username,
        role: newUser.role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Đăng nhập admin
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body

    // Kiểm tra thông tin đăng nhập với biến môi trường
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác' })
    }

    // Tạo token
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1d' })

    res.status(200).json({
      token,
      user: {
        username,
        isAdmin: true,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Xác thực token admin
exports.verifyAdminToken = async (req, res) => {
  try {
    res.status(200).json({
      user: {
        username: req.admin.username,
        isAdmin: true,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
