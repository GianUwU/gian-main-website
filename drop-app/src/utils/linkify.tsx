import React from 'react'

const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi

interface RenderTextWithLinksOptions {
  fallbackLink?: string
  className?: string
  linkClassName?: string
}

export function containsUrl(text?: string | null): boolean {
  if (!text) return false
  return /(https?:\/\/|www\.)/i.test(text)
}

export function renderTextWithLinks(
  text?: string | null,
  options?: RenderTextWithLinksOptions
): React.ReactNode {
  if (!text) return text ?? null

  const { fallbackLink, className, linkClassName = 'clickable-title-link' } = options || {}

  const parts = text.split(URL_REGEX)
  if (parts.length === 1 && !parts[0].match(/^(https?:\/\/|www\.)/i)) {
    if (fallbackLink) {
      return (
        <a href={fallbackLink} className={className || 'file-name-default-link'}>
          {text}
        </a>
      )
    }
    return text
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null

        const isUrl = /^(https?:\/\/|www\.)/i.test(part)
        if (isUrl) {
          const href = /^https?:\/\//i.test(part) ? part : `https://${part}`
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }

        if (fallbackLink) {
          return (
            <a key={index} href={fallbackLink} className="file-name-default-link">
              {part}
            </a>
          )
        }

        return <React.Fragment key={index}>{part}</React.Fragment>
      })}
    </span>
  )
}
