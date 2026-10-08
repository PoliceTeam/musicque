import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useTheme } from '../../contexts/ThemeContext'
import { buildOfficeRoom, wallWordmarkSvg } from './officeRoom.js'
import { recolorRoom, roomPalettes } from './roomPalette'
import * as THREE from 'three'
import WallInfoBoard from './WallInfoBoard'
import { chairGeometry, chairPlacement } from './chair'
function shadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.35)'); gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}
let logoSource
export default function OfficeRoom({ table, turnMs }) {
  const { isDark } = useTheme()
  const { scene, invalidate } = useThree()
  const room = useMemo(buildOfficeRoom, [])
  const roomMaterial = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), [])
  const logo = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter
    return { canvas, texture }
  }, [])
  const chairs = useRef(), shadows = useRef()
  const resources = useMemo(() => ({ chair: chairGeometry(), wood: new THREE.MeshLambertMaterial({ color: '#403a35' }), quad: new THREE.PlaneGeometry(1, 1), shadow: new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }) }), [])
  useLayoutEffect(() => {
    const object = new THREE.Object3D()
    for (let i = 0; i < 4; i++) {
      const { position, yaw } = chairPlacement(i)
      object.position.fromArray(position); object.rotation.set(0, yaw, 0); object.scale.setScalar(1); object.updateMatrix()
      chairs.current.setMatrixAt(i, object.matrix)
      object.position.y = 0.001; object.rotation.set(-Math.PI / 2, 0, 0); object.scale.set(0.65, 0.65, 1); object.updateMatrix()
      shadows.current.setMatrixAt(i, object.matrix)
    }
    object.position.set(0, 0.001, 0); object.scale.set(0.9, 0.9, 1); object.updateMatrix(); shadows.current.setMatrixAt(4, object.matrix)
    chairs.current.instanceMatrix.needsUpdate = shadows.current.instanceMatrix.needsUpdate = true
  }, [])
  useLayoutEffect(() => {
    const palette = roomPalettes[isDark ? 'dark' : 'light']
    recolorRoom(room.geometry, room.paletteKeys, palette)
    roomMaterial.emissive.set(isDark ? '#202720' : '#000000'); roomMaterial.emissiveIntensity = 0.65
    scene.background.set(palette.fog); scene.fog = new THREE.Fog(palette.fog, 4, 9)
    scene.traverse(node => {
      if (node.isHemisphereLight) { node.color.set(isDark ? '#bac8bc' : '#fff8ef'); node.groundColor.set(palette.floorB); node.intensity = 1.8 }
      if (node.isDirectionalLight) { node.color.set(isDark ? '#d2dccf' : '#fff2dc'); node.intensity = isDark ? 1.3 : 1.7 }
    })
    invalidate()
  }, [isDark, room, roomMaterial, scene, invalidate])
  useEffect(() => {
    let cancelled = false, url, image
    logoSource ||= fetch('/brand/logo-wordmark.svg').then(response => { if (!response.ok) throw new Error('Wordmark failed to load'); return response.text() })
    logoSource.then(source => {
      if (cancelled) return
      const svg = wallWordmarkSvg(source, roomPalettes[isDark ? 'dark' : 'light'].logoTint)
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); image = new Image()
      image.onload = () => {
        if (!cancelled) { const context = logo.canvas.getContext('2d'); context.clearRect(0, 0, 512, 128); context.drawImage(image, 0, 13, 512, 102); logo.texture.needsUpdate = true; invalidate() }
        URL.revokeObjectURL(url); image.src = ''
      }
      image.src = url
    }).catch(() => { logoSource = undefined })
    return () => { cancelled = true; if (image) { image.onload = null; image.src = '' } if (url) URL.revokeObjectURL(url) }
  }, [logo, isDark, invalidate])
  useEffect(() => () => { scene.fog = null; room.geometry.dispose(); roomMaterial.dispose(); logo.texture.dispose() }, [scene, room, roomMaterial, logo])
  useEffect(() => () => { resources.chair.dispose(); resources.wood.dispose(); resources.quad.dispose(); resources.shadow.map.dispose(); resources.shadow.dispose() }, [resources])
  return <>
    <mesh geometry={room.geometry} material={roomMaterial} matrixAutoUpdate={false} dispose={null} />
    <mesh position={[0, 2.1, -2.855]} onUpdate={object => { object.updateMatrix(); object.matrixAutoUpdate = false }}><planeGeometry args={[1.6, 0.4]} /><meshBasicMaterial map={logo.texture} transparent depthWrite={false} /></mesh>
    {table && <WallInfoBoard table={table} turnMs={turnMs} />}
    <instancedMesh ref={chairs} args={[resources.chair, resources.wood, 4]} matrixAutoUpdate={false} />
    <instancedMesh ref={shadows} args={[resources.quad, resources.shadow, 5]} matrixAutoUpdate={false} />
  </>
}
