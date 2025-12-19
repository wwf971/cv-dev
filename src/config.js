// Centralized configuration for the CV project
// ES6 exports for Vue, also compatible with Node.js (puppeteer will use require)

// Default configurations
export let A4_SIZES = {
  widthInPixels: 793.92,
  heightInPixels: 1122.24
}

export let PAGE_SIZES = {
  // A4 page dimensions and padding
  paddingTop: 40,
  paddingBottom: 40,
  paddingLeft: 40,
  paddingRight: 40,
  pageHeight: 1122.24, // A4 height in pixels
  pageGap: 100,
  
  // Computed property helper
  get effectivePageHeight() {
    return this.pageHeight - this.paddingTop - this.paddingBottom
  }
}

export let SERVER_INFO = {
  origin: 'https://example_url:8080',
  get_token: 'example_get_token',
  // username: 'example_username',
  // password: 'example_password'
}

export let educationEntries = []
export let workEntries = []
export let licenseEntries = []
export let interest = ''
export let url_motivation_text = ''

// Try to import and override with private config
try {
  const privateConfig = await import('./config.0.js')
  
  // Override with values from config.0.js if they exist
  if (privateConfig.A4_SIZES) A4_SIZES = privateConfig.A4_SIZES
  if (privateConfig.PAGE_SIZES) PAGE_SIZES = privateConfig.PAGE_SIZES
  if (privateConfig.SERVER_INFO) SERVER_INFO = privateConfig.SERVER_INFO
  if (privateConfig.educationEntries) educationEntries = privateConfig.educationEntries
  if (privateConfig.workEntries) workEntries = privateConfig.workEntries
  if (privateConfig.licenseEntries) licenseEntries = privateConfig.licenseEntries
  if (privateConfig.interest) interest = privateConfig.interest
  if (privateConfig.url_motivation_text) url_motivation_text = privateConfig.url_motivation_text
} catch (error) {
  console.warn('Failed to load config.0.js, using default values:', error.message)
}

