import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SERVER_INFO, SERVER_MONGO_INFO } from '@/config.js'

export const useImageDataStore = defineStore('imageData', () => {
  const imageCache = ref({})
  const imageCacheState = ref({})
  const imageCacheMessage = ref({})

  const fetchImageFromLocal = async (path) => {
    try {
      const response = await fetch(path)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      throw new Error(`Failed to load local image: ${error.message}`)
    }
  }

  const fetchImageFromMongo = async (path) => {
    const parts = path.split('/')
    
    if (parts.length < 2) {
      throw new Error(`Invalid MongoDB path: ${path}. Expected format: accessPointId/filePathOrId`)
    }
    
    const accessPointId = parts[0]
    const filePathOrId = parts.slice(1)
    
    try {
      const mongoOrigin = SERVER_MONGO_INFO.origin.match(/^https?:\/\//) 
        ? SERVER_MONGO_INFO.origin 
        : `http://${SERVER_MONGO_INFO.origin}`
      
      const encodedPath = filePathOrId.map(segment => encodeURIComponent(segment)).join('/')
      
      const url = `${mongoOrigin}/file_access_point/${accessPointId}/${encodedPath}`
      const response = await fetch(url, {
        method: 'GET'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const contentType = response.headers.get('Content-Type') || ''
      
      if (contentType.startsWith('image/')) {
        const blob = await response.blob()
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      }
      
      throw new Error('Response is not image data')
    } catch (error) {
      throw new Error(`Failed to load MongoDB image: ${error.message}`)
    }
  }

  const fetchImageFromSQL = async (path) => {
    try {
      const serverOrigin = SERVER_INFO.origin.match(/^https?:\/\//) 
        ? SERVER_INFO.origin 
        : `http://${SERVER_INFO.origin}`
      
      const url = `${serverOrigin}/${path}?token=${encodeURIComponent(SERVER_INFO.get_token)}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const contentType = response.headers.get('Content-Type') || ''
      
      if (contentType.startsWith('image/')) {
        const blob = await response.blob()
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      }
      
      throw new Error('Response is not image data')
    } catch (error) {
      throw new Error(`Failed to load SQL image: ${error.message}`)
    }
  }

  const fetchImageFromFile = async (path) => {
    try {
      const mongoOrigin = SERVER_MONGO_INFO.origin.match(/^https?:\/\//) 
        ? SERVER_MONGO_INFO.origin 
        : `http://${SERVER_MONGO_INFO.origin}`
      
      const url = `${mongoOrigin}/${path}`
      
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
      
      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to fetch file')
      }
      
      if (!data.data || !data.data.fileBytes) {
        throw new Error('No file data in response')
      }
      
      const contentType = data.data.metadata?.contentType || 'application/octet-stream'
      const fileBytes = data.data.fileBytes
      
      // Convert base64 to data URL
      return `data:${contentType};base64,${fileBytes}`
    } catch (error) {
      throw new Error(`Failed to load file: ${error.message}`)
    }
  }

  const fetchImage = async (imageUrl) => {
    if (imageUrl.startsWith('{{local:')) {
      const path = imageUrl.substring(8, imageUrl.length - 2)
      return await fetchImageFromLocal(path)
    } else if (imageUrl.startsWith('{{file://')) {
      // Handle {{file://...}} pattern (with double slash)
      const path = imageUrl.substring(9, imageUrl.length - 2)
      return await fetchImageFromFile(path)
    } else if (imageUrl.startsWith('{{file:')) {
      // Handle {{file:...}} pattern (single colon)
      const path = imageUrl.substring(7, imageUrl.length - 2)
      return await fetchImageFromFile(path)
    } else if (imageUrl.startsWith('{{mongo:')) {
      const path = imageUrl.substring(8, imageUrl.length - 2)
      return await fetchImageFromMongo(path)
    } else if (imageUrl.startsWith('{{remote:')) {
      const path = imageUrl.substring(9, imageUrl.length - 2)
      return await fetchImageFromSQL(path)
    } else if (imageUrl.startsWith('data:image/')) {
      return imageUrl
    } else {
      throw new Error(`Unknown image URL format: ${imageUrl}`)
    }
  }

  const getImage = (imageUrl) => {
    if (imageCache.value[imageUrl] !== undefined) {
      return {
        state: imageCacheState.value[imageUrl],
        data: imageCache.value[imageUrl],
        message: imageCacheMessage.value[imageUrl]
      }
    }
    
    imageCacheState.value[imageUrl] = 'loading'
    imageCache.value[imageUrl] = null
    imageCacheMessage.value[imageUrl] = null
    
    fetchImage(imageUrl)
      .then(dataUrl => {
        imageCache.value[imageUrl] = dataUrl
        imageCacheState.value[imageUrl] = 'loaded'
        imageCacheMessage.value[imageUrl] = null
      })
      .catch(error => {
        imageCache.value[imageUrl] = null
        imageCacheState.value[imageUrl] = 'error'
        imageCacheMessage.value[imageUrl] = error.message
      })
    
    return {
      state: 'loading',
      data: null,
      message: null
    }
  }

  return {
    imageCache,
    imageCacheState,
    imageCacheMessage,
    getImage,
    fetchImage
  }
})

