// post-build script

// convert built page to single html file
  // so that it can be directly opened in browser without errors in asset fetching

// 使用iife的rollup模式
    // 将./dist/xxx.html转换为./dist/xxx-single.html的过程大幅度简化

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildPath = path.join(__dirname, '..', 'build')
const outputPath = path.join(__dirname, '..', 'build-single-html')
const assetsPath = path.join(buildPath, 'assets')

// Create output directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true })
}

// Helper to read and inline CSS/JS
function readAsset(assetPath) {
  if (fs.existsSync(assetPath)) {
    return fs.readFileSync(assetPath, 'utf8')
  }
  return ''
}

// Process each HTML file in build
fs.readdirSync(buildPath).forEach(file => {
  if (!file.endsWith('.html')) return
  if (file.endsWith('-single.html')) return

  const htmlPath = path.join(buildPath, file)
  let html = fs.readFileSync(htmlPath, 'utf8')
  const baseName = file.replace(/\.html$/, '')

  // Remove favicon references
  html = html.replace(/<link[^>]+rel=["']icon["'][^>]*>/g, '')

  // Find all <link rel="stylesheet" href="..."> and <script src="...">
  const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)]
    .map(m => m[1])
  const jsLinks = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g)]
    .map(m => m[1])

  // Inline CSS
  let inlinedCSS = ''
  for (const cssHref of cssLinks) {
    let cssFile = cssHref.startsWith('/') ? cssHref.slice(1) : cssHref
    if (!cssFile.startsWith('assets/')) cssFile = 'assets/' + path.basename(cssFile)
    inlinedCSS += readAsset(path.join(buildPath, cssFile)) + '\n'
  }

  // Inline JS (should only be one main js file per page)
  let inlinedJS = ''
  for (const jsSrc of jsLinks) {
    let jsFile = jsSrc.startsWith('/') ? jsSrc.slice(1) : jsSrc
    if (!jsFile.startsWith('assets/')) jsFile = 'assets/' + path.basename(jsFile)
    inlinedJS += readAsset(path.join(buildPath, jsFile)) + '\n'
  }

  // Remove original <link rel="stylesheet"> and <script src=...> tags
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']+["'][^>]*>/g, '')
  html = html.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/g, '')

  // Insert inlined CSS before </head>
  html = html.replace('</head>', `<style>\n${inlinedCSS}\n</style>\n</head>`)

  // Insert Vue/Axios CDN and inlined JS before </body>
  html = html.replace('</body>', `  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>\n  <script src="https://unpkg.com/axios/dist/axios.min.js"></script>\n  <script>\n${inlinedJS}\n  </script>\n</body>`)

  // Write to build-single-html/xxx.html
  const outPath = path.join(outputPath, `${baseName}.html`)
  fs.writeFileSync(outPath, html)
  console.log(`Created standalone HTML: ${outPath}`)
})

console.log(`All standalone HTML files created successfully in ${outputPath}!`)