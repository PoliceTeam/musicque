import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
export const TABLE_MODEL_URLS = ['/models/deck-of-cards.glb?v=webp1', '/models/dinner-table.glb?v=webp1', '/models/chibi.glb?v=1']
const scenes = new Map(), textures = new Set(), closedImages = new WeakSet()
let ktx2
export function releaseTextureImage(texture) {
  const image = texture.image
  if (image?.close && !closedImages.has(image)) { image.close(); closedImages.add(image) }
}
export function configureTableLoader(gl) {
  ktx2 ||= new KTX2Loader().setTranscoderPath('/basis/')
  ktx2.detectSupport(gl)
  return loader => loader.setKTX2Loader(ktx2)
}
export function useTableGLTF(url) {
  const gl = useThree(state => state.gl)
  const data = useGLTF(url, false, false, configureTableLoader(gl))
  return useMemo(() => {
    scenes.set(url, data.scene)
    data.scene.traverse(node => {
      for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
        for (const texture of Object.values(material)) if (texture?.isTexture && !textures.has(texture)) {
          textures.add(texture)
          texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
          texture.onUpdate = () => releaseTextureImage(texture)
        }
      }
    })
    return data
  }, [url, data, gl])
}
export const clearTableAssets = () => {
  const disposed = new Set()
  const dispose = resource => { if (resource && !disposed.has(resource)) { disposed.add(resource); resource.dispose() } }
  for (const scene of scenes.values()) scene.traverse(node => {
    if (!node.isMesh) return
    dispose(node.geometry)
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) dispose(material)
  })
  for (const texture of textures) { releaseTextureImage(texture); dispose(texture) }
  textures.clear(); scenes.clear()
  ktx2?.dispose(); ktx2 = undefined
  for (const url of TABLE_MODEL_URLS) useGLTF.clear(url)
}

// Run after the loaded scene commits, before its first animation frame.
export function warmTableScene(scene, camera, gl) {
  gl.compile(scene, camera)
  // compile() creates programs lazily; resolve their uniforms before a draw can block.
  for (const program of gl.info.programs) { program.getUniforms(); program.getAttributes() }
  const textures = new Set()
  scene.traverse(node => {
    for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  for (const texture of textures) gl.initTexture(texture)
}

export function disposeClonedSkeletons(scene) {
  const skeletons = new Set()
  scene.traverse(node => { if (node.isSkinnedMesh) skeletons.add(node.skeleton) })
  for (const skeleton of skeletons) skeleton.dispose()
}
