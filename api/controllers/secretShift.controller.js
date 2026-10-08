const game = require('../services/secretShift.service')
const voice = require('../services/secretShiftVoice.service')
const { map } = require('../config/secretShiftMap')
exports.list = (req, res) => res.json({ rooms: game.list(), config: game.settings, map, voiceEnabled: voice.enabled() })
