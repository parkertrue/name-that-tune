import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const FEATURES = [
  {
    icon: '📥',
    title: 'Import in seconds',
    body: 'Grab any Spotify playlist with the extractor bookmarklet and paste it straight into a deck.',
  },
  {
    icon: '🎧',
    title: 'Guess the track',
    body: 'A song clip plays, name the artist and title before the answer are revealed.',
  },
  {
    icon: '📈',
    title: 'Master with spaced repetition',
    body: 'Adaptive review retires the songs you know so every session focuses on the ones you don’t.',
  },
]

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-glow" aria-hidden="true" />
        <div className="home-content">
          <span className="home-eyebrow">
            <span className="equalizer" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </span>
            Spotify-powered trivia trainer
          </span>

          <h1>🎵 Name That Tune</h1>
          <p>A Spotify-powered song-flashcard trainer for trivia prep. Listen to a clip, guess the artist and title, and let adaptive review retire songs as you master them.</p>

          {isAuthenticated ? (
            <div className="home-actions home-actions--authenticated">
              <Link to="/decks" className="btn btn-primary">
                View My Decks
              </Link>
            </div>
          ) : (
            <div className="home-actions home-actions--guest">
              <Link to="/register" className="btn btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Login
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-features" aria-label="How it works">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="feature-card">
            <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
