import { useState, useEffect } from 'react'
import {
  fetchDecks,
  fetchAllSongsSummary,
  createDeck,
  deleteDeck,
  importTracks,
} from '../api/services/decksService'
import { getErrorMessage } from '../api/errors'
import { useAuth } from './useAuth'

export function useDecks() {
  const { isAuthenticated } = useAuth()
  const [decks, setDecks] = useState([])
  const [allSongs, setAllSongs] = useState({ total: 0, mastered: 0, active: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setDecks([])
      setAllSongs({ total: 0, mastered: 0, active: 0 })
      return
    }
    loadDecks()
  }, [isAuthenticated])

  const loadDecks = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, summary] = await Promise.all([
        fetchDecks(),
        fetchAllSongsSummary(),
      ])
      setDecks(data)
      if (summary) setAllSongs(summary)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const addDeck = async (name) => {
    try {
      const newDeck = await createDeck(name)
      setDecks((prev) => [...prev, newDeck])
      setError(null)
      return newDeck
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  const removeDeck = async (id) => {
    try {
      await deleteDeck(id)
      setDecks((prev) => prev.filter((d) => d.id !== id))
      // Removing a deck changes the deduplicated "All Songs" totals.
      const summary = await fetchAllSongsSummary()
      if (summary) setAllSongs(summary)
      setError(null)
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  const addTracks = async (deckId, tracks) => {
    try {
      const result = await importTracks(deckId, tracks)
      await loadDecks()
      setError(null)
      return result
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  return { decks, allSongs, loading, error, loadDecks, addDeck, removeDeck, addTracks }
}
