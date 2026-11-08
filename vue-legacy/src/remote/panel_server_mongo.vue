<template>
  <div class="server-settings-panel">
    <div class="server-config-panel">
      <h3>MongoDB Server Config</h3>
      
      <div class="config-section">
        <label class="field-label">Server Origin</label>
        <input 
          v-model="mongoOrigin" 
          type="text" 
          class="input-field"
          placeholder="http://localhost:8080"
        />
      </div>
      
      <div class="config-section">
        <label class="field-label">Username</label>
        <input 
          v-model="mongoUsername" 
          type="text" 
          class="input-field"
          placeholder="username"
        />
      </div>
      
      <div class="config-section">
        <label class="field-label">Password</label>
        <input 
          v-model="mongoPassword" 
          type="password" 
          class="input-field"
          placeholder="password"
        />
      </div>
      
      <button @click="testMongoConnection" class="control-button" :disabled="isTestingMongoConnection">
        {{ isTestingMongoConnection ? 'Testing...' : 'Test Connection' }}
      </button>
      
      <div v-if="mongoTestResult" class="test-result" :class="mongoTestResult.success ? 'success' : 'error'">
        <div class="result-status">
          <strong>{{ mongoTestResult.success ? '✓' : '✗' }}</strong>
          {{ mongoTestResult.message }}
        </div>
        <div v-if="mongoTestResult.details" class="result-details">
          <div v-for="(value, key) in mongoTestResult.details" :key="key">
            <span class="detail-key">{{ key }}:</span>
            <span class="detail-value">{{ value }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="server-config-panel">
      <h3>MongoDB Query Test</h3>
      <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
        Pattern: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 2px;">&#123;&#123;mongo:...&#125;&#125;</code>
      </div>
      
      <div class="config-section">
        <label class="field-label">Input Mode</label>
        <div style="display: flex; gap: 15px; margin-top: 3px;">
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input 
              type="radio" 
              v-model="mongoQueryInputMode" 
              value="pattern"
              style="cursor: pointer;"
            />
            <span style="font-size: 12px;">Pattern</span>
          </label>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input 
              type="radio" 
              v-model="mongoQueryInputMode" 
              value="fields"
              style="cursor: pointer;"
            />
            <span style="font-size: 12px;">Fields</span>
          </label>
        </div>
      </div>
      
      <div v-if="mongoQueryInputMode === 'pattern'" class="config-section">
        <label class="field-label">Pattern</label>
        <input 
          v-model="mongoQueryPattern" 
          type="text" 
          class="input-field"
          placeholder="{{mongo:databaseName/collectionName?key=value&path=a.0.b}}"
        />
        <div style="font-size: 11px; color: #888; margin-top: 3px;">
          Example: <code style="background: #f5f5f5; padding: 1px 3px; border-radius: 2px;">&#123;&#123;mongo:main/cv?name=dimension-robotics&path=.&#125;&#125;</code>
        </div>
      </div>
      
      <template v-else>
        <div class="config-section">
          <label class="field-label">Database</label>
          <input 
            v-model="mongoTestDatabase" 
            type="text" 
            class="input-field"
            placeholder="database_name"
          />
        </div>
        
        <div class="config-section">
          <label class="field-label">Collection</label>
          <input 
            v-model="mongoTestCollection" 
            type="text" 
            class="input-field"
            placeholder="collection_name"
          />
        </div>
        
        <div class="config-section">
          <label class="field-label">Doc Key</label>
          <input 
            v-model="mongoTestDocKey" 
            type="text" 
            class="input-field"
            placeholder="key_name"
          />
        </div>
        
        <div class="config-section">
          <label class="field-label">Doc Value</label>
          <input 
            v-model="mongoTestDocValue" 
            type="text" 
            class="input-field"
            placeholder="value"
          />
        </div>
        
        <div class="config-section">
          <label class="field-label">Doc Path</label>
          <input 
            v-model="mongoTestDocPath" 
            type="text" 
            class="input-field"
            placeholder="a.b.0"
          />
        </div>
      </template>
      
      <button @click="testMongoFetch" class="control-button" :disabled="isTestingMongoFetch">
        {{ isTestingMongoFetch ? 'Testing...' : 'Test Fetch' }}
      </button>
      
      <div v-if="mongoFetchResult" class="test-result" :class="mongoFetchResult.success ? 'success' : 'error'">
        <div class="result-status">
          <strong>{{ mongoFetchResult.success ? '✓' : '✗' }}</strong>
          {{ mongoFetchResult.message }}
        </div>
        <div v-if="mongoFetchResult.data" class="result-details">
          <div class="detail-key">Result:</div>
          <pre class="detail-value">{{ JSON.stringify(mongoFetchResult.data, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div class="server-config-panel">
      <h3>File Access Point Test</h3>
      <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
        Pattern: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 2px;">&#123;&#123;file:...&#125;&#125;</code>
      </div>
      
      <div class="config-section">
        <label class="field-label">Input Pattern</label>
        <input 
          v-model="filePatternInput" 
          type="text" 
          class="input-field"
          placeholder="{{file:accessPointId/path/to/file}}"
        />
      </div>
      
      <button @click="testFileFetch" class="control-button" :disabled="isTestingFilePattern">
        {{ isTestingFilePattern ? 'Fetching...' : 'Fetch Data' }}
      </button>
      
      <div v-if="filePatternResult" class="test-result" :class="filePatternResult.success ? 'success' : 'error'">
        <div class="result-status">
          <strong>{{ filePatternResult.success ? '✓' : '✗' }}</strong>
          {{ filePatternResult.message }}
        </div>
        <div v-if="filePatternResult.data" class="result-details">
          <div class="detail-key">Result:</div>
          <pre class="detail-value">{{ JSON.stringify(filePatternResult.data, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const mongoOrigin = ref('')
const mongoUsername = ref('')
const mongoPassword = ref('')
const isTestingMongoConnection = ref(false)
const mongoTestResult = ref(null)

const mongoQueryInputMode = ref('fields')
const mongoQueryPattern = ref('')
const mongoTestDatabase = ref('')
const mongoTestCollection = ref('')
const mongoTestDocKey = ref('')
const mongoTestDocValue = ref('')
const mongoTestDocPath = ref('')
const isTestingMongoFetch = ref(false)
const mongoFetchResult = ref(null)

const filePatternInput = ref('')
const isTestingFilePattern = ref(false)
const filePatternResult = ref(null)

onMounted(async () => {
  try {
    const config = await import('@/config.js')

    // Load MongoDB config
    let mongoOriginVal = config.SERVER_MONGO_INFO.origin || ''
    if (mongoOriginVal && !mongoOriginVal.match(/^https?:\/\//)) {
      mongoOriginVal = 'http://' + mongoOriginVal
    }
    mongoOrigin.value = mongoOriginVal
    mongoUsername.value = config.SERVER_MONGO_INFO.username || ''
    mongoPassword.value = config.SERVER_MONGO_INFO.password || ''

    // Load MongoDB test fetch config
    if (config.SERVER_MONGO_INFO.test_fetch) {
      mongoTestDatabase.value = config.SERVER_MONGO_INFO.test_fetch.database || ''
      mongoTestCollection.value = config.SERVER_MONGO_INFO.test_fetch.collection || ''
      mongoTestDocKey.value = config.SERVER_MONGO_INFO.test_fetch.docKey || ''
      mongoTestDocValue.value = config.SERVER_MONGO_INFO.test_fetch.docValue || ''
      mongoTestDocPath.value = config.SERVER_MONGO_INFO.test_fetch.docPath || ''
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
})

const testMongoConnection = async () => {
  if (!mongoOrigin.value) {
    mongoTestResult.value = {
      success: false,
      message: 'Server origin is required'
    }
    return
  }
  
  isTestingMongoConnection.value = true
  mongoTestResult.value = null
  
  try {
    const url = `${mongoOrigin.value}/mongo/test/`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const data = await response.json()
    
    if (data.code === 0) {
      // Connection successful
      mongoTestResult.value = {
        success: true,
        message: data.message,
        details: { result: data.data }
      }
      
      // Save the successful settings to config
      const config = await import('@/config.js')
      config.SERVER_MONGO_INFO.origin = mongoOrigin.value
      config.SERVER_MONGO_INFO.username = mongoUsername.value
      config.SERVER_MONGO_INFO.password = mongoPassword.value
    } else {
      // Connection failed
      mongoTestResult.value = {
        success: false,
        message: data.message || 'Connection test failed',
        details: { code: data.code }
      }
    }
  } catch (error) {
    mongoTestResult.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isTestingMongoConnection.value = false
  }
}

const parseMongoPattern = (pattern) => {
  // Parse pattern like {{mongo:databaseName/collectionName?key=value&path=a.0.b}}
  const match = pattern.match(/^\{\{mongo:([^?]+)(?:\?(.+))?\}\}$/)
  
  if (!match) {
    return { error: 'Invalid pattern format. Expected: {{mongo:database/collection?key=value&path=...}}' }
  }
  
  const pathPart = match[1]
  const queryPart = match[2] || ''
  
  const pathSegments = pathPart.split('/')
  if (pathSegments.length !== 2) {
    return { error: 'Invalid path format. Expected: database/collection' }
  }
  
  const database = pathSegments[0]
  const collection = pathSegments[1]
  
  if (!database || !collection) {
    return { error: 'Database and collection cannot be empty' }
  }
  
  // Parse query string
  const queryParams = {}
  let docPath = ''
  
  if (queryPart) {
    const params = queryPart.split('&')
    for (const param of params) {
      const [key, value] = param.split('=')
      if (key === 'path') {
        docPath = value || ''
      } else if (key && value) {
        queryParams[key] = value
      }
    }
  }
  
  // Get the first key-value pair as docKey and docValue
  const queryKeys = Object.keys(queryParams)
  const docKey = queryKeys.length > 0 ? queryKeys[0] : ''
  const docValue = docKey ? queryParams[docKey] : ''
  
  return { database, collection, docKey, docValue, docPath }
}

const testMongoFetch = async () => {
  if (!mongoOrigin.value) {
    mongoFetchResult.value = {
      success: false,
      message: 'Server origin is required'
    }
    return
  }
  
  let database, collection, docKey, docValue, docPath
  
  if (mongoQueryInputMode.value === 'pattern') {
    // Parse pattern input
    if (!mongoQueryPattern.value) {
      mongoFetchResult.value = {
        success: false,
        message: 'Pattern is required'
      }
      return
    }
    
    const parsed = parseMongoPattern(mongoQueryPattern.value)
    if (parsed.error) {
      mongoFetchResult.value = {
        success: false,
        message: parsed.error
      }
      return
    }
    
    database = parsed.database
    collection = parsed.collection
    docKey = parsed.docKey
    docValue = parsed.docValue
    docPath = parsed.docPath
  } else {
    // Use field inputs
    database = mongoTestDatabase.value
    collection = mongoTestCollection.value
    docKey = mongoTestDocKey.value
    docValue = mongoTestDocValue.value
    docPath = mongoTestDocPath.value
  }
  
  if (!database || !collection) {
    mongoFetchResult.value = {
      success: false,
      message: 'Database and collection are required'
    }
    return
  }
  
  isTestingMongoFetch.value = true
  mongoFetchResult.value = null
  
  try {
    const params = new URLSearchParams()
    
    if (docKey && docValue) {
      params.append(docKey, docValue)
    }
    
    if (docPath) {
      params.append('path', docPath)
    }
    
    const url = `${mongoOrigin.value}/mongo/db/${database}/coll/${collection}/doc?${params.toString()}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const data = await response.json()
    
    if (data.code === 0) {
      mongoFetchResult.value = {
        success: true,
        message: data.message,
        data: data.data
      }
    } else {
      mongoFetchResult.value = {
        success: false,
        message: data.message || 'Fetch failed'
      }
    }
  } catch (error) {
    mongoFetchResult.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isTestingMongoFetch.value = false
  }
}

const testFileFetch = async () => {
  if (!mongoOrigin.value) {
    filePatternResult.value = {
      success: false,
      message: 'Server origin is required. Please configure MongoDB server first.'
    }
    return
  }
  
  // Validate input format
  const pattern = filePatternInput.value.trim()
  const fileMatch = pattern.match(/^\{\{file:(.+)\}\}$/)
  
  if (!fileMatch) {
    filePatternResult.value = {
      success: false,
      message: 'Invalid format. Expected format: {{file:path/to/file}}'
    }
    return
  }
  
  const path = fileMatch[1]
  
  isTestingFilePattern.value = true
  filePatternResult.value = null
  
  try {
    const mongoOriginUrl = mongoOrigin.value.match(/^https?:\/\//) 
      ? mongoOrigin.value 
      : `http://${mongoOrigin.value}`
    
    const url = `${mongoOriginUrl}/${path}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.code === 0) {
      filePatternResult.value = {
        success: true,
        message: data.message || 'Data fetched successfully',
        data: data
      }
    } else {
      filePatternResult.value = {
        success: false,
        message: data.message || 'Fetch failed',
        data: data
      }
    }
  } catch (error) {
    filePatternResult.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isTestingFilePattern.value = false
  }
}
</script>

<style scoped>
@import '../panels/panel_styles.css';

.server-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;

  max-width: 600px;
}

.server-config-panel {
  padding: 8px;
  width: 100%;
}

.config-section {
  margin-bottom: 6px;
}

.field-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.input-field {
  width: 100%;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 2px;
  font-size: 13px;
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: #0066cc;
}

.test-result {
  padding: 4px;
  border: 1px solid;
  border-radius: 2px;
  font-size: 12px;
}

.test-result.success {
  background-color: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}

.test-result.error {
  background-color: #ffebee;
  border-color: #f44336;
  color: #c62828;
}

.result-status {
  font-weight: 500;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.result-details {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.result-details > div {
  margin-bottom: 2px;
}

.detail-key {
  font-weight: 500;
  margin-right: 4px;
}

.detail-value {
  color: #666;
}

pre.detail-value {
  margin: 4px 0 0 0;
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 2px;
  font-size: 11px;
  overflow-x: auto;
  max-height: 300px;
}
</style>

