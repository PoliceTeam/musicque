const { createTableGameService } = require('./engine')
const services = Object.create(null)
const register = (definition) => {
  if (services[definition.name]) throw new Error(`Game already registered: ${definition.name}`)
  services[definition.name] = createTableGameService(definition)
  return services[definition.name]
}
const resumeAll = (io) => Promise.all(Object.values(services).map((service) => service.resume(io)))
module.exports = { register, resumeAll, services }
