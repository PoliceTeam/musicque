import React, { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AnimationContext, createAnimationActivity } from './activity'
export function AnimationActivity({ children }) {
  const invalidate = useThree(state => state.invalidate)
  const activity = useMemo(() => createAnimationActivity(invalidate), [invalidate])
  useFrame(() => activity.tick())
  return <AnimationContext.Provider value={activity}>{children}</AnimationContext.Provider>
}
