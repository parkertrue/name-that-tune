import { api } from '../api'

export async function fetchDecks() {
  const response = await api.get('/decks')
  return response.data
}

export async function createDeck(name) {
  const response = await api.post('/decks', { name })
  return response.data
}

export async function fetchDeck(id) {
  const response = await api.get(`/decks/${id}`)
  return response.data
}

// Deduplicated totals for the virtual "All Songs" scope (a song in several
// decks is counted once), matching what studying "All Songs" presents.
export async function fetchAllSongsSummary() {
  const response = await api.get('/decks/all')
  return response.data
}

export async function deleteDeck(id) {
  await api.delete(`/decks/${id}`)
}

// Delete a single track (one deck's copy of a song). The song leaves the
// virtual "All Songs" scope unless another deck still holds a copy.
export async function deleteTrack(trackId) {
  await api.delete(`/decks/tracks/${trackId}`)
}

export async function importTracks(deckId, tracks) {
  const response = await api.post(`/decks/${deckId}/tracks`, { tracks })
  return response.data
}

export async function resetDeck(id) {
  const response = await api.post(`/decks/${id}/reset`)
  return response.data
}

export async function studyNext(deckId, excludeId) {
  const params = {}
  if (deckId != null) params.deck_id = deckId
  if (excludeId != null) params.exclude = excludeId
  const response = await api.get('/study/next', { params })
  return response.data
}

export async function gradeAnswer({
  trackId,
  action,
  rating = null,
  guessArtists = [],
  guessTitle = '',
  deckId,
}) {
  const response = await api.post('/study/grade', {
    track_id: trackId,
    action,
    rating,
    guess_artists: guessArtists,
    guess_title: guessTitle,
    deck_id: deckId != null ? String(deckId) : null,
  })
  return response.data
}

// future: searchSpotifyPlaylist(query) — in-app Spotify playlist search will
// call a /spotify/* backend endpoint and return importable tracks.
