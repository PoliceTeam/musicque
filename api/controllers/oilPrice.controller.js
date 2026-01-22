const OilPrice = require('../models/oilPrice.model');
const { getOilPrice, getRON95Price } = require('../services/oilPrice.service');

// Helper function to get date string in consistent format (Asia/Ho_Chi_Minh timezone)
function getTodayDateString() {
  const now = new Date();
  // Convert to Asia/Ho_Chi_Minh timezone (UTC+7)
  const vietnamTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Lấy giá xăng hôm nay
exports.getTodayOilPrice = async (req, res) => {
  try {
    const today = getTodayDateString(); // YYYY-MM-DD format in Vietnam timezone
    
    // Tìm giá xăng hôm nay trong database
    let oilPrice = await OilPrice.findOne({ date: today });
    
    // Nếu không có trong database, thử fetch từ PVOIL
    if (!oilPrice) {
      try {
        console.log(`[OIL] Checking price for date: ${today}, existing: NO`);
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
          console.log(`[OIL] Price CREATED for ${today}: ${ron95Price.price} VND/lít (record ID: ${oilPrice._id})`);
          
          // Log total records in database
          const totalRecords = await OilPrice.countDocuments();
          console.log(`[OIL] Total records in database: ${totalRecords}`);
        } else {
          return res.status(404).json({
            message: 'Không thể lấy được giá xăng hôm nay',
            error: 'RON95 price data not available'
          });
        }
      } catch (fetchError) {
        console.error('Error fetching oil price:', fetchError);
        
        // Check if it's a duplicate key error (shouldn't happen with unique constraint)
        if (fetchError.code === 11000) {
          console.error(`[OIL] Duplicate key error for date ${today}. This should not happen!`);
        }
        
        return res.status(500).json({
          message: 'Lỗi khi lấy giá xăng từ nguồn bên ngoài',
          error: fetchError.message
        });
      }
    } else {
      console.log(`[OIL] Using existing oil price for ${today} (created: ${oilPrice.createdAt}, updated: ${oilPrice.updatedAt})`);
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
