require('dotenv').config()
const fs = require('fs')
const readline = require('readline')
const mongoose = require('mongoose')
const WordEntry = require('../models/wordEntry.model')
const { normalizePhrase, splitPhrase } = require('../services/wordChain/normalization')

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Cách dùng: node scripts/import-wordchain-dictionary.js <kaikki-vietnamese.jsonl>')
  process.exit(1)
}

const ACCEPTED_POS = new Set(['noun', 'verb', 'adj', 'adv', 'phrase'])

const extractDefinition = (entry) => {
  for (const sense of entry.senses || []) {
    const gloss = sense.glosses?.find((value) => typeof value === 'string' && value.trim())
    if (gloss) return gloss.trim().slice(0, 500)
  }
  return ''
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  await WordEntry.init()

  const input = fs.createReadStream(sourcePath)
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let scanned = 0
  let accepted = 0
  let operations = []

  const flush = async () => {
    if (!operations.length) return
    await WordEntry.bulkWrite(operations, { ordered: false })
    operations = []
  }

  for await (const line of lines) {
    scanned += 1
    let entry
    try { entry = JSON.parse(line) } catch { continue }

    if (entry.lang_code && entry.lang_code !== 'vi') continue
    if (!ACCEPTED_POS.has(entry.pos)) continue
    const normalizedPhrase = normalizePhrase(entry.word)
    const syllables = splitPhrase(normalizedPhrase)
    const definition = extractDefinition(entry)
    if (syllables.length !== 2 || !definition) continue

    accepted += 1
    operations.push({
      updateOne: {
        filter: { normalizedPhrase },
        update: {
          $set: {
            phrase: entry.word.trim(),
            normalizedPhrase,
            firstSyllable: syllables[0],
            lastSyllable: syllables[1],
            partOfSpeech: entry.pos,
            definition,
            source: 'kaikki-wiktionary',
            status: 'approved',
          },
        },
        upsert: true,
      },
    })
    if (operations.length >= 1000) await flush()
  }
  await flush()

  const outgoing = await WordEntry.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$firstSyllable', count: { $sum: 1 } } },
  ])
  const counts = new Map(outgoing.map((item) => [item._id, item.count]))
  const cursor = WordEntry.find({ status: 'approved' }).cursor()
  operations = []
  for await (const word of cursor) {
    const nextWordCount = counts.get(word.lastSyllable) || 0
    operations.push({
      updateOne: {
        filter: { _id: word._id },
        update: { $set: { nextWordCount, starterEligible: nextWordCount >= 5 } },
      },
    })
    if (operations.length >= 1000) await flush()
  }
  await flush()

  console.log(`[Nối từ] Đã quét ${scanned} dòng, import ${accepted} cụm hai tiếng có nghĩa`)
  await mongoose.disconnect()
}

run().catch((error) => {
  console.error('[Nối từ] Import thất bại:', error)
  process.exit(1)
})
