import { renderHook } from '@testing-library/react'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three'
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ data: null, clear: vi.fn() }))
vi.mock('@react-three/drei', () => { const useGLTF = () => mocks.data; useGLTF.clear = mocks.clear; return { useGLTF } })
vi.mock('@react-three/fiber', () => ({ useThree: fn => fn({ gl: { extensions: { has: () => false }, capabilities: { isWebGL2: true, getMaxAnisotropy: () => 8 } } }) }))
import { clearTableAssets, releaseTextureImage, TABLE_MODEL_URLS, useTableGLTF } from './assets'
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
