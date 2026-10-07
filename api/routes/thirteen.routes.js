const { register } = require('../services/tableGame')
const { createTableGameRouter } = require('../services/tableGame/router')
const definition = require('../services/thirteen/definition')
module.exports = createTableGameRouter(register(definition))
