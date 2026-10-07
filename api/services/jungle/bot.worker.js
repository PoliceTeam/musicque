const { parentPort } = require('worker_threads')
const { chooseMove } = require('./bot')

// Tìm nước trong thread riêng để vòng event của server không bị chặn trong lúc bot nghĩ.
parentPort.on('message', ({ id, state, level }) => {
  try {
    parentPort.postMessage({ id, result: chooseMove(state, { level }) })
  } catch (error) {
    parentPort.postMessage({ id, error: error.message })
  }
})
