import Board from './components/Board';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      {/* 
        The Board component is the exposed federation component. 
        It expects a roomId, if not provided it can generate a default.
      */}
      <Board roomId="default-room" />
    </div>
  );
}

export default App;
