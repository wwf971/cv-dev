<template>
  <div class="server-settings-panel">
    <div class="server-config-panel">
      <h3>SQL Server Config</h3>
      
      <div class="config-section">
        <label class="field-label">Server Origin</label>
        <input 
          v-model="serverOrigin" 
          type="text" 
          class="input-field"
          placeholder="https://example.com:8080"
        />
      </div>
      
      <div class="config-section">
        <label class="field-label">GET Token</label>
        <input 
          v-model="getToken" 
          type="text" 
          class="input-field"
          placeholder="your_token_here"
        />
      </div>
      
      <button @click="testConnection" class="control-button" :disabled="isTestingConnection">
        {{ isTestingConnection ? 'Testing...' : 'Test Connection' }}
      </button>
      
      <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
        <div class="result-status">
          <strong>{{ testResult.success ? '✓' : '✗' }}</strong>
          {{ testResult.message }}
        </div>
        <div v-if="testResult.details" class="result-details">
          <div v-for="(value, key) in testResult.details" :key="key">
            <span class="detail-key">{{ key }}:</span>
            <span class="detail-value">{{ value }}</span>
          </div>
        </div>
      </div>
    </div>

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
      <h3>MongoDB Test Fetch</h3>
      
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const serverOrigin = ref('')
const getToken = ref('')
const isTestingConnection = ref(false)
const testResult = ref(null)

const mongoOrigin = ref('')
const mongoUsername = ref('')
const mongoPassword = ref('')
const isTestingMongoConnection = ref(false)
const mongoTestResult = ref(null)

const mongoTestDatabase = ref('')
const mongoTestCollection = ref('')
const mongoTestDocKey = ref('')
const mongoTestDocValue = ref('')
const mongoTestDocPath = ref('')
const isTestingMongoFetch = ref(false)
const mongoFetchResult = ref(null)

onMounted(async () => {
  // Load from config, ensuring we get the merged config
  try {
    const config = await import('@/config.js')
    let origin = config.SERVER_INFO.origin || ''
    
    // Auto-prepend http:// if no scheme is present
    if (origin && !origin.match(/^https?:\/\//)) {
      origin = 'http://' + origin
    }
    
    serverOrigin.value = origin
    getToken.value = config.SERVER_INFO.get_token || ''

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

const testConnection = async () => {
  if (!serverOrigin.value) {
    testResult.value = {
      success: false,
      message: 'Server origin is required'
    }
    return
  }
  
  isTestingConnection.value = true
  testResult.value = null
  
  try {
    const url = `${serverOrigin.value}/ping?token=${encodeURIComponent(getToken.value)}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.code === 0) {
      // Everything is normal
      testResult.value = {
        success: true,
        message: data.message,
        details: data.data || {}
      }
      
      // Save the successful settings to config
      const config = await import('@/config.js')
      config.SERVER_INFO.origin = serverOrigin.value
      config.SERVER_INFO.get_token = getToken.value
    } else if (data.code === 1) {
      // Connected but token is wrong
      testResult.value = {
        success: false,
        message: data.message,
        details: { code: data.code }
      }
    } else {
      // Other errors
      testResult.value = {
        success: false,
        message: data.message || 'Unknown error',
        details: { code: data.code }
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: `Error: ${error.message}`
    }
  } finally {
    isTestingConnection.value = false
  }
}

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

const testMongoFetch = async () => {
  if (!mongoOrigin.value) {
    mongoFetchResult.value = {
      success: false,
      message: 'Server origin is required'
    }
    return
  }
  
  if (!mongoTestDatabase.value || !mongoTestCollection.value) {
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
    
    if (mongoTestDocKey.value && mongoTestDocValue.value) {
      params.append(mongoTestDocKey.value, mongoTestDocValue.value)
    }
    
    if (mongoTestDocPath.value) {
      params.append('path', mongoTestDocPath.value)
    }
    
    const url = `${mongoOrigin.value}/mongo/db/${mongoTestDatabase.value}/coll/${mongoTestCollection.value}/docs?${params.toString()}`
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

