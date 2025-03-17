const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware xác thực admin
exports.authenticateAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kiểm tra nếu token là của admin
    if (decoded.username !== process.env.ADMIN_USERNAME) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập' });
    }
    
    req.admin = { username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

// Middleware xác thực người dùng thông thường (chỉ cần username)
exports.authenticateUser = (req, res, next) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ message: 'Vui lòng nhập tên người dùng' });
  }
  
  req.user = { username };
  next();
};

// Thêm middleware authenticate nếu chưa có
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = { username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
}; 