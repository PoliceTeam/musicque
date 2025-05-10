import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import MainScene from './scenes/MainScene'

const DiceGame = ({ finalValue }) => {
  const gameRef = useRef(null)
  const gameInstance = useRef(null)

  useEffect(() => {
    if (gameInstance.current) return

    const config = {
      type: Phaser.AUTO,
      width: 400,
      height: 400,
      parent: gameRef.current,
      backgroundColor: '#ffffff',
      scene: MainScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    }

    gameInstance.current = new Phaser.Game(config)

    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true)
        gameInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (gameInstance.current && finalValue) {
      const checkScene = setInterval(() => {
        const scene = gameInstance.current.scene.getScene('MainScene')
        if (scene) {
          scene.setFinalValue(finalValue)
          clearInterval(checkScene)
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkScene)
      }, 5000)
    }
  }, [finalValue])

  return (
    <div
      className='dice-game-container'
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        height: '400px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div ref={gameRef} />
    </div>
  )
}

export default DiceGame
