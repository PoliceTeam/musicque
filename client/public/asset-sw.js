/* Service Worker cache tài nguyên tĩnh nặng: model 3D, ảnh sân khấu, nhạc, hiệu ứng.
 *
 * Cache-first theo đường dẫn file (bỏ query string): đã tải một lần thì lần sau đọc thẳng từ
 * Cache Storage, không chờ mạng. Đổi nội dung mà GIỮ NGUYÊN tên file thì máy đã cache vẫn dùng bản
 * cũ — khi đó đổi tên file, hoặc tăng CACHE_VERSION để mọi máy tải lại từ đầu.
 *
 * Thẻ <audio> xin từng đoạn (header Range): trả 206 cắt từ bản đầy đủ đã cache.
 */
const CACHE_VERSION = 1
const CACHE = `musicque-assets-v${CACHE_VERSION}`
const PREFIXES = ['/models/', '/dance/', '/audition/']
const EXTENSIONS = /\.(glb|gltf|bin|ktx2|jpg|jpeg|png|webp|mp3|ogg|wav)$/i

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('musicque-assets-') && k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

const isAsset = (url) =>
  url.origin === self.location.origin && PREFIXES.some((p) => url.pathname.startsWith(p)) && EXTENSIONS.test(url.pathname)

// Khoá cache = đường dẫn file, không kèm query, không kèm header của request gốc.
const keyOf = (url) => `${url.origin}${url.pathname}`

// Tải đủ file một lần (không Range) rồi cất vào cache; nhiều request cùng file dùng chung một lần tải.
const inflight = new Map()
const fetchAndStore = (key) => {
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    const res = await fetch(key, { cache: 'no-store' })
    if (res.ok && res.status === 200) {
      const cache = await caches.open(CACHE)
      await cache.put(key, res.clone())
    }
    return res
  })().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

const rangeResponse = async (full, rangeHeader) => {
  const blob = await full.blob()
  const size = blob.size
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader || '')
  let start = m && m[1] !== '' ? Number(m[1]) : 0
  let end = m && m[2] !== '' ? Number(m[2]) : size - 1
  if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - Number(m[2])); end = size - 1 } // bytes=-N
  end = Math.min(end, size - 1)
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  })
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (!isAsset(url)) return
  const key = keyOf(url)
  const range = req.headers.get('range')
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE)
      let res = await cache.match(key)
      if (!res) res = await fetchAndStore(key)
      if (!res.ok) return res
      return range ? rangeResponse(res.clone(), range) : res.clone()
    } catch {
      return fetch(req) // Cache Storage lỗi / hết chỗ: đi mạng như bình thường
    }
  })())
})
