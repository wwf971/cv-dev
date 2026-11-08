// post-build script
// convert built page to single html file
  // so that it can be directly opened in browser without errors in asset fetching

// 非iife的rollup模式下, 将./dist/xxx.html转换为./dist/xxx-single.html
  // 需要很小心地处理import {xxx as a} from 'vue'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distPath = path.join(__dirname, 'dist')
const assetsPath = path.join(distPath, 'assets')

// Helper to read and inline CSS/JS
function readAsset(assetPath) {
  if (fs.existsSync(assetPath)) {
    return fs.readFileSync(assetPath, 'utf8')
  }
  return ''
}

// Remove ES module syntax from JS (handles minified code)
function stripESModules(js) {
  // Handle _plugin-vue_export-helper - this is usually a simple function that can be replaced
  const helperImportMatch = js.match(/import\s*\{\s*_\s+as\s+(\w+)\s*\}\s*from\s*["'][^"']*style\.js["']/);
  if (helperImportMatch) {
    const helperVar = helperImportMatch[1];
    // Replace the helper function with a simple identity function that adds render/scopeId
    js = js.replace(new RegExp(`\\b${helperVar}\\(`, 'g'), '((component, properties) => { const target = component.__vccOpts || component; for (const [key, value] of properties) target[key] = value; return target; })(');
  }
  
  // Handle axios imports - be more specific to avoid replacing 'b' in HTML
  const axiosImportMatch = js.match(/import\s+(\w+)\s+from\s*["']axios["']/);
  if (axiosImportMatch) {
    const axiosVar = axiosImportMatch[1];
    // Only replace as function calls or variable references, not inside strings or HTML
    js = js.replace(new RegExp(`\\b${axiosVar}\\.`, 'g'), 'axios.');
    js = js.replace(new RegExp(`await\\s+${axiosVar}\\b`, 'g'), 'await axios');
  }
  
  // Extract what variables are being imported from Vue and map them to Vue globals
  const vueImportMatches = js.match(/import\s*\{([^}]+)\}\s*from\s*["']vue["']/g);
  if (vueImportMatches) {
    for (const match of vueImportMatches) {
      // Extract the import mapping: {createElementBlock as n, openBlock as p, ...}
      const importContent = match.match(/\{([^}]+)\}/)[1];
      const mappings = importContent.split(',').map(m => m.trim());
      
      for (const mapping of mappings) {
        if (mapping.includes(' as ')) {
          const [vueFunction, localVar] = mapping.split(' as ').map(s => s.trim());
          // Replace the local variable with Vue global equivalent
          const globalVar = `Vue.${vueFunction}`;
          
          // Escape special regex characters in the local variable
          const escapedLocalVar = localVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // Create regex patterns that avoid replacing within strings
          // Pattern 1: Replace function calls like localVar(
          js = js.replace(new RegExp(`\\b${escapedLocalVar}\\(`, 'g'), `${globalVar}(`);
          
          // Pattern 2: Replace variable assignments like const x = localVar
          js = js.replace(new RegExp(`=\\s*${escapedLocalVar}\\b`, 'g'), `= ${globalVar}`);
          
          // Pattern 3: Replace at end of statements like ).mount("#app")
          js = js.replace(new RegExp(`${escapedLocalVar}\\(([^)]+)\\)\\.mount`, 'g'), `${globalVar}($1).mount`);
          
          // Pattern 4: Replace in await expressions
          js = js.replace(new RegExp(`await\\s+${escapedLocalVar}\\.`, 'g'), `await ${globalVar}.`);
          
          // Pattern 5: Replace when used as first argument to createElementBlock (for Fragment)
          if (vueFunction === 'Fragment') {
            js = js.replace(new RegExp(`createElementBlock\\(${escapedLocalVar},`, 'g'), `createElementBlock(${globalVar},`);
            js = js.replace(new RegExp(`Vue\\.createElementBlock\\(${escapedLocalVar},`, 'g'), `Vue.createElementBlock(${globalVar},`);
          }
        }
      }
    }
  }
  
  // Remove all import statements (do this AFTER variable replacement)
  js = js.replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']*["'];?/g, '') // import { ... } from "..."
  js = js.replace(/import\s+[^"']*\s*from\s*["'][^"']*["'];?/g, '') // import ... from "..."
  js = js.replace(/import\s*["'][^"']*["'];?/g, '') // import "..."
  js = js.replace(/import\s*\([^)]*\)/g, '/* removed dynamic import */') // import(...)
  
  // Handle all export patterns (including minified)
  js = js.replace(/export\s*\{[^}]*\}\s*from\s*["'][^"']*["'];?/g, '') // export { ... } from "..."
  js = js.replace(/export\s*\*\s*from\s*["'][^"']*["'];?/g, '') // export * from "..."
  js = js.replace(/export\s*\{[^}]*\};?/g, '') // export { ... }
  js = js.replace(/export\s+default\s+/g, '') // export default
  js = js.replace(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+/g, (match) => {
    return match.replace('export ', '')
  }) // export function/class/const/let/var
  js = js.replace(/export\s*\{/g, '{') // export {
  js = js.replace(/export\s+/g, '') // any remaining export
  
  // Clean up any remaining import artifacts
  js = js.replace(/\{[^}]*\}from["'][^"']*[""];?/g, '') // leftover {..}from"..." 
  js = js.replace(/from["'][^"']*[""];?/g, '') // leftover from"..."
  
  // Final cleanup - remove any remaining import/export keywords and artifacts
  js = js.replace(/\/\*\s*import\s*\*/g, '') // remove /* import */ comments
  js = js.replace(/\/\*\s*export\s*\*/g, '') // remove /* export */ comments
  js = js.replace(/\bimport\b/g, '') // remove remaining import keywords
  js = js.replace(/\bexport\b/g, '') // remove remaining export keywords
  
  return js
}

// Recursively inline all JS dependencies
function inlineAllJS(jsLinks, alreadyInlined = new Set()) {
  let inlined = ''
  for (const jsSrc of jsLinks) {
    let jsFile = jsSrc.startsWith('/') ? jsSrc.slice(1) : jsSrc
    if (!jsFile.startsWith('assets/')) jsFile = 'assets/' + path.basename(jsFile)
    if (alreadyInlined.has(jsFile)) continue
    alreadyInlined.add(jsFile)
    let jsContent = readAsset(path.join(distPath, jsFile))
    // Find further imports in this JS and inline them first
    const importMatches = [...jsContent.matchAll(/import\s+[^'"\n]+from\s+['"]([^'"]+)['"]/g)]
    if (importMatches.length > 0) {
      // Recursively inline dependencies
      for (const m of importMatches) {
        let dep = m[1]
        // Only inline relative imports (./ or ../ or assets/)
        if (dep.startsWith('.') || dep.startsWith('assets/')) {
          let depFile = dep.startsWith('.') ? path.join(path.dirname(jsFile), dep) : dep
          // Normalize path
          depFile = depFile.replace(/\\/g, '/').replace(/\/\//g, '/').replace(/^\//, '')
          if (!depFile.startsWith('assets/')) depFile = 'assets/' + path.basename(depFile)
          inlined += inlineAllJS([depFile], alreadyInlined)
        }
      }
    }
    inlined += '\n' + stripESModules(jsContent) + '\n'
  }
  return inlined
}

// Process each HTML file in dist
fs.readdirSync(distPath).forEach(file => {
  if (!file.endsWith('.html')) return
  if (file.endsWith('-single.html')) return

  const htmlPath = path.join(distPath, file)
  let html = fs.readFileSync(htmlPath, 'utf8')
  const baseName = file.replace(/\.html$/, '')

  // Remove favicon references
  html = html.replace(/<link[^>]+rel=["']icon["'][^>]*>/g, '')

  // Find all <link rel="stylesheet" href="...">, <link rel="modulepreload" ...>, and <script type="module" src="...">
  const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)]
    .map(m => m[1])
  const modulePreloadLinks = [...html.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["'][^>]*>/g)]
    .map(m => m[1])
  const jsLinks = [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/g)]
    .map(m => m[1])

  // Inline CSS - look for all CSS files in assets directory
  let inlinedCSS = ''
  
  // First, inline any CSS links found in HTML
  for (const cssHref of cssLinks) {
    let cssFile = cssHref.startsWith('/') ? cssHref.slice(1) : cssHref
    if (!cssFile.startsWith('assets/')) cssFile = 'assets/' + path.basename(cssFile)
    inlinedCSS += readAsset(path.join(distPath, cssFile)) + '\n'
  }
  
  // Then, inline all CSS files in assets directory (for CSS imported by JS)
  if (fs.existsSync(assetsPath)) {
    const assetFiles = fs.readdirSync(assetsPath)
    for (const assetFile of assetFiles) {
      if (assetFile.endsWith('.css')) {
        const cssContent = readAsset(path.join(assetsPath, assetFile))
        if (cssContent) {
          inlinedCSS += cssContent + '\n'
        }
      }
    }
  }

  // Inline all JS dependencies recursively, including modulepreload links
  let allJsToInline = [...modulePreloadLinks, ...jsLinks]
  let inlinedJS = inlineAllJS(allJsToInline)

  // Remove original <link rel="stylesheet">, <link rel="modulepreload">, and <script type="module"> tags
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']+["'][^>]*>/g, '')
  html = html.replace(/<link[^>]+rel=["']modulepreload["'][^>]+href=["'][^"']+["'][^>]*>/g, '')
  html = html.replace(/<script[^>]+type=["']module["'][^>]+src=["'][^"']+["'][^>]*><\/script>/g, '')

  // Insert inlined CSS before </head>
  html = html.replace('</head>', `<style>\n${inlinedCSS}\n</style>\n</head>`)

  // Insert Vue/Axios CDN and inlined JS before </body>
  html = html.replace('</body>', `  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>\n  <script src="https://unpkg.com/axios/dist/axios.min.js"></script>\n  <script>\n${inlinedJS}\n  </script>\n</body>`)

  // Write to xxx-single.html
  const outPath = path.join(distPath, `${baseName}-single.html`)
  fs.writeFileSync(outPath, html)
  console.log(`Created standalone HTML: ${outPath}`)
})

console.log('All standalone HTML files created successfully!')