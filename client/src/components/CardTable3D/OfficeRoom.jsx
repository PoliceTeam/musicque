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
  const lampGlow = useMemo(() => ({ value: 0 }), [])
  const lampTarget = useMemo(() => { const target = new THREE.Object3D(); target.position.set(0, .785, 0); return target }, [])
  const roomMaterial = useMemo(() => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
    material.customProgramCacheKey = () => 'office-lamps-v2'
    material.onBeforeCompile = shader => {
      shader.uniforms.lampGlow = lampGlow
      shader.vertexShader = 'attribute float lampEmission; attribute float wallSurface; varying float vLampEmission; varying float vWallSurface; varying vec3 vRoomPosition;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLampEmission = lampEmission; vWallSurface = wallSurface; vRoomPosition = position;')
      shader.fragmentShader = 'uniform float lampGlow; varying float vLampEmission; varying float vWallSurface; varying vec3 vRoomPosition;\nfloat wallFalloff(vec3 source) { vec3 delta = vRoomPosition - source; float strength = max(0.0, 1.0 - dot(delta, delta) / .8); return strength * strength; }\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, .72, .35) * vLampEmission * lampGlow;\nfloat wallPool = wallFalloff(vec3(-1.9, 1.7, -2.95)) + wallFalloff(vec3(1.9, 1.7, -2.95)) + wallFalloff(vec3(2.95, 2.1, -.7)) + wallFalloff(vec3(2.95, 2.1, -1.6));\ntotalEmissiveRadiance += vec3(.4, .22, .08) * wallPool * vWallSurface * lampGlow;')
    }
    return material
  }, [lampGlow])
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
    lampGlow.value = isDark ? 1.6 : 0
    roomMaterial.emissive.set(isDark ? '#343c32' : '#000000'); roomMaterial.emissiveIntensity = 0.65
    scene.background.set(palette.fog); scene.fog = new THREE.Fog(palette.fog, 4, 9)
    scene.traverse(node => {
      if (node.isHemisphereLight) { node.color.set(isDark ? '#e1d7bd' : '#fff8ef'); node.groundColor.set(isDark ? '#7d7160' : palette.floorB); node.intensity = isDark ? 3.8 : 1.8 }
      if (node.isDirectionalLight) { node.color.set(isDark ? '#d2dccf' : '#fff2dc'); node.intensity = isDark ? 2 : 1.7 }
    })
    invalidate()
  }, [isDark, room, roomMaterial, lampGlow, scene, invalidate])
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
    {isDark && <><primitive object={lampTarget} /><spotLight name='pendant-light' position={[.55, 1.465, -.25]} target={lampTarget} color='#ffd49a' intensity={9} angle={Math.PI / 3} penumbra={.5} distance={4} decay={2} castShadow={false} /></>}
    <mesh geometry={room.geometry} material={roomMaterial} matrixAutoUpdate={false} dispose={null} />
    <mesh position={[0, 2.1, -2.855]} onUpdate={object => { object.updateMatrix(); object.matrixAutoUpdate = false }}><planeGeometry args={[1.6, 0.4]} /><meshBasicMaterial map={logo.texture} transparent depthWrite={false} /></mesh>
    {table && <WallInfoBoard table={table} turnMs={turnMs} />}
    <instancedMesh ref={chairs} args={[resources.chair, resources.wood, 4]} matrixAutoUpdate={false} />
    <instancedMesh ref={shadows} args={[resources.quad, resources.shadow, 5]} matrixAutoUpdate={false} />
  </>
}
