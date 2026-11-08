/**
 * Convert Gregorian year to Japanese era year (abbreviated form)
 * @param year - Gregorian year (e.g., 2024)
 * @returns Japanese era year string in abbreviated form (e.g., "令6")
 */
export function toYearJp(year: number): string {
  if (year >= 2019) {
    // Reiwa (令和) era started in 2019
    const eraYear = year - 2019 + 1
    return `令和${eraYear}`
  } else if (year >= 1989) {
    // Heisei (平成) era: 1989-2018
    const eraYear = year - 1989 + 1
    return `平成${eraYear}`
  } else if (year >= 1926) {
    // Showa (昭和) era: 1926-1988
    const eraYear = year - 1926 + 1
    return `昭和${eraYear}`
  } else if (year >= 1912) {
    // Taisho (大正) era: 1912-1925
    const eraYear = year - 1912 + 1
    return `大正${eraYear}`
  } else {
    // For years before Taisho, just return the year
    return String(year)
  }
}

/**
 * Calculate precise age based on birth date
 * Age only increments after the birthday passes in the current year
 * @param birthYear - Birth year (e.g., 1993)
 * @param birthMonth - Birth month (1-12)
 * @param birthDay - Birth day (1-31)
 * @param referenceDate - Optional reference date (defaults to today)
 * @returns Current age
 */
export function calcAge(birthYear: number, birthMonth: number, birthDay: number, referenceDate?: Date): number {
  const today = referenceDate || new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1 // getMonth() returns 0-11
  const currentDay = today.getDate()

  let age = currentYear - birthYear

  // If birthday hasn't occurred yet this year, subtract 1 from age
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age--
  }

  return age
}

/**
 * Process description text: replace spaces with non-breaking spaces and split by \n only
 * Preserves existing line breaks in the text without trying to parse HTML
 * Used for proper text formatting in CV content
 * @param text - Raw text to process
 * @returns Array of processed lines with spaces converted to non-breaking spaces
 */
export function processDescription(text: string): string[] {
  if (!text) return []

  // Split by \n only - preserve whatever line breaks exist in the server data
  const lines = text.split('\n')

  // For each line, replace each space with non-breaking space
  // DON'T trim - preserve leading spaces
  return lines
    .filter(line => line.length > 0)
    .map(line => line.replace(/ /g, '\u00A0')) // Each space becomes non-breaking space
}

/**
 * Create a content cell with single line of text
 * @param content - Text content
 * @param cssClass - CSS class for the cell
 * @returns Cell configuration object
 */
export function createContentCell(content: string, cssClass: string) {
  return {
    items: [{ type: 'Text', data: { content } }],
    cssClass: `cv-jp-cell ${cssClass}`,
    fillToPageBottom: true
  }
}

/**
 * Create a content cell with multiple lines of text
 * Each line becomes a separate Text component (span) for proper pagination
 * CSS should make spans display as blocks for visual line breaks
 * @param lines - Array of text lines
 * @param cssClass - CSS class for the cell
 * @returns Cell configuration object
 */
export function createMultiLineContentCell(lines: string[], cssClass: string) {
  const items: any[] = []

  // Add each line as a separate Text item for pagination control
  lines.forEach(line => {
    items.push({
      type: 'Text',
      data: {
        content: line,
        display: 'block'  // Make multi-line text display as blocks
      }
    })
  })

  return {
    items,
    cssClass: `cv-jp-cell ${cssClass}`,
    fillToPageBottom: true
  }
}
