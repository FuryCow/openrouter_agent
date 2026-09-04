export function simpleLineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const lines: string[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    if (oldLine === newLine) {
      lines.push(`  ${oldLine ?? ''}`)
    } else {
      if (oldLine !== undefined) lines.push(`- ${oldLine}`)
      if (newLine !== undefined) lines.push(`+ ${newLine}`)
    }
  }

  return lines.join('\n')
}
