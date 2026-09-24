// Identity LiveKit: userId:socketId. Phần sau dấu ':' đầu tiên là socket trong Workspace.
export const speakerSocketIds = (participants) => [...new Set(participants
  .map((participant) => {
    const identity = participant?.identity || ''
    const separator = identity.indexOf(':')
    return separator > 0 ? identity.slice(separator + 1) : null
  })
  .filter(Boolean))]
