export const CHAT_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024
export const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
export const CHAT_MESSAGE_MAX_LENGTH = 500

const COMPRESS_ABOVE_BYTES = 400 * 1024
const MAX_DIMENSION = 1280

export const resolveChatImageSrc = (imageUrl) => {
  if (!imageUrl) return ''
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl
  const base = import.meta.env.VITE_API_URL || ''
  return `${base}${imageUrl}`
}

export const insertAtCursor = (value, insert, start, end, maxLength = CHAT_MESSAGE_MAX_LENGTH) => {
  const from = Number.isFinite(start) ? start : value.length
  const to = Number.isFinite(end) ? end : from
  const next = `${value.slice(0, from)}${insert}${value.slice(to)}`
  if (next.length > maxLength) return { value, cursor: from }
  return { value: next, cursor: from + insert.length }
}

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Không đọc được ảnh'))
    reader.readAsDataURL(blob)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Không đọc được ảnh'))
    image.src = src
  })

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })

const compressImage = async (file) => {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width || 1, image.height || 1))
    const width = Math.max(1, Math.round((image.width || 1) * scale))
    const height = Math.max(1, Math.round((image.height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(image, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82)
    if (!blob || blob.size >= file.size) return file
    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const getPastedImageFile = (clipboardData) => {
  const items = clipboardData?.items
  if (items) {
    const pasted = [...items].find((item) => item.type?.startsWith('image/'))
    const file = pasted?.getAsFile?.()
    if (file) return file
  }

  const files = clipboardData?.files
  if (files?.length) {
    return [...files].find((file) => file.type?.startsWith('image/')) || null
  }

  return null
}

export async function prepareChatImage(file) {
  if (!file || !CHAT_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WEBP')
  }

  let output = file
  if (file.type !== 'image/gif' && file.size > COMPRESS_ABOVE_BYTES) {
    try {
      output = await compressImage(file)
    } catch {
      output = file
    }
  }

  if (output.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error('Ảnh tối đa 1.5MB. Hãy chọn ảnh nhỏ hơn.')
  }

  const dataUrl = await readAsDataUrl(output)
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Không đọc được ảnh')
  }

  return {
    dataUrl,
    name: file.name || 'image',
  }
}
