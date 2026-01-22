const axios = require('axios');

// Get current weather
exports.getCurrentWeather = async (req, res) => {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const location = process.env.WEATHER_LOCATION || '21.0051906,105.7387209';

    if (!apiKey) {
      return res.status(500).json({
        message: 'Weather API key is not configured',
        error: 'WEATHER_API_KEY is missing',
      });
    }

    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${location}&aqi=no`;

    const response = await axios.get(url, {
      timeout: 10000,
    });

    res.status(200).json({
      message: 'Weather data retrieved successfully',
      data: response.data,
    });
  } catch (error) {
    console.error('Error fetching weather:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        message: 'Error fetching weather data',
        error: error.response.data?.error?.message || error.message,
      });
    }

    res.status(500).json({
      message: 'Error fetching weather data',
      error: error.message,
    });
  }
};
