import React, { useEffect, useRef } from 'react';
import { Typography } from 'antd';
import { Nostalgist } from 'nostalgist';

const { Title } = Typography;

const NesGame = ({ gameFile, gameName, onClose }) => {
  const containerRef = useRef(null);
  const nostalgistRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const loadGame = async () => {
      try {
        const response = await fetch(gameFile);
        if (!response.ok) {
          throw new Error(`Failed to load game: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const rom = new Uint8Array(arrayBuffer);

        const nostalgist = await Nostalgist.nes(rom, {
          element: containerRef.current,
        });

        nostalgistRef.current = nostalgist;
      } catch (error) {
        console.error('Error loading game:', error);
      }
    };

    loadGame();

    return () => {
      if (nostalgistRef.current) {
        nostalgistRef.current.exit?.();
      }
    };
  }, [gameFile]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default NesGame;
