const VIETNAMESE_PHRASE_PATTERN = /^[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?: [a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)+$/u

const normalizePhrase = (value) => {
  if (typeof value !== 'string') return ''
  return value.normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ')
}

const splitPhrase = (value) => {
  const normalized = normalizePhrase(value)
  return normalized ? normalized.split(' ') : []
}

const isValidTwoSyllablePhrase = (value) => {
  const normalized = normalizePhrase(value)
  return normalized.length <= 80
    && VIETNAMESE_PHRASE_PATTERN.test(normalized)
    && splitPhrase(normalized).length === 2
}

module.exports = { normalizePhrase, splitPhrase, isValidTwoSyllablePhrase }
