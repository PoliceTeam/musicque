const BTCPrice = require('../models/btcPrice.model');
const { getBTCPrice, shouldUpdate } = require('../services/btcPrice.service');

// Lấy giá BTC hôm nay
exports.getTodayBTCPrice = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Tìm giá BTC hôm nay trong database
    let btcPrice = await BTCPrice.findOne({ date: today });
    
    // Kiểm tra xem có cần cập nhật không (15 phút)
    const needsUpdate = !btcPrice || shouldUpdate(btcPrice.updatedAt);
    
    if (needsUpdate) {
      try {
        console.log('BTC price needs update, fetching from API-Ninjas...');
        const btcData = await getBTCPrice();
        
        if (btcData && btcData.price) {
          if (btcPrice) {
            // Cập nhật record hiện tại
            Object.assign(btcPrice, {
              price: btcData.price,
              priceChange24h: btcData.priceChange24h,
              priceChangePercent24h: btcData.priceChangePercent24h,
              high24h: btcData.high24h,
              low24h: btcData.low24h,
              volume24h: btcData.volume24h,
              timestamp: btcData.timestamp,
              rawData: btcData.rawData
            });
            await btcPrice.save();
            console.log(`BTC price updated for ${today}: $${btcData.price}`);
          } else {
            // Tạo record mới
            btcPrice = await BTCPrice.create({
              date: today,
              price: btcData.price,
              priceChange24h: btcData.priceChange24h,
              priceChangePercent24h: btcData.priceChangePercent24h,
              high24h: btcData.high24h,
              low24h: btcData.low24h,
              volume24h: btcData.volume24h,
              timestamp: btcData.timestamp,
              source: 'API-Ninjas',
              rawData: btcData.rawData
            });
            console.log(`BTC price created for ${today}: $${btcData.price}`);
          }
        } else {
          return res.status(404).json({
            message: 'Không thể lấy được giá BTC hôm nay',
            error: 'BTC price data not available'
          });
        }
      } catch (fetchError) {
        console.error('Error fetching BTC price:', fetchError);
        return res.status(500).json({
          message: 'Lỗi khi lấy giá BTC từ nguồn bên ngoài',
          error: fetchError.message
        });
      }
    } else {
      console.log(`Using cached BTC price for ${today}`);
    }
    
    // Trả về dữ liệu
    res.status(200).json({
      message: 'Lấy giá BTC thành công',
      data: {
        date: btcPrice.date,
        price: btcPrice.price,
        priceChange24h: btcPrice.priceChange24h,
        priceChangePercent24h: btcPrice.priceChangePercent24h,
        high24h: btcPrice.high24h,
        low24h: btcPrice.low24h,
        volume24h: btcPrice.volume24h,
        timestamp: btcPrice.timestamp,
        source: btcPrice.source,
        createdAt: btcPrice.createdAt,
        updatedAt: btcPrice.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Error in getTodayBTCPrice:', error);
    res.status(500).json({
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// Lấy lịch sử giá BTC (optional - có thể mở rộng sau)
exports.getBTCPriceHistory = async (req, res) => {
  try {
    const { limit = 30, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const btcPrices = await BTCPrice.find()
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('date price priceChange24h priceChangePercent24h high24h low24h volume24h source createdAt updatedAt');
    
    const total = await BTCPrice.countDocuments();
    
    res.status(200).json({
      message: 'Lấy lịch sử giá BTC thành công',
      data: {
        btcPrices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getBTCPriceHistory:', error);
    res.status(500).json({
      message: 'Lỗi server',
      error: error.message
    });
  }
};
