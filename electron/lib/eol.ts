export type Eol = '\r\n' | '\n'

/** The first line break in the content decides the file's EOL style. */
export function detectEol(content: string): Eol {
  const idx = content.indexOf('\n')
  if (idx === -1) return '\n'
  return idx > 0 && content[idx - 1] === '\r' ? '\r\n' : '\n'
}

/** Converts every line break in `text` to the given EOL style. */
export function applyEol(text: string, eol: Eol): string {
  return text.replace(/\r?\n/g, eol)
}

export type EolAwareReplaceResult =
  | { status: 'ok'; updated: string; replacements: number }
  | { status: 'not_found' }
  | { status: 'ambiguous'; count: number }

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Literal substring replace that tolerates line-ending differences between
 * old_string and the file (LF vs CRLF, either direction). Bytes outside the
 * matched spans are preserved exactly, so mixed-EOL files stay intact.
 */
export function eolAwareReplace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false
): EolAwareReplaceResult {
  if (!oldString) return { status: 'not_found' }

  // \r?\n in the pattern matches LF, CRLF, and stray CR before LF alike.
  const pattern = new RegExp(escapeRegExp(oldString).replace(/\r?\n/g, '\\r?\\n'), 'g')
  const matches = [...content.matchAll(pattern)]

  if (matches.length === 0) return { status: 'not_found' }
  if (matches.length > 1 && !replaceAll) return { status: 'ambiguous', count: matches.length }

  // Function replacement: avoids `$&`-style substitution in new_string.
  const normalizedNew = applyEol(newString, detectEol(content))
  const updated = content.replace(pattern, () => normalizedNew)

  return { status: 'ok', updated, replacements: matches.length }
}