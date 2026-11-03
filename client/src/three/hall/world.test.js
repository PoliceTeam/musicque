import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect, it, vi } from 'vitest'
import { buildWorld } from './world'

it('bắt đầu tải mọi tài nguyên cảnh độc lập cùng lúc', async () => {
  const textures = []
  const models = []
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, onProgress, onError) => {
    textures.push(url)
    queueMicrotask(onError)
    return new THREE.Texture()
  })
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (url) => {
    models.push(url)
    const scene = new THREE.Group()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))
    return { scene }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  })
  const pending = buildWorld({ capabilities: { getMaxAnisotropy: () => 1 } }, { incense: { x: 0, z: 9 } })
  try {
    expect(textures).toHaveLength(24)
    expect(models).toHaveLength(4)
  } finally {
    const world = await pending
    world.scene.traverse((object) => {
      object.geometry?.dispose()
      for (const material of [].concat(object.material || [])) material.dispose()
    })
    vi.restoreAllMocks()
  }
})
