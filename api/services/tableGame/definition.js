/**
 * @typedef {Object} TableGameDefinition
 * @property {string} name Route/ledger namespace (lowercase ASCII).
 * @property {{min:number,max:number}} seats Total humans plus bots required to play.
 * @property {{tableCount:number,stake:number,turnMs:number,botDelayMs:number}} config
 * @property {{stake:string,payout:string,refund:string}} ledger Registered coin types.
 * @property {function({seats:Array,rng:Function,previous:Object|null}):Object} setup
 * @property {function(Object):(number|null)} currentSeat Null once finished.
 * @property {function(Object,number,Object):Object} applyMove Pure; throws GameRuleError.
 * @property {function(Object,number):Object} timeoutMove
 * @property {function(Object,number):Object} botMove
 * @property {function(Object,number):Object} playerView Only this seat's hidden information.
 * @property {function(Object):Object} publicView No hidden information, including in seats.
 * @property {function(Object):({ranking:number[]}|null)} result
 * @property {function(number,string[]):Array<{userId:string,amount:number}>} payout
 * All function fields are pure: never mutate inputs, access Mongo, time, or the network.
 * setup receives its RNG explicitly. Persistence and deadlines belong to the engine.
 */
class GameRuleError extends Error {
  constructor(message, code = 'INVALID_MOVE') { super(message); this.code = code }
}
const assertDefinition = (definition) => {
  if (!definition || !/^[a-z][a-z0-9-]*$/.test(definition.name || '')) throw new TypeError('Invalid game name')
  const { min, max } = definition.seats || {}
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 2 || max < min || max > 16) throw new TypeError('Invalid seat limits')
  for (const key of ['tableCount', 'stake', 'turnMs', 'botDelayMs']) {
    const value = definition.config?.[key]
    if (!Number.isInteger(value) || value < (key === 'stake' || key === 'botDelayMs' ? 0 : 1)) throw new TypeError(`Invalid config: ${key}`)
  }
  for (const key of ['stake', 'payout', 'refund']) if (typeof definition.ledger?.[key] !== 'string' || !definition.ledger[key]) throw new TypeError(`Invalid ledger: ${key}`)
  for (const key of ['setup', 'currentSeat', 'applyMove', 'timeoutMove', 'botMove', 'playerView', 'publicView', 'result', 'payout']) if (typeof definition[key] !== 'function') throw new TypeError(`Missing game function: ${key}`)
  return definition
}
module.exports = { assertDefinition, GameRuleError }
