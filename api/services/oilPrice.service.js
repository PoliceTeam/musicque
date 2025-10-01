const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.pvoil.com.vn/tin-gia-xang-dau";

// Cache đơn giản
const cache = new Map(); // key: 'oil', val: { at: number, data: any }
const TTL_MS = 60_000; // 1 phút

function parseVND(s) {
  const n = Number(String(s || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseChange(s) {
  const str = String(s || "").trim();
  if (str === "" || str === "-") return 0;

  // Xử lý dấu + và -
  const isPositive = !str.startsWith("-");
  const num = Number(str.replace(/[^\d]/g, ""));

  if (!Number.isFinite(num)) return 0;

  return isPositive ? num : -num;
}

// Helper: đọc cache
function getCached() {
  const now = Date.now();
  const c = cache.get("oil");
  if (c && now - c.at < TTL_MS) return c.data;
  return null;
}

async function fetchPVOIL() {
  try {
    const { data: html } = await axios.get(BASE_URL, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(html);

    // Lấy thời gian cập nhật
    const updatedAtText = "Cập nhật từ: PVOIL";

    const products = [];

    // Parse bảng giá xăng dầu
    $("table tr").each((_, tr) => {
      const tds = $(tr).find("td");

      // Bỏ qua header và các hàng không đủ cột
      if (tds.length >= 4) {
        const name = $(tds[1]).text().trim();
        const priceText = $(tds[2]).text().trim();
        const changeText = $(tds[3]).text().trim();

        // Chỉ lấy Xăng RON 95-III và Xăng E5 RON 92-II
        if (
          name &&
          priceText &&
          (name.includes("Xăng RON 95-III") ||
            name.includes("Xăng E5 RON 92-II"))
        ) {
          const price = parseVND(priceText);
          const change = parseChange(changeText);

          if (price !== null) {
            products.push({
              name: name,
              price: price,
              change: change,
              unit: "VND/lít",
            });
          }
        }
      }
    });

    return {
      updatedAtText: updatedAtText.replace(/\t+/g, " ").replace(/\s+/g, " "),
      products: products,
      source: BASE_URL,
      count: products.length,
    };
  } catch (error) {
    console.error("Error fetching oil price from PVOIL:", error);
    throw error;
  }
}

async function getOilPrice() {
  try {
    // Lấy cache trước
    const cached = getCached();
    if (cached) {
      console.log("Using cached oil price data");
      return cached;
    }

    // Fetch mới
    console.log("Fetching fresh oil price data from PVOIL");
    const data = await fetchPVOIL();
    cache.set("oil", { at: Date.now(), data });
    return data;
  } catch (error) {
    console.error("Error in getOilPrice:", error);
    throw error;
  }
}

// Lấy giá xăng RON 95-III (thường là sản phẩm đầu tiên)
function getRON95Price(oilData) {
  if (!oilData || !oilData.products || oilData.products.length === 0) {
    return null;
  }

  // Tìm RON 95-III
  const ron95Item = oilData.products.find((item) =>
    item.name.toLowerCase().includes("ron 95-iii")
  );

  // Nếu không tìm thấy, lấy sản phẩm đầu tiên
  const targetItem = ron95Item || oilData.products[0];

  return {
    name: targetItem.name,
    price: targetItem.price,
    change: targetItem.change,
    unit: targetItem.unit,
  };
}

module.exports = {
  getOilPrice,
  getRON95Price,
  fetchPVOIL,
};
