const axios = require('axios');
const cheerio = require('cheerio');

// Tin nổi bật trong ngày — thay cho feed du lịch cũ.
const VNEXPRESS_RSS_URL = 'https://vnexpress.net/rss/tin-noi-bat.rss';
const VNEXPRESS_CACHE_TTL = 5 * 60 * 1000; // 5 phút

// Cache trong tiến trình: mọi client mở Home đều gọi endpoint này nên không
// việc gì phải đấm vào RSS của VnExpress mỗi lần.
let vnexpressCache = { items: [], fetchedAt: 0 };

const parseDescription = (descriptionHtml) => {
  const $ = cheerio.load(descriptionHtml || '', null, false);
  const imageUrl = $('img').attr('src') || null;
  const summary = $.text().replace(/\s+/g, ' ').trim();

  return { imageUrl, summary };
};

exports.getVnExpressNews = async (req, res) => {
  try {
    if (vnexpressCache.items.length > 0 && Date.now() - vnexpressCache.fetchedAt < VNEXPRESS_CACHE_TTL) {
      return res.status(200).json({
        message: 'VnExpress news retrieved successfully',
        data: vnexpressCache.items,
        cached: true,
      });
    }

    const response = await axios.get(VNEXPRESS_RSS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MusicOrderApp/1.0',
      },
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((_, element) => {
      const $item = $(element);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const pubDate = $item.find('pubDate').text().trim();
      const descriptionHtml = $item.find('description').text();
      const { imageUrl, summary } = parseDescription(descriptionHtml);
      const enclosureUrl = $item.find('enclosure').attr('url');

      items.push({
        title,
        link,
        pubDate,
        summary,
        imageUrl: imageUrl || enclosureUrl || null,
      });
    });

    vnexpressCache = { items, fetchedAt: Date.now() };

    res.status(200).json({
      message: 'VnExpress news retrieved successfully',
      data: items,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching VnExpress RSS:', error);

    // Thà trả tin cũ còn hơn để widget trống khi VnExpress chập chờn.
    if (vnexpressCache.items.length > 0) {
      return res.status(200).json({
        message: 'VnExpress news retrieved from stale cache',
        data: vnexpressCache.items,
        cached: true,
        stale: true,
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        message: 'Error fetching VnExpress news',
        error: error.message,
      });
    }

    res.status(500).json({
      message: 'Error fetching VnExpress news',
      error: error.message,
    });
  }
};

const fetchHackerNews = async (page = 1, limit = 7) => {
  try {
    const { data: topIds } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
    const start = (page - 1) * limit;
    const ids = topIds.slice(start, start + limit);
    if (ids.length === 0) return [];
    
    const promises = ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`));
    const responses = await Promise.all(promises);
    return responses.map(r => {
      const item = r.data;
      return {
        id: `hn-${item.id}`,
        title: item.title,
        link: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        pubDate: new Date(item.time * 1000).toISOString(),
        summary: `Score: ${item.score} | Comments: ${item.descendants || 0}`,
        imageUrl: null,
        tags: ['hackernews'],
        author: item.by,
        source: 'Hacker News'
      };
    });
  } catch (error) {
    console.error('HN Error:', error.message);
    return [];
  }
};

const fetchDevTo = async (page = 1, limit = 7) => {
  try {
    const response = await axios.get(`https://dev.to/api/articles?top=1&page=${page}&per_page=${limit}`, { timeout: 10000 });
    return response.data.map(article => ({
      id: `devto-${article.id}`,
      title: article.title,
      link: article.url,
      pubDate: article.published_timestamp,
      summary: article.description,
      imageUrl: article.cover_image || article.social_image,
      tags: article.tag_list || [],
      author: article.user.name,
      source: 'Dev.to'
    }));
  } catch (error) {
    console.error('Dev.to Error:', error.message);
    return [];
  }
};

const fetchRSS = async (url, sourceName, page = 1, limit = 7) => {
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];
    const start = (page - 1) * limit;
    const end = start + limit;
    
    $('item').each((i, el) => {
      if (i < start || i >= end) return;
      const $item = $(el);
      const title = $item.find('title').text();
      const link = $item.find('link').text();
      const pubDate = $item.find('pubDate').text();
      const description = $item.find('description').text();
      let creator = $item.find('dc\\:creator').text() || $item.find('creator').text() || $item.find('author').text() || '';
      
      let imageUrl = $item.find('media\\:content').attr('url') || $item.find('enclosure').attr('url');
      if (!imageUrl && description) {
        const desc$ = cheerio.load(description, null, false);
        imageUrl = desc$('img').attr('src') || null;
      }
      
      // Lobsters chỉ nhét mỗi link "Comments" vào description — cắt 150 ký tự
      // xong ra "Comments..." trông như tóm tắt hỏng, thà để trống còn hơn.
      const plain = description
        ? cheerio.load(description, null, false).text().replace(/\s+/g, ' ').trim()
        : '';
      let summary = plain.length > 20 ? `${plain.substring(0, 150)}...` : '';

      items.push({
        id: link,
        title,
        link,
        pubDate: new Date(pubDate).toISOString(),
        summary,
        imageUrl,
        tags: [],
        author: creator,
        source: sourceName
      });
    });
    return items;
  } catch (error) {
    console.error(`Error fetching ${sourceName}:`, error.message);
    return [];
  }
};

let globalNewsPool = [];
let lastGlobalFetchTime = 0;
const GLOBAL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const updateGlobalPool = async () => {
  if (Date.now() - lastGlobalFetchTime < GLOBAL_CACHE_TTL && globalNewsPool.length > 0) {
    return;
  }
  try {
    const [hn, devto, lobsters] = await Promise.all([
      fetchHackerNews(1, 30),
      fetchDevTo(1, 30),
      fetchRSS('https://lobste.rs/rss', 'Lobsters', 1, 30)
    ]);
    // Do not sort by date, since we want a truly random mix anyway
    globalNewsPool = [...hn, ...devto, ...lobsters];
    lastGlobalFetchTime = Date.now();
  } catch (err) {
    console.error('Error updating global pool:', err);
  }
};

exports.getAggregatedTechNews = async (req, res) => {
  try {
    await updateGlobalPool();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 7;
    const seed = parseFloat(req.query.seed) || 12345;

    // Seeded random generator
    const seededRandom = (s) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    let shuffledPool = [...globalNewsPool];

    // Fisher-Yates Shuffle using seed
    let currentSeed = seed;
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(currentSeed) * (i + 1));
      currentSeed += 1;
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const pageData = shuffledPool.slice(start, end);

    res.status(200).json({
      message: 'Randomized tech news retrieved successfully',
      data: pageData,
      page,
      hasMore: end < shuffledPool.length
    });
  } catch (error) {
    console.error('Error fetching aggregated news:', error);
    res.status(500).json({
      message: 'Error fetching aggregated news',
      error: error.message,
    });
  }
};
