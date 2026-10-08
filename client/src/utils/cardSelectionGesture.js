export function bindCardSelection(canvas, hitCard, getState) {
  let gesture = null, suppressClick = false, firstClick = null
  const down = event => {
    if (event.button !== 0) return
    const card = hitCard(event)
    if (!card) return
    suppressClick = false
    const { selectedCards } = getState()
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, card, selected: !selectedCards.includes(card), dragging: false, visited: new Set() }
    event.stopImmediatePropagation()
  }
  const move = event => {
    if (!gesture || gesture.id !== event.pointerId) return
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return
    gesture.dragging = true
    firstClick = null
    const apply = card => {
      if (card && !gesture.visited.has(card)) { gesture.visited.add(card); getState().setCardSelected?.(card, gesture.selected) }
    }
    apply(gesture.card)
    const samples = event.getCoalescedEvents?.()
    for (const sample of samples?.length ? samples : [event]) {
      const dx = sample.clientX - gesture.lastX, dy = sample.clientY - gesture.lastY
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4))
      for (let i = 1; i <= steps; i++) apply(hitCard({ type: 'pointermove', clientX: gesture.lastX + dx * i / steps, clientY: gesture.lastY + dy * i / steps }))
      gesture.lastX = sample.clientX; gesture.lastY = sample.clientY
    }
    event.preventDefault(); event.stopImmediatePropagation()
  }
  const up = event => {
    if (!gesture || gesture.id !== event.pointerId) return
    suppressClick = gesture.dragging || event.type === 'pointercancel'
    gesture = null
  }
  const click = event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return }
    const card = hitCard(event)
    if (!card) return
    if (event.detail < 2) {
      firstClick = { card, cards: [...getState().selectedCards] }
      getState().toggleCard(card)
    }
    event.stopImmediatePropagation()
  }
  const doubleClick = event => {
    if (event.target !== canvas && !canvas.contains(event.target)) return
    // Lá đã đổi vị trí sau lần nhấp đầu; giữ bộ cũ và chặn reset camera.
    const card = firstClick?.card || hitCard(event)
    if (!card) return
    if (firstClick?.card === card && firstClick.cards.includes(card)) getState().playSelection(firstClick.cards)
    firstClick = null
    event.preventDefault(); event.stopImmediatePropagation()
  }
  const clear = event => { event.preventDefault(); getState().clearSelection?.() }
  canvas.addEventListener('pointerdown', down, true)
  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', up, true)
  canvas.addEventListener('click', click, true)
  window.addEventListener('dblclick', doubleClick, true)
  canvas.addEventListener('contextmenu', clear)
  return () => {
    canvas.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', up, true)
    canvas.removeEventListener('click', click, true)
    window.removeEventListener('dblclick', doubleClick, true)
    canvas.removeEventListener('contextmenu', clear)
  }
}
