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
