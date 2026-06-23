// Parse pasted song data into importable tracks: { spotify_id, title, artists[] }.
// Ported from the prototype's handleImport: tries bookmarklet JSON first, then
// loose Spotify-track-URL paste, then plain "Artist - Title" lines.

const ARTIST_SPLIT = /\s*(?:,\s*|&|\sfeat\.?\s|\sft\.?\s)/i

function splitArtists(artistStr) {
  return artistStr
    .split(ARTIST_SPLIT)
    .map((a) => a.trim())
    .filter(Boolean)
}

// Bookmarklet output: JSON array of { id, title, artists: [] }.
function parseBookmarkletJson(text) {
  if (!text.startsWith('[')) return []
  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((t) => t && t.title && Array.isArray(t.artists) && t.artists.length)
      .map((t) => ({
        spotify_id: t.id || null,
        title: String(t.title).trim(),
        artists: t.artists.map((a) => String(a).trim()).filter(Boolean),
      }))
      .filter((t) => t.title && t.artists.length)
  } catch {
    return []
  }
}

// Loose paste containing one or more open.spotify.com/track/<id> URLs, each
// preceded by its "Artist - Title" metadata.
function parseSpotifyUrls(text) {
  const urlPattern = /https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)\S*/g
  const urls = []
  let match
  while ((match = urlPattern.exec(text)) !== null) {
    urls.push({ id: match[1], fullUrl: match[0], idx: match.index })
  }
  if (!urls.length) return []

  const tracks = []
  for (let i = 0; i < urls.length; i++) {
    const prevEnd = i === 0 ? 0 : urls[i - 1].idx + urls[i - 1].fullUrl.length
    const meta = text.slice(prevEnd, urls[i].idx).replace(/\|/g, '').trim()

    const dashIdx = meta.indexOf(' - ')
    let artistStr = ''
    let title = ''
    if (dashIdx >= 0) {
      artistStr = meta.slice(0, dashIdx).trim()
      title = meta.slice(dashIdx + 3).trim()
    } else {
      title = meta
    }

    if (!title) continue
    tracks.push({
      spotify_id: urls[i].id,
      title,
      artists: splitArtists(artistStr),
    })
  }
  return tracks.filter((t) => t.artists.length)
}

// Plain text, one song per line: "Artist - Title".
function parsePlainText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const tracks = []
  for (const line of lines) {
    const dashIdx = line.indexOf(' - ')
    if (dashIdx < 0) continue
    const artistStr = line.slice(0, dashIdx).trim()
    const title = line.slice(dashIdx + 3).trim()
    const artists = splitArtists(artistStr)
    if (!title || !artists.length) continue
    tracks.push({ spotify_id: null, title, artists })
  }
  return tracks
}

export function parseImport(rawText) {
  const text = (rawText || '').trim()
  if (!text) return []

  let tracks = parseBookmarkletJson(text)
  if (!tracks.length && text.includes('open.spotify.com/track/')) {
    tracks = parseSpotifyUrls(text)
  }
  if (!tracks.length) {
    tracks = parsePlainText(text)
  }
  return tracks
}
