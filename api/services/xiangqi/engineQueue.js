const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { Worker } = require('worker_threads')

const WORKERS = Math.max(1, Number(process.env.XIANGQI_ENGINE_WORKERS || 2))
const MOVE_MS = Math.max(100, Number(process.env.XIANGQI_ENGINE_MOVE_MS || 800))
const TIMEOUT_MS = Math.max(MOVE_MS + 500, Number(process.env.XIANGQI_ENGINE_JOB_TIMEOUT_MS || 3000))
const MAX_RETRIES = Math.max(0, Number(process.env.XIANGQI_ENGINE_MAX_RETRIES || 1))
const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH

class JsSlot {
  constructor() {
    this.pending = new Map()
    this.start()
  }

  start() {
    this.worker = new Worker(path.join(__dirname, 'engine.worker.js'))
    this.worker.on('message', ({ id, result, error }) => {
      const task = this.pending.get(id)
      if (!task) return
      this.pending.delete(id)
      error ? task.reject(new Error(error)) : task.resolve(result)
    })
    this.worker.on('error', (error) => {
      for (const task of this.pending.values()) task.reject(error)
      this.pending.clear()
    })
  }

  run(payload) {
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, payload })
    })
  }

  stop() { return this.worker.terminate() }
}

class PikafishSlot {
  constructor(binaryPath) {
    this.buffer = ''
    this.waiter = null
    this.process = spawn(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process.stdout.setEncoding('utf8')
    this.process.stdout.on('data', (chunk) => this.onData(chunk))
    this.process.on('error', (error) => this.fail(error))
    this.process.on('exit', (code) => {
      if (code !== 0) this.fail(new Error(`Pikafish dừng với mã ${code}`))
    })
    this.process.stdin.write('uci\nsetoption name Threads value 1\nisready\n')
  }

  fail(error) {
    if (!this.waiter) return
    const { reject } = this.waiter
    this.waiter = null
    reject(error)
  }

  onData(chunk) {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('bestmove ') && this.waiter) {
        const { resolve } = this.waiter
        this.waiter = null
        resolve(line.split(/\s+/)[1] === '(none)' ? null : line.split(/\s+/)[1])
      }
    }
  }

  run({ fen, difficulty, moveMs }) {
    const budget = difficulty === 'easy' ? Math.min(180, moveMs) : difficulty === 'medium' ? Math.min(450, moveMs) : moveMs
    return new Promise((resolve, reject) => {
      if (this.waiter) return reject(new Error('Pikafish worker đang bận'))
      this.waiter = { resolve, reject }
      const uciFen = fen.replace(/\sr\s/, ' w ')
      this.process.stdin.write(`ucinewgame\nposition fen ${uciFen}\ngo movetime ${budget}\n`)
    })
  }

  stop() { this.process.stdin.write('quit\n') }
}

class EngineQueue {
  constructor() {
    this.high = []
    this.low = []
    this.slots = []
    this.ready = false
    this.inflight = new Map()
  }

  init() {
    if (this.ready) return
    this.usePikafish = ENGINE_PATH && fs.existsSync(ENGINE_PATH)
    this.slots = Array.from({ length: WORKERS }, () => ({
      busy: false,
      engine: this.createEngine(),
    }))
    this.ready = true
    console.log(`[Cờ tướng] Engine pool ${WORKERS} worker (${this.usePikafish ? 'Pikafish' : 'JS fallback'})`)
  }

  createEngine() {
    return this.usePikafish ? new PikafishSlot(ENGINE_PATH) : new JsSlot()
  }

  enqueue(payload, { priority = 'high', key } = {}) {
    this.init()
    if (key && this.inflight.has(key)) return this.inflight.get(key)
    const promise = new Promise((resolve, reject) => {
      const queue = priority === 'low' ? this.low : this.high
      queue.push({ payload: { ...payload, moveMs: MOVE_MS }, key, resolve, reject, retries: 0 })
      this.drain()
    })
    const tracked = promise.finally(() => {
      if (key && this.inflight.get(key) === tracked) this.inflight.delete(key)
    })
    if (key) this.inflight.set(key, tracked)
    return tracked
  }

  drain() {
    for (const slot of this.slots) {
      if (slot.busy) continue
      const job = this.high.shift() || this.low.shift()
      if (!job) return
      slot.busy = true
      this.run(slot, job)
    }
  }

  async run(slot, job) {
    let timer
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Engine quá thời gian')), TIMEOUT_MS)
      })
      const result = await Promise.race([slot.engine.run(job.payload), timeout])
      if (!result) throw new Error('Engine không tìm được nước đi')
      job.resolve(result)
    } catch (error) {
      await Promise.resolve(slot.engine.stop()).catch(() => {})
      slot.engine = this.createEngine()
      if (job.retries < MAX_RETRIES) {
        job.retries += 1
        this.high.unshift(job)
      } else {
        job.reject(error)
      }
    } finally {
      clearTimeout(timer)
      slot.busy = false
      this.drain()
    }
  }

  async close() {
    await Promise.allSettled(this.slots.map((slot) => slot.engine.stop()))
  }
}

module.exports = new EngineQueue()
