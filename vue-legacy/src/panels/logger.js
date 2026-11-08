/**
 * Logger utility for panel test components
 * Creates a logger that writes to a provided logs array or ref
 * @param {Array|Ref} logsArrayOrRef - The array or ref to push log entries to
 * @param {string} defaultFrom - Default source identifier for logs
 * @returns {Object} Logger object with addLog method
 */
export function createLogger(logsArrayOrRef, defaultFrom = 'unknown') {
  // Determine if we have a ref or a plain array
  const isRef = logsArrayOrRef && typeof logsArrayOrRef === 'object' && 'value' in logsArrayOrRef
  
  return {
    /**
     * Add a log entry to the logs array
     * @param {string} message - The log message
     * @param {string} from - Source identifier (optional, uses default if not provided)
     * @param {string} type - Log type (optional, defaults to 'Normal')
     */
    addLog: (message, from = defaultFrom, type = 'Normal') => {
      // Match the timestamp format from Pagination.vue
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      const ms = String(now.getMilliseconds()).padStart(2, '0')
      const tzOffset = -now.getTimezoneOffset()
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
      const tzSign = tzOffset >= 0 ? '+' : '-'
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}${ms}${tzSign}${tzHours}`

      const logEntry = {
        message,
        from: from || defaultFrom,
        type,
        timestamp
      }
      
      // Push to the correct target (ref.value or array)
      if (isRef) {
        logsArrayOrRef.value.push(logEntry)
      } else {
        logsArrayOrRef.push(logEntry)
      }
    }
  }
}
