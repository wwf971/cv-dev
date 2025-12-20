/**
 * Fetches data from remote server for patterns like {{remote:path/to/resource}}
 * @param {Object|Array} data - The data object to process
 * @param {String} serverOrigin - Server origin URL
 * @param {String} getToken - GET token for authentication
 * @returns {Object} Plain data object with remote values fetched
 */
export async function fetchRemoteData(data, serverOrigin, getToken) {
  // Create a deep copy (plain object, not reactive)
  const workingData = JSON.parse(JSON.stringify(data))
  
  // Pattern to match {{remote:path}}
  const remotePattern = /\{\{remote:([^}]+)\}\}/g
  
  // Store all fetch promises
  const fetchPromises = []
  
  /**
   * Recursively traverse and collect fetch tasks
   */
  function traverseAndCollect(obj, path = []) {
    if (typeof obj === 'string') {
      // Check if string contains remote patterns
      const matches = [...obj.matchAll(remotePattern)]
      if (matches.length > 0) {
        matches.forEach(match => {
          const remotePath = match[1]
          const fullPattern = match[0]
          
          // Create fetch promise
          const fetchPromise = fetchRemoteValue(serverOrigin, remotePath, getToken)
            .then(value => {
              // Replace the pattern in the string
              const current = getNestedValue(workingData, path)
              if (typeof current === 'string') {
                const newValue = current.replace(fullPattern, value)
                setNestedValue(workingData, path, newValue)
              }
            })
            .catch(error => {
              // Replace with error message
              const current = getNestedValue(workingData, path)
              if (typeof current === 'string') {
                const errorMsg = `[Error: ${error.message}]`
                const newValue = current.replace(fullPattern, errorMsg)
                setNestedValue(workingData, path, newValue)
              }
            })
          
          fetchPromises.push(fetchPromise)
        })
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverseAndCollect(item, [...path, index])
      })
    } else if (obj !== null && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        traverseAndCollect(obj[key], [...path, key])
      })
    }
  }
  
  // Traverse and collect all fetch tasks
  traverseAndCollect(workingData)
  
  // Execute all fetches
  await Promise.all(fetchPromises)
  
  return workingData
}

/**
 * Fetch a single remote value from server
 */
async function fetchRemoteValue(serverOrigin, path, getToken) {
  const url = `${serverOrigin}/${path}?token=${encodeURIComponent(getToken)}`
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    // Check Content-Type to determine how to handle response
    const contentType = response.headers.get('Content-Type') || ''
    
    // Handle image responses - convert to data URL
    if (contentType.startsWith('image/')) {
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result) // returns data:image/png;base64,...
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }
    
    // Handle text/JSON responses
    const text = await response.text()
    
    // Try to parse as JSON to check for error format
    try {
      const data = JSON.parse(text)
      
      // If JSON has 'code' field and code is not 0, it's an error response
      if (data.code !== undefined && data.code !== 0) {
        throw new Error(data.message || `Server error (code: ${data.code})`)
      }
      
      // If it's JSON but code is 0 or no code field, return the data
      if (data.code === 0) {
        return data.data || data.message || text
      }
      
      // JSON without error code - return as string
      return text
    } catch (parseError) {
      // Not JSON or JSON parsing failed - return as plain text (success case)
      if (parseError.message.includes('Server error')) {
        // Re-throw server errors
        throw parseError
      }
      // Plain text response (success)
      return text
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get nested value from object using path array
 */
function getNestedValue(obj, path) {
  return path.reduce((current, key) => current?.[key], obj)
}

/**
 * Set nested value in object using path array
 */
function setNestedValue(obj, path, value) {
  if (path.length === 0) return
  
  const lastKey = path[path.length - 1]
  const parentPath = path.slice(0, -1)
  const parent = getNestedValue(obj, parentPath)
  
  if (parent) {
    parent[lastKey] = value
  }
}

