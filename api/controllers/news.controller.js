const axios = require('axios');
const cheerio = require('cheerio');

const VNEXPRESS_RSS_URL = 'https://vnexpress.net/rss/du-lich.rss';

const parseDescription = (descriptionHtml) => {
  const $ = cheerio.load(descriptionHtml || '', null, false);
  const imageUrl = $('img').attr('src') || null;
  const summary = $.text().replace(/\s+/g, ' ').trim();

  return { imageUrl, summary };
};

exports.getVnExpressNews = async (req, res) => {
  try {
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

    res.status(200).json({
      message: 'VnExpress news retrieved successfully',
      data: items,
    });
  } catch (error) {
    console.error('Error fetching VnExpress RSS:', error);

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
