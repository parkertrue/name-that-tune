import { useState } from 'react'
import { useDecks } from '../hooks/useDecks'
import DeckForm from '../components/decks/DeckForm'
import DeckList from '../components/decks/DeckList'
import ImportPanel from '../components/decks/ImportPanel'

export default function DecksPage() {
  const { decks, allSongs, loading, error, addDeck, removeDeck, addTracks } = useDecks()
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [importing, setImporting] = useState(false)

  const handleDelete = async (deck) => {
    if (window.confirm(`Delete "${deck.name}" and all its songs?`)) {
      await removeDeck(deck.id)
      if (String(deck.id) === selectedDeckId) setSelectedDeckId('')
    }
  }

  const handleImport = async (tracks) => {
    if (!selectedDeckId) {
      throw new Error('Select a deck to import into first.')
    }
    setImporting(true)
    try {
      return await addTracks(Number(selectedDeckId), tracks)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="decks-page">
      <div className="decks-container">
        <header className="page-banner">
          <div className="page-banner-glow" aria-hidden="true" />
          <h1>🎵 Name That Tune</h1>
          <p className="decks-subtitle">
            Build decks of songs, then study by guessing the artist and title.
          </p>
        </header>

        <DeckForm onSubmit={addDeck} loading={loading} />

        {error && (
          <div className="error-message" data-testid="error-message">{error}</div>
        )}

        <DeckList decks={decks} allSongs={allSongs} loading={loading} onDelete={handleDelete} />

        {decks.length > 0 && (
          <div className="import-section">
            <label className="import-deck-select">
              Import into:
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                data-testid="import-deck-select"
              >
                <option value="">Select a deck...</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <ImportPanel onImport={handleImport} importing={importing} />
          </div>
        )}
      </div>
    </div>
  )
}
