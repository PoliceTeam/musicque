import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { chairGeometry, chairPlacement } from './chair'
function shadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.35)'); gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}
export default function OfficeRoom() {
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
  useEffect(() => () => { resources.chair.dispose(); resources.wood.dispose(); resources.quad.dispose(); resources.shadow.map.dispose(); resources.shadow.dispose() }, [resources])
  return <>
    <instancedMesh ref={chairs} args={[resources.chair, resources.wood, 4]} />
    <instancedMesh ref={shadows} args={[resources.quad, resources.shadow, 5]} />
  </>
}
