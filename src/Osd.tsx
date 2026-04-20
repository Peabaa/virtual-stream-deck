import './App.css';

function Osd() {
  const buttons = Array.from({ length: 9 }, (_, i) => i + 1);

  return (
    <main data-tauri-drag-region className="deck-container">
      <div className="status-bar">
        <span>Numpad Deck</span>
        <div className="dot" />
      </div>

      <div className="button-grid">
        {buttons.map((btn) => (
          <button key={btn} className="deck-button">
            {btn}
          </button>
        ))}
      </div>
    </main>
  );
}

export default Osd;
