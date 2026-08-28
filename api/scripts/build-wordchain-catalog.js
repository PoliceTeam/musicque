const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { normalizePhrase, splitPhrase, isValidTwoSyllablePhrase } = require('../services/wordChain/normalization')

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Cách dùng: node scripts/build-wordchain-catalog.js <kaikki-vietnamese.jsonl>')
  process.exit(1)
}

const ACCEPTED_POS = new Set(['noun', 'verb', 'adj', 'adv', 'phrase'])
const targetPath = path.join(__dirname, '..', 'data', 'wordchain', 'catalog.json')

const definitionOf = (entry) => {
  for (const sense of entry.senses || []) {
    if (sense.tags?.includes('name') || sense.tags?.includes('proper-noun')) continue
    const gloss = sense.glosses?.find((value) => typeof value === 'string' && value.trim())
    if (gloss) return gloss.trim().slice(0, 300)
  }
  return ''
}

const run = async () => {
  const lines = readline.createInterface({
    input: fs.createReadStream(sourcePath),
    crlfDelay: Infinity,
  })
  const entries = new Map()
  for await (const line of lines) {
    let entry
    try { entry = JSON.parse(line) } catch { continue }
    if (entry.lang_code !== 'vi' || !ACCEPTED_POS.has(entry.pos)) continue
    const normalizedPhrase = normalizePhrase(entry.word)
    if (!isValidTwoSyllablePhrase(normalizedPhrase)) continue
    const definition = definitionOf(entry)
    if (!definition) continue
    const [firstSyllable, lastSyllable] = splitPhrase(normalizedPhrase)
    if (!entries.has(normalizedPhrase)) {
      entries.set(normalizedPhrase, {
        phrase: entry.word.trim(),
        normalizedPhrase,
        firstSyllable,
        lastSyllable,
        partOfSpeech: entry.pos,
        definition,
      })
    }
  }

  const outgoing = new Map()
  for (const entry of entries.values()) {
    outgoing.set(entry.firstSyllable, (outgoing.get(entry.firstSyllable) || 0) + 1)
  }
  const catalog = [...entries.values()]
    .map((entry) => ({
      ...entry,
      nextWordCount: outgoing.get(entry.lastSyllable) || 0,
      starterEligible: (outgoing.get(entry.lastSyllable) || 0) >= 5,
    }))
    .sort((a, b) => a.normalizedPhrase.localeCompare(b.normalizedPhrase, 'vi'))

  fs.writeFileSync(targetPath, `${JSON.stringify(catalog)}\n`)
  console.log(`[Nối từ] Đã tạo catalog ${catalog.length} cụm tại ${targetPath}`)
}

run().catch((error) => {
  console.error('[Nối từ] Không tạo được catalog:', error)
  process.exit(1)
})
