const crypto = require('crypto')
const path = require('path')
const { Worker } = require('worker_threads')
const { LEVELS, chooseMove } = require('./bot')

// Một worker dùng chung; các ván tập luyện xếp hàng nhau. Worker chết thì dựng lại.
let worker = null
const pending = new Map()

const failAll = (error) => {
  for (const task of pending.values()) task.reject(error)
  pending.clear()
}

const ensureWorker = () => {
  if (worker) return worker
  worker = new Worker(path.join(__dirname, 'bot.worker.js'))
  worker.on('message', ({ id, result, error }) => {
    const task = pending.get(id)
    if (!task) return
    pending.delete(id)
    clearTimeout(task.timer)
    error ? task.reject(new Error(error)) : task.resolve(result)
  })
  worker.on('error', (error) => {
    console.error('[Cờ thú] Worker bot lỗi:', error.message)
    worker = null
    failAll(error)
  })
  worker.on('exit', () => {
    worker = null
    failAll(new Error('Worker bot đã dừng'))
  })
  worker.unref()
  return worker
}

// Không dựng được worker hoặc quá giờ thì tính ngay trên thread chính với ngân sách nhỏ.
const fallback = (state, level) => chooseMove(state, { level, timeMs: Math.min(150, LEVELS[level]?.timeMs || 150) })

const think = (state, level) => {
  let target
  try {
    target = ensureWorker()
  } catch (error) {
    return Promise.resolve(fallback(state, level))
  }
  const id = crypto.randomUUID()
  const budget = (LEVELS[level]?.timeMs || 1000) + 3000
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Bot nghĩ quá lâu'))
    }, budget)
    pending.set(id, { resolve, reject, timer })
    target.postMessage({ id, state, level })
  }).catch((error) => {
    console.error('[Cờ thú] Bot dùng phương án dự phòng:', error.message)
    return fallback(state, level)
  })
}

module.exports = { think }
