export const getTargets = (state) => {
  if (!state?.me || state.phase !== 'playing') return {}
  const me = state.me
  const near = (target, range) => {
    if (!target || Math.hypot(target.x - me.x, target.y - me.y) > range) return false
    const steps = Math.max(1, Math.ceil(Math.hypot(target.x - me.x, target.y - me.y) / 6))
    for (let i = 0; i <= steps; i++) {
      const x = me.x + (target.x - me.x) * i / steps
      const y = me.y + (target.y - me.y) * i / steps
      if ((state.map.walls || []).some((w) => x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.height)) return false
    }
    return true
  }
  return {
    vent: me.alive && me.role === 'saboteur' ? (state.map.vents || []).find(v => near(v, 35)) : null,
    reactorPanel: me.alive && state.reactor ? (state.map.reactorPanels || []).find(v => near(v, 35)) : null,
    task: me.role === 'crew' ? me.tasks.find((t) => !t.done && near(t, 78)) : null,
    body: me.alive ? state.bodies.find((b) => near(b, 100)) : null,
    victim: me.alive && me.role === 'saboteur' ? state.players.find((p) => p.userId !== me.userId && p.alive && p.connected && near(p, 64)) : null,
    emergency: me.alive && !me.emergencyUsed && !state.lightsUntil && !state.reactor && near(state.map.emergency, 78),
    repair: me.alive && state.lightsUntil && near(state.map.repair, 78),
  }
}
export const secondsLeft = (deadline, now) => Math.max(0, Math.ceil(((deadline || 0) - now) / 1000))
