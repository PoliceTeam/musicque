export const bubbleText = text => {
  const characters = Array.from(typeof text === 'string' ? text : '')
  return characters.length > 60 ? characters.slice(0, 60).join('') + '…' : characters.join('')
}
