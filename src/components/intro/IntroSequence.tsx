import type { CSSProperties, MouseEvent } from 'react'
import { portfolio } from '../../data/portfolio'
import { scrollToSection } from '../../lib/lenis'
import './mission-console.css'

/**
 * The landing screen: a mission console carrying the name, the credential and
 * the record, at full size, on first paint.
 *
 * Design contract (see mission-console.css for the layout rules):
 *  - Every value shown here is read from `portfolio` — there is no chart, no
 *    synthetic telemetry and no generated date. The record rows are
 *    `portfolio.stats` verbatim.
 *  - This section holds the document's only <h1>, and it carries the name plus
 *    the credential rather than a slogan.
 *  - Nothing is measured in JS, so there is no post-paint correction, and the
 *    whole thing is one viewport tall — no scroll is required to read it.
 *  - The entrance is a single staggered reveal driven entirely by CSS, which
 *    means `prefers-reduced-motion` turns it off before the first frame rather
 *    than after a hook resolves.
 */

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

/** Stagger step for the power-on sequence, in milliseconds. */
function delay(ms: number): CSSProperties {
  return { '--mc-delay': `${ms}ms` } as CSSProperties
}

/** The delta mark from the site favicon — this person's mission mark. */
function MissionMark() {
  return (
    <svg
      className="mc-rail__mark"
      width="9"
      height="12"
      viewBox="11 5 10 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16 5.5 20.5 18.5 16 15.5 11.5 18.5Z" fill="currentColor" />
    </svg>
  )
}

export function IntroSequence() {
  const { identity, stats, contact } = portfolio

  const jumpTo = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    // Real hrefs so the buttons survive without JS and can be opened in a new
    // tab; the handler takes over so the page travels instead of snapping.
    event.preventDefault()
    scrollToSection(id)
  }

  return (
    <section
      id="intro"
      data-mission-waypoint
      data-waypoint-side="center"
      className="mission-console"
      aria-labelledby="intro-heading"
    >
      <div className="mc-panel">
        {CORNERS.map((corner) => (
          <span key={corner} className={`mc-corner mc-corner--${corner}`} aria-hidden="true" />
        ))}

        <div className="mc-rail mc-rail--top mc-enter" style={delay(0)}>
          <span className="mc-rail__designation">
            <MissionMark />
            Mission console
          </span>
          <span className="mc-rail__origin">
            <span className="mc-rail__school">{identity.school} · </span>
            {identity.location}
          </span>
        </div>

        <div className="mc-bezel mc-enter" style={delay(40)} aria-hidden="true" />

        <div className="mc-body">
          <div className="mc-identity">
            <h1 id="intro-heading" className="mc-title mc-enter" style={delay(80)}>
              <span className="mc-title__name">{identity.name}</span>
              <span className="mc-title__credential">{identity.title}</span>
            </h1>

            <p className="mc-tagline mc-enter" style={delay(150)}>
              {identity.tagline}
            </p>

            <div className="mc-actions mc-enter" style={delay(210)}>
              <a className="mc-cta mc-cta--primary" href="#projects" onClick={jumpTo('projects')}>
                View the work
              </a>
              <a className="mc-cta mc-cta--ghost" href="#contact" onClick={jumpTo('contact')}>
                {contact.heading}
              </a>
            </div>
          </div>

          <div className="mc-readout mc-enter" style={delay(260)}>
            <h2 className="mc-readout__title">Selected record</h2>
            <dl className="mc-readout__list">
              {stats.map((stat) => (
                <div className="mc-record" key={stat.label}>
                  <dt className="mc-record__label">{stat.label}</dt>
                  <dd className="mc-record__value">
                    {stat.display ?? stat.value}
                    {!stat.display && stat.suffix && (
                      <span className="mc-record__suffix">{stat.suffix}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mc-status mc-enter" style={delay(330)}>
          <span className="mc-status__label">
            <span className="mc-status__marker" aria-hidden="true">
              ◆
            </span>
            Status
          </span>
          <p className="mc-status__text">{contact.message}</p>
          <a className="mc-status__link" href={`mailto:${identity.email}`}>
            {identity.email}
          </a>
        </div>
      </div>

      <p className="mc-scroll mc-enter" style={delay(400)} aria-hidden="true">
        Scroll
        <svg
          className="mc-scroll__arrow"
          width="10"
          height="14"
          viewBox="0 0 10 14"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 1v11M1 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </p>
    </section>
  )
}
