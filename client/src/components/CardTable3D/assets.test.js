import { useDeck } from './useDeck'
import { renderHook } from '@testing-library/react'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Skeleton, SkinnedMesh } from 'three'
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ data: null, clear: vi.fn() }))
vi.mock('@react-three/drei', () => { const useGLTF = () => mocks.data; useGLTF.clear = mocks.clear; return { useGLTF } })
vi.mock('@react-three/fiber', () => ({ useThree: fn => fn({ gl: { extensions: { has: () => false }, capabilities: { isWebGL2: true, getMaxAnisotropy: () => 8 } } }) }))
import { clearTableAssets, releaseTextureImage, TABLE_MODEL_URLS, useTableGLTF, warmTableScene, disposeClonedSkeletons, setCardFaceVisibility } from './assets'
it('disposes shared resources once and clears parsed models for a fresh context', () => {
  const image = { close: vi.fn() }, texture = new Texture(image)
  const material = new MeshBasicMaterial({ map: texture }), geometry = new PlaneGeometry()
  const scene = new Group(); scene.add(new Mesh(geometry, material), new Mesh(geometry, material))
  mocks.data = { scene }
  const materialDispose = vi.spyOn(material, 'dispose'), geometryDispose = vi.spyOn(geometry, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose')
  renderHook(() => useTableGLTF(TABLE_MODEL_URLS[0]))
  clearTableAssets()
  expect(image.close).toHaveBeenCalledTimes(1)
  expect(materialDispose).toHaveBeenCalledTimes(1)
  expect(geometryDispose).toHaveBeenCalledTimes(1)
  expect(textureDispose).toHaveBeenCalledTimes(1)
  for (const url of TABLE_MODEL_URLS) expect(mocks.clear).toHaveBeenCalledWith(url)
  clearTableAssets(); expect(textureDispose).toHaveBeenCalledTimes(1)
})

it('closes decoded images once after upload and again-safe cleanup', () => {
  const image = { close: vi.fn() }, texture = new Texture(image)
  releaseTextureImage(texture); releaseTextureImage(texture)
  expect(image.close).toHaveBeenCalledTimes(1)
})

it('warms programs and shared textures once, including hidden meshes', () => {
  const scene = new Group(), texture = new Texture(), material = new MeshBasicMaterial({ map: texture })
  scene.add(new Mesh(new PlaneGeometry(), material), new Mesh(new PlaneGeometry(), material))
  scene.children[0].visible = false
  const program = { getUniforms: vi.fn(), getAttributes: vi.fn() }
  const camera = {}, gl = { compile: vi.fn(), initTexture: vi.fn(), info: { programs: [program] } }
  warmTableScene(scene, camera, gl)
  expect(gl.compile).toHaveBeenCalledWith(scene, camera)
  expect(program.getUniforms).toHaveBeenCalledTimes(1)
  expect(program.getAttributes).toHaveBeenCalledTimes(1)
  expect(gl.initTexture).toHaveBeenCalledExactlyOnceWith(texture)
})
it('disposes each cloned skeleton bone texture once across shared meshes', () => {
  const scene = new Group(), skeleton = new Skeleton(), texture = new Texture()
  skeleton.boneTexture = texture
  const dispose = vi.spyOn(texture, 'dispose')
  for (let i = 0; i < 2; i++) { const mesh = new SkinnedMesh(); mesh.skeleton = skeleton; scene.add(mesh) }
  disposeClonedSkeletons(scene)
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(skeleton.boneTexture).toBeNull()
})

it('omits hidden rank faces for opaque hands while retaining both faces of revealed cards', () => {
  const card = new Group(), front = new Mesh(undefined, new MeshBasicMaterial({ name: 'CardFront' })), back = new Mesh(undefined, new MeshBasicMaterial({ name: 'CardBack' }))
  card.add(front, back)
  setCardFaceVisibility(card, true)
  expect(front.visible).toBe(false); expect(back.visible).toBe(true)
  setCardFaceVisibility(card, false)
  expect(front.visible).toBe(true); expect(back.visible).toBe(true)
})

it('disposes per-deck overlay resources, releasing renderer material listeners on unmount', () => {
  const scene = new Group(), parent = new Group(), mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ name: 'CardFront' }))
  mesh.name = 'Spade_Ace'; parent.add(mesh); scene.add(parent); mocks.data = { scene }
  const { result, unmount } = renderHook(useDeck)
  const resources = Object.values(result.current.overlays)
  const listeners = resources.map(resource => { const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener })
  unmount()
  listeners.forEach(listener => expect(listener).toHaveBeenCalledTimes(1))
  clearTableAssets()
})
