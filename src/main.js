import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'virtual:uno.css'
import '@unocss/reset/tailwind.css'
import Main from './main.vue'
import './style.css'
import './content/CvJp/styles-shared.css'

const app = createApp(Main)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')