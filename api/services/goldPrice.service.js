const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://btmc.vn/bieu-do-gia-vang.html?t=";
const DEFAULT_RANGE = "ngay";

// Cache đơn giản theo từng range
const cache = new Map(); // key: range, val: { at: number, data: any }
const TTL_MS = 60_000; // 1 phút

function parseVNDk(s) {
  const n = Number(String(s || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n * 1000 : null;
}

function mapArrowToStatus(src) {
  if (!src) return "unknown";
  const f = String(src).toLowerCase();
  if (f.includes("up_arrow")) return "up";
  if (f.includes("down_arrow")) return "down";
  if (f.includes("right_arrow") || f.includes("flat_arrow")) return "flat";
  return "unknown";
}

// Helper: đọc cache
function getCached(range) {
  const now = Date.now();
  const c = cache.get(range);
  if (c && now - c.at < TTL_MS) return c.data;
  return null;
}

async function fetchBTMC(range = DEFAULT_RANGE) {
  try {
    const url = BASE_URL + encodeURIComponent(range);
    const { data: html } = await axios.get(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(html);

    // Ví dụ text: "Cập nhật lúc 01/10/2025 15:28 ... Nguồn: www.btmc.vn"
    const updatedAtText = $(".price-gold .note")
      .text()
      .trim()
      .replace(/\t+/g, " ")
      .replace(/\s+/g, " ");

    const rows = [];
    $(".bd_price_home tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      // Bỏ qua các hàng không đúng cột dữ liệu (>=5 cột nội dung)
      if (tds.length >= 5) {
        // Cột 0 thường là logo có thể rowspan
        const brand = $(tds[1]).text().replace(/\s+/g, " ").trim();
        if (!brand) return;

        const hamLuongRaw = $(tds[2]).text().replace(/\s+/g, " ").trim();
        const muaVaoRaw = $(tds[3]).text().trim();
        const banRaRaw = $(tds[4]).text().trim();

        const muaVao = parseVNDk(muaVaoRaw);
        const banRa = /Liên hệ/i.test(banRaRaw) ? null : parseVNDk(banRaRaw);

        const arrowImg = $(tds[5]).find("img.img_icon_bdpri").attr("src");
        const status = mapArrowToStatus(arrowImg);

        if (muaVao !== null || banRa !== null) {
          rows.push({
            brand, // "VÀNG MIẾNG VRTL BẢO TÍN MINH CHÂU", ...
            hamLuong: hamLuongRaw, // "999.9 (24k)" (gộp từ 2 dòng trong HTML)
            muaVao, // VND (đã nhân 1,000)
            banRa, // VND (đã nhân 1,000) hoặc null nếu "Liên hệ"
            status, // up | flat | down | unknown
            unit: "VND",
          });
        }
      }
    });

    return {
      range,
      updatedAtText,
      unitNote: "ĐVT 1 = 1.000 VND (giá đã được nhân 1,000 trong JSON)",
      source: BASE_URL + range,
      count: rows.length,
      items: rows,
    };
  } catch (error) {
    console.error("Error fetching gold price from BTMC:", error);
    throw error;
  }
}

async function getGoldPrice(range = DEFAULT_RANGE) {
  try {
    // Lấy cache trước
    const cached = getCached(range);
    if (cached) {
      console.log("Using cached gold price data");
      return cached;
    }

    // Fetch mới
    console.log("Fetching fresh gold price data from BTMC");
    const data = await fetchBTMC(range);
    cache.set(range, { at: Date.now(), data });
    return data;
  } catch (error) {
    console.error("Error in getGoldPrice:", error);
    throw error;
  }
}

// Lấy giá vàng VRTL Bảo Tín Minh Châu
function getVRTLPrice(goldData) {
  if (!goldData || !goldData.items || goldData.items.length === 0) {
    return null;
  }

  // Lọc theo VRTL Bảo Tín Minh Châu
  const filteredItems = goldData.items.filter(
    (item) =>
      item.brand.toUpperCase().includes("VÀNG MIẾNG VRTL BẢO TÍN") &&
      item.brand.toUpperCase().includes("MINH CHÂU")
  );

  // Lấy item đầu tiên từ kết quả lọc
  const targetItem = filteredItems[0];

  if (!targetItem) {
    return null;
  }

  return {
    buyPrice: targetItem.muaVao,
    sellPrice: targetItem.banRa,
    brand: targetItem.brand,
    hamLuong: targetItem.hamLuong,
    status: targetItem.status,
  };
}

module.exports = {
  getGoldPrice,
  getVRTLPrice,
  fetchBTMC,
};
