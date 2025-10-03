const axios = require('axios');

const API_URL = 'https://api.api-ninjas.com/v1/bitcoin';
const API_KEY = process.env.BTC_API_KEY;

// Cache đơn giản
const cache = new Map(); // key: 'btc', val: { at: number, data: any }
const TTL_MS = 15 * 60 * 1000; // 15 phút

// Helper: đọc cache
function getCached() {
  const now = Date.now();
  const c = cache.get('btc');
  if (c && now - c.at < TTL_MS) return c.data;
  return null;
}

async function fetchBTCPrice() {
  try {
    const { data } = await axios.get(API_URL, {
      headers: {
        'accept': '*/*',
        'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/json',
        'origin': 'https://api-ninjas.com',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'x-api-key': API_KEY
      },
      timeout: 30000,
    });

    // Parse dữ liệu
    const btcData = {
      price: Math.floor(parseFloat(data.price)),
      priceChange24h: Math.floor(parseFloat(data['24h_price_change'])),
      priceChangePercent24h: parseFloat(data['24h_price_change_percent']),
      high24h: Math.floor(parseFloat(data['24h_high'])),
      low24h: Math.floor(parseFloat(data['24h_low'])),
      volume24h: parseFloat(data['24h_volume']),
      timestamp: data.timestamp,
      source: 'API-Ninjas',
      rawData: data
    };

    return btcData;
  } catch (error) {
    console.error('Error fetching BTC price from API-Ninjas:', error);
    throw error;
  }
}

async function getBTCPrice() {
  try {
    // Lấy cache trước
    const cached = getCached();
    if (cached) {
      console.log('Using cached BTC price data');
      return cached;
    }

    // Fetch mới
    console.log('Fetching fresh BTC price data from API-Ninjas');
    const data = await fetchBTCPrice();
    cache.set('btc', { at: Date.now(), data });
    return data;
  } catch (error) {
    console.error('Error in getBTCPrice:', error);
    throw error;
  }
}

// Kiểm tra xem có cần cập nhật không (15 phút)
function shouldUpdate(updatedAt) {
  if (!updatedAt) return true;
  
  const now = new Date();
  const lastUpdate = new Date(updatedAt);
  const diffMinutes = (now - lastUpdate) / (1000 * 60);
  
  return diffMinutes > 15;
}

module.exports = {
  getBTCPrice,
  fetchBTCPrice,
  shouldUpdate
};
