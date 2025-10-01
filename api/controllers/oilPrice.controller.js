const OilPrice = require('../models/oilPrice.model');
const { getOilPrice, getRON95Price } = require('../services/oilPrice.service');

// Lấy giá xăng hôm nay
exports.getTodayOilPrice = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Tìm giá xăng hôm nay trong database
    let oilPrice = await OilPrice.findOne({ date: today });
    
    // Nếu không có trong database, thử fetch từ PVOIL
    if (!oilPrice) {
      try {
        console.log('Oil price not found in database, fetching from PVOIL...');
        const oilData = await getOilPrice();
        const ron95Price = getRON95Price(oilData);
        
        if (ron95Price && ron95Price.price) {
          // Lưu vào database
          oilPrice = await OilPrice.create({
            date: today,
            products: oilData.products,
            source: 'PVOIL',
            updatedAtText: oilData.updatedAtText,
            rawData: {
              ron95: ron95Price,
              fullData: oilData
            }
          });
          console.log(`Oil price fetched and saved for ${today}`);
        } else {
          return res.status(404).json({
            message: 'Không thể lấy được giá xăng hôm nay',
            error: 'RON95 price data not available'
          });
        }
      } catch (fetchError) {
        console.error('Error fetching oil price:', fetchError);
        return res.status(500).json({
          message: 'Lỗi khi lấy giá xăng từ nguồn bên ngoài',
          error: fetchError.message
        });
      }
    }
    
    // Trả về dữ liệu
    res.status(200).json({
      message: 'Lấy giá xăng thành công',
      data: {
        date: oilPrice.date,
        products: oilPrice.products,
        source: oilPrice.source,
        updatedAtText: oilPrice.updatedAtText,
        ron95: oilPrice.rawData?.ron95,
        createdAt: oilPrice.createdAt,
        updatedAt: oilPrice.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Error in getTodayOilPrice:', error);
    res.status(500).json({
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// Lấy lịch sử giá xăng (optional - có thể mở rộng sau)
exports.getOilPriceHistory = async (req, res) => {
  try {
    const { limit = 30, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const oilPrices = await OilPrice.find()
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('date products source updatedAtText createdAt');
    
    const total = await OilPrice.countDocuments();
    
    res.status(200).json({
      message: 'Lấy lịch sử giá xăng thành công',
      data: {
        oilPrices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getOilPriceHistory:', error);
    res.status(500).json({
      message: 'Lỗi server',
      error: error.message
    });
  }
};
