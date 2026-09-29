import { useState, useEffect } from 'react'
import { parseImport } from '../../utils/importParser'
import { BOOKMARKLET_CODE } from '../../utils/bookmarklet'

export default function ImportPanel({ onImport, importing }) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable; the textarea below lets the user copy manually.
    }
  }

  const handleImport = async (e) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    const tracks = parseImport(text)
    if (!tracks.length) {
      setError('Could not find any songs to import. Paste bookmarklet JSON or "Artist - Title" lines.')
      return
    }

    try {
      const result = await onImport(tracks)
      const added = result?.added ?? 0
      setMessage(`Imported ${added} song${added === 1 ? '' : 's'} (${tracks.length} parsed).`)
      setText('')
    } catch (err) {
      setError(err.message || 'Import failed')
    }
  }

  return (
    <div className="import-panel" data-testid="import-panel">
      <h2>Import songs</h2>

      <details className="import-instructions">
        <summary>⚡ How to extract a Spotify playlist (bookmarklet)</summary>
        <ol>
          <li>Copy the bookmarklet code below.</li>
          <li>Create a new browser bookmark and paste the code as its URL.</li>
          <li>Open your playlist on <a href="https://open.spotify.com" target="_blank" rel="noreferrer">open.spotify.com</a>.</li>
          <li>Click the bookmark, then <strong>scroll slowly</strong> to the bottom.</li>
          <li>Click <strong>“Done - Copy”</strong>, then paste below.</li>
        </ol>
        <textarea
          className="bookmarklet-code"
          readOnly
          value={BOOKMARKLET_CODE}
          onClick={(e) => e.target.select()}
          data-testid="bookmarklet-code"
          rows={4}
        />
        <button type="button" className="btn btn-secondary" onClick={handleCopyBookmarklet}>
          {copied ? '✓ Copied!' : 'Copy bookmarklet code'}
        </button>
      </details>

      <form onSubmit={handleImport}>
        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste extracted JSON here, or type manually:\nQueen - Bohemian Rhapsody\nBeyoncé - Crazy in Love | https://open.spotify.com/track/5IVuqXILoxVWvWEPm82Bkj'}
          data-testid="import-textarea"
          rows={6}
          disabled={importing}
        />
        <button
          type="submit"
          className="btn btn-primary"
          data-testid="import-submit"
          disabled={importing || !text.trim()}
        >
          {importing ? 'Importing...' : 'Import songs'}
        </button>
      </form>

      {message && (
        <div className="success-message" data-testid="import-success">{message}</div>
      )}
      {error && (
        <div className="error-message" data-testid="import-error">{error}</div>
      )}
    </div>
  )
}
