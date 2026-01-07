/**
 * Fetches data from remote server for patterns like {{remote:path/to/resource}} or {{mongo:db/coll/docId/field}}
 * @param {Object|Array} data - The data object to process
 * @param {String} serverOrigin - Server origin URL
 * @param {String} getToken - GET token for authentication
 * @param {String} mongoOrigin - MongoDB server origin URL
 * @param {String} mongoUsername - MongoDB username
 * @param {String} mongoPassword - MongoDB password
 * @returns {Object} Plain data object with remote values fetched
 */
export async function fetchRemoteData(data, serverOrigin, getToken, mongoOrigin = null, mongoUsername = null, mongoPassword = null) {
  // Create a deep copy (plain object, not reactive)
  let workingData = JSON.parse(JSON.stringify(data))
  
  // Pattern to match {{remote:path}}, {{remote:tree:path}}, or {{mongo:db/coll/docId/field}}
  const remotePattern = /\{\{remote:([^}]+)\}\}/g
  const treePattern = /\{\{remote:tree:([^}]+)\}\}/
  const mongoPattern = /\{\{mongo:([^}]+)\}\}/g
  
  // Store all fetch promises
  const fetchPromises = []
  
  // Track if we need to replace the root value
  let rootReplacement = null
  
  /**
   * Recursively traverse and collect fetch tasks
   */
  function traverseAndCollect(obj, path = []) {
    if (typeof obj === 'string') {
      // Check if it's a tree pattern first
      const treeMatch = obj.match(treePattern)
      if (treeMatch) {
        const identifier = treeMatch[1]
        
        // Fetch tree and replace with response object
        const fetchPromise = fetchTreeData(serverOrigin, identifier, getToken)
          .then(responseObj => {
            // Replace entire string with response object
            setNestedValue(workingData, path, responseObj)
          })
          .catch(error => {
            // Replace with error response object
            setNestedValue(workingData, path, {
              code: -1,
              data: null,
              message: `Error: ${error.message}`
            })
          })
        
        fetchPromises.push(fetchPromise)
        return
      }
      
      // Check if string contains mongo patterns
      const mongoMatches = [...obj.matchAll(mongoPattern)]
      if (mongoMatches.length > 0 && mongoOrigin) {
        mongoMatches.forEach(match => {
          const mongoPath = match[1]
          const fullPattern = match[0]
          
          // Check if the entire string is just the pattern
          const isFullPattern = obj.trim() === fullPattern
          
          // Create fetch promise for MongoDB
          const fetchPromise = fetchMongoValue(mongoOrigin, mongoPath, mongoUsername, mongoPassword)
            .then(value => {
              // Replace the pattern in the string
              const current = getNestedValue(workingData, path)
              if (typeof current === 'string') {
                if (isFullPattern && typeof value === 'object') {
                  // If entire string is the pattern and value is an object, replace with the object
                  if (path.length === 0) {
                    // Root level replacement
                    rootReplacement = value
                  } else {
                    setNestedValue(workingData, path, value)
                  }
                } else {
                  // Otherwise, replace pattern in the string (convert value to string if needed)
                  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
                  const newValue = current.replace(fullPattern, stringValue)
                  if (path.length === 0) {
                    // Root level replacement
                    rootReplacement = newValue
                  } else {
                    setNestedValue(workingData, path, newValue)
                  }
                }
              }
            })
            .catch(error => {
              // Replace with error message
              const current = getNestedValue(workingData, path)
              if (typeof current === 'string') {
                const errorMsg = `[Error: ${error.message}]`
                const newValue = current.replace(fullPattern, errorMsg)
                if (path.length === 0) {
                  // Root level replacement
                  rootReplacement = newValue
                } else {
                  setNestedValue(workingData, path, newValue)
                }
              }
            })
          
          fetchPromises.push(fetchPromise)
        })
      }
      
      // Check if string contains remote patterns
      const matches = [...obj.matchAll(remotePattern)]
      if (matches.length > 0) {
        matches.forEach(match => {
          const remotePath = match[1]
          const fullPattern = match[0]
          
          // Skip tree patterns (already handled above)
          if (remotePath.startsWith('tree:')) return
          
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
  
  // Execute all fetches in parallel - server now handles concurrent requests
  await Promise.all(fetchPromises)
  
  // Return root replacement if set, otherwise return workingData
  return rootReplacement !== null ? rootReplacement : workingData
}

/**
 * Fetch tree data from server
 * @param {String} serverOrigin - Server origin URL
 * @param {String} identifier - Path (must start with /)
 * @param {String} getToken - GET token for authentication
 * @returns {Object} Full response object {code, data, message}
 */
async function fetchTreeData(serverOrigin, identifier, getToken) {
  // Ensure path starts with / and ends with /
  let path = identifier
  if (!path.startsWith('/')) {
    path = '/' + path
  }
  if (!path.endsWith('/')) {
    path = path + '/'
  }
  
  // Remove leading slash for URL construction (serverOrigin already has it)
  const pathWithoutLeading = path.substring(1)
  const url = `${serverOrigin}/${pathWithoutLeading}?fetch_type=tree&token=${encodeURIComponent(getToken)}`
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data // Return full response object {code, data, message}
  } catch (error) {
    throw error
  }
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
 * Fetch a value from MongoDB server
 * @param {String} mongoOrigin - MongoDB server origin URL
 * @param {String} path - Path in format: db/collection/docId or db/collection/docId/field/path or db/collection?key=value&path=a.b.c
 * @param {String} username - MongoDB username
 * @param {String} password - MongoDB password
 * @returns {String} Fetched value
 */
async function fetchMongoValue(mongoOrigin, path, username, password) {
  // Check if path contains query string (e.g., main/cv?name=dimension-robotics&path=.)
  const queryIndex = path.indexOf('?')
  
  if (queryIndex !== -1) {
    // Query string format: db/collection?key=value&path=a.b.c
    const pathPart = path.substring(0, queryIndex)
    const queryPart = path.substring(queryIndex + 1)
    
    const parts = pathPart.split('/')
    if (parts.length < 2) {
      throw new Error(`Invalid MongoDB path: ${path}. Expected format: db/collection?key=value&path=...`)
    }
    
    const databaseName = parts[0]
    const collectionName = parts[1]
    
    // Construct URL with query parameters
    const url = `${mongoOrigin}/mongo/db/${databaseName}/coll/${collectionName}/docs?${queryPart}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      // Check for error response
      if (data.code !== 0) {
        throw new Error(data.message || `Server error (code: ${data.code})`)
      }
      
      // Return the fetched data (could be object or value)
      return data.data
    } catch (error) {
      throw error
    }
  } else {
    // Original format: db/collection/docId or db/collection/docId/field/path
    const parts = path.split('/')
    
    if (parts.length < 3) {
      throw new Error(`Invalid MongoDB path: ${path}. Expected format: db/collection/docId or db/collection/docId/field`)
    }
    
    const databaseName = parts[0]
    const collectionName = parts[1]
    const docId = parts[2]
    const fieldPath = parts.slice(3).join('/') // remaining parts as field path
    
    // Construct URL for fetching document
    const url = `${mongoOrigin}/mongo/db/${databaseName}/coll/${collectionName}/docs/${docId}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      // Check for error response
      if (data.code !== 0) {
        throw new Error(data.message || `Server error (code: ${data.code})`)
      }
      
      // If field path is specified, navigate to that field
      if (fieldPath) {
        const fieldParts = fieldPath.split('/')
        let value = data.data
        
        for (const part of fieldParts) {
          if (value && typeof value === 'object' && part in value) {
            value = value[part]
          } else {
            throw new Error(`Field not found: ${fieldPath}`)
          }
        }
        
        return String(value)
      }
      
      // Return entire document as JSON string
      return JSON.stringify(data.data)
    } catch (error) {
      throw error
    }
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

