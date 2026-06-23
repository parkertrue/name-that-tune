import { useState } from 'react'
import { validateDeckName, DECK_NAME_MAX_LENGTH } from '../../utils/validation'

export default function DeckForm({ onSubmit, loading }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errors = validateDeckName(name)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }

    setError('')

    try {
      await onSubmit(name.trim())
      setName('')
    } catch (err) {
      // Error surfaced by parent
    }
  }

  const handleChange = (e) => {
    setName(e.target.value)
    if (error) setError('')
  }

  return (
    <form onSubmit={handleSubmit} className="deck-form" data-testid="deck-form">
      <div className="deck-form-group">
        <input
          type="text"
          value={name}
          onChange={handleChange}
          placeholder="New deck name (e.g. 80s Rock)..."
          disabled={loading}
          className={`deck-input ${error ? 'error' : ''}`}
          data-testid="deck-name-input"
          aria-invalid={!!error}
          maxLength={DECK_NAME_MAX_LENGTH}
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn btn-primary"
          data-testid="deck-submit"
        >
          {loading ? 'Creating...' : 'Create Deck'}
        </button>
      </div>
      {error && (
        <div className="field-error" data-testid="deck-name-error">
          {error}
        </div>
      )}
    </form>
  )
}
