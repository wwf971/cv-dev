import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { SERVER_INFO } from '@/config.js'

export const useInfoStore = defineStore('info', () => {
  const server_url = SERVER_INFO.origin
  // Configure axios to include cookies in all requests
  axios.defaults.withCredentials = false

  // Cache for info queries to avoid repeated API calls
  const infoCache = ref({})
  // Login function
  const login = async () => {
    console.log("login()")
    try {
      const res = await axios.post(
        `${server_url}/login/`,
        {
          username: SERVER_INFO.username,
          password: SERVER_INFO.password
        },
        {
          withCredentials: true
        }
      )
      if (res.data.is_success) {
        console.log("login success")
        console.log(res)
      } else {
        console.log(res.data.message)
      }
    } catch (error) {
      console.error(error)
    }
  }

  // fetch info from server
  const fetch_info = async (query, verbose=false) => {
    await login()

    try {
      const res = await axios.post(
        `${server_url}/info/`,
        {
          query: query
        },
        {
          withCredentials: true
            // browser will append non SameSite cookies to the request
        }
      )
      if (verbose) { console.log("fetch_info(): res:", res)}
      if (res.data.is_success) {
        if (verbose) { console.log("fetch_info(): verbose:", verbose, "res.data.data:", res.data.data)}
        return {is_success: true, data: res.data.data}
      } else {
        console.error("fetch_info(): res.data.message:", res.data.message)
        return {is_success: false, message: res.data.message}
      }
    } catch (error) {
      let message = "Failed to load info: " + error
      console.error(message)
      return {is_success: false, message: message}
    }
  }

  const infoCacheState = ref({})
  const infoCacheMessage = ref({})
  const refresh_info = (query, verbose=true) => {
    return info(query, verbose)
  }
  // Template-friendly function that handles async calls with caching
  const info = (query, verbose=false) => {
    // If already cached, return the cached value
    if (infoCache.value[query] !== undefined) {
      return infoCache.value[query]
    }
    infoCacheState.value[query] = "loading"
    // If not cached, start the async call and return loading placeholder
    infoCache.value[query] = "<div>Loading...</div>" // Set loading state
    fetch_info(query, verbose).then(response => {
      if(response.is_success) {
        // console.log("info(): response.data:", response.data)
        infoCache.value[query] = response.data // Cache the result
        infoCacheState.value[query] = "ready"
      } else {
        console.error(`info(): query: ${query} error:`, response.message)
        infoCache.value[query] = `<div>Error: ${response.message}</div>` // Cache the error
        infoCacheState.value[query] = "error"
        infoCacheMessage.value[query] = response.message
      }
    }).catch(error => {
      infoCache.value[query] = `<div>Error: ${error}</div>` // Cache the error
      infoCacheState.value[query] = "error"
      infoCacheMessage.value[query] = `local error: ${error.message}`
    })
    return infoCache.value[query] // Return current state (Loading... initially)
  }

  return {
    // data
    server_url,
    infoCache, // data
    infoCacheState, // data fetch status
    infoCacheMessage, // error message

    // functions
    login,
    fetch_info,
    refresh_info,
    info,
  }
})