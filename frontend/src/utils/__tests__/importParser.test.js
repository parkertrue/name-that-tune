import { describe, it, expect } from 'vitest'
import { parseImport } from '../importParser'

describe('parseImport', () => {
  describe('bookmarklet JSON', () => {
    it('parses a JSON array of tracks', () => {
      const json = JSON.stringify([
        { id: 'abc123', title: 'Bohemian Rhapsody', artists: ['Queen'] },
        { id: 'def456', title: 'Crazy in Love', artists: ['Beyoncé', 'Jay-Z'] },
      ])
      const tracks = parseImport(json)
      expect(tracks).toHaveLength(2)
      expect(tracks[0]).toEqual({
        spotify_id: 'abc123',
        title: 'Bohemian Rhapsody',
        artists: ['Queen'],
      })
      expect(tracks[1].artists).toEqual(['Beyoncé', 'Jay-Z'])
    })

    it('skips JSON entries missing title or artists', () => {
      const json = JSON.stringify([
        { id: 'a', title: 'Has Both', artists: ['X'] },
        { id: 'b', title: '', artists: ['Y'] },
        { id: 'c', title: 'No Artists', artists: [] },
      ])
      expect(parseImport(json)).toHaveLength(1)
    })
  })

  describe('Spotify URL paste', () => {
    it('parses "Artist - Title | url" lines', () => {
      const text = 'Queen - Bohemian Rhapsody | https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv'
      const tracks = parseImport(text)
      expect(tracks).toHaveLength(1)
      expect(tracks[0].spotify_id).toBe('4u7EnebtmKWzUH433cf5Qv')
      expect(tracks[0].title).toBe('Bohemian Rhapsody')
      expect(tracks[0].artists).toEqual(['Queen'])
    })

    it('splits multiple/featured artists', () => {
      const text = 'Beyoncé, Jay-Z - Crazy in Love | https://open.spotify.com/track/5IVuqXILoxVWvWEPm82Bkj'
      const tracks = parseImport(text)
      expect(tracks[0].artists).toEqual(['Beyoncé', 'Jay-Z'])
    })
  })

  describe('plain text', () => {
    it('parses "Artist - Title" lines without URLs', () => {
      const text = 'Queen - Bohemian Rhapsody\nMadonna - Like a Prayer'
      const tracks = parseImport(text)
      expect(tracks).toHaveLength(2)
      expect(tracks[0]).toEqual({
        spotify_id: null,
        title: 'Bohemian Rhapsody',
        artists: ['Queen'],
      })
    })

    it('ignores lines without a " - " separator', () => {
      const text = 'just a title with no separator\nQueen - Real Song'
      const tracks = parseImport(text)
      expect(tracks).toHaveLength(1)
      expect(tracks[0].title).toBe('Real Song')
    })
  })

  it('returns [] for empty input', () => {
    expect(parseImport('')).toEqual([])
    expect(parseImport('   ')).toEqual([])
    expect(parseImport(null)).toEqual([])
  })

  it('returns [] for unparseable input', () => {
    expect(parseImport('no songs here at all')).toEqual([])
  })
})
