<script setup>
// Example project data for testing (matching fetched data format)
const exampleProject1 = {
  name: 'ai-chatbot',
  type: '個人プロジェクト',
  'people:': '開発者1名',
  time: '2023年4月 - 2023年8月',
  place: '自宅',
  techTags: ['Python', 'TensorFlow', 'Flask', 'JavaScript', 'Vue.js'],
  content: [
    '自然言語処理を用いたAIチャットボットの開発を行いました。',
    'ユーザーの質問に適切に応答する対話システムを実装し、機械学習モデルを活用して会話の質を向上させました。',
    'WebインターフェースをVue.jsで作成し、バックエンドAPIをFlaskで構築しました。',
    '約500件の対話データを用いてモデルを学習させ、応答精度を85%まで向上させました。'
  ],
  learnings: [
    '機械学習モデルの実装とチューニングの方法を学びました。',
    '自然言語処理の基本的なアルゴリズムを理解しました。',
    'Webアプリケーションのフルスタック開発を経験しました。',
    'API設計とセキュリティの重要性を学びました。'
  ]
}

const exampleProject2 = {
  name: 'e-commerce-platform',
  type: 'チームプロジェクト',
  'people:': '開発者3名 + デザイナー1名',
  time: '2023年9月 - 2024年3月',
  place: 'オフィス',
  techTags: ['React', 'Node.js', 'MongoDB', 'Express', 'AWS'],
  content: [
    'フル機能のEコマースプラットフォームを開発しました。',
    '商品管理、ショッピングカート、決済処理、在庫管理などの機能を備えています。',
    'ユーザー認証、注文管理、商品検索・フィルタリング機能をReactで実装しました。',
    'バックエンドAPIをNode.jsとExpressで構築し、MongoDBでデータを管理しました。',
    'AWSクラウドサービスを使用して本番環境を構築し、スケーラビリティを確保しました。'
  ],
  learnings: [
    '大規模Webアプリケーションのアーキテクチャ設計を学びました。',
    'クラウドサービスの活用方法を習得しました。',
    'チーム開発におけるGitの効果的な使用方法を学びました。',
    'セキュリティとパフォーマンスの最適化について理解しました。'
  ]
}

const exampleProject3 = {
  name: 'mobile-health-app',
  type: '企業プロジェクト',
  'people:': '開発チーム5名',
  time: '2024年4月 - 現在',
  place: 'リモート',
  techTags: ['React Native', 'Firebase', 'TypeScript', 'Redux'],
  content: [
    '健康管理を目的としたモバイルアプリケーションを開発しています。',
    '歩数計測、食事記録、体重管理、睡眠分析などの機能を備えています。',
    'React Nativeを使用してiOS/Android両対応のアプリを開発しました。',
    'Firebaseを活用してリアルタイムデータ同期と認証を実装しました。',
    'ユーザー体験を重視した直感的なUI/UXデザインを採用しています。'
  ]
  // No learnings field - this is optional
}

import { ref, onMounted, provide } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import ProjectJp from '@/content/CvJp/ProjectJp.vue'
import Table from '@/pagination/component/Table.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import { buildProjectComponents } from '@/content/CvJp/ProjectBuilder'
import { PAGE_SIZES, SERVER_MONGO_INFO } from '@/config.js'
import { LogType } from '@/pagination/LogTypes'
import { createLogger } from './logger'
import TextRow from '@/pagination/component/TextRow.vue'
import TextList from '@/pagination/component/TextList.vue'
import Text from '@/pagination/component/Text.vue'
import Image from '@/pagination/component/Image.vue'
import ImageRow from '@/pagination/component/ImageRow.vue'
import { fetchRemoteData } from '@/remote/remoteDataFetcher.js'
import { useImageDataStore } from '@/remote/imageDataStore.js'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'Table': Table,
    'VSpace': VSpace,
    'TextRow': TextRow,
    'TextList': TextList,
    'Text': Text,
    'Image': Image,
    'ImageRow': ImageRow
  }
  return componentMap[type] || 'div'
}

const imageStore = useImageDataStore()

const paginationRef = ref(null)
const logs = ref([])

// Single logger that writes to logs array
const logger = createLogger(logs.value, 'panel_test_experience')

// Available example projects
const exampleProjects = [exampleProject1, exampleProject2, exampleProject3]

// Project entries from config (will be loaded on mount)
const projectEntries = ref([])
const fetchedProjects = ref([])
const isFetchingData = ref(false)
const isFetchingImages = ref(false)
const fetchError = ref(null)
const shouldFetchImages = ref(false)

// Doc data - initialize with all projects
const docData = ref([])

// Normalize project data to handle various field name formats
const normalizeProject = (project) => {
  const normalized = { ...project }
  
  // Handle name vs title (prefer title if both exist)
  if (project.name && !project.title) {
    normalized.title = project.name
  }
  
  // Handle fields with trailing colons (people:, time:, place:, etc.)
  // Check each field with colon and create normalized version without colon
  Object.keys(project).forEach(key => {
    if (key.endsWith(':')) {
      const normalizedKey = key.slice(0, -1) // Remove trailing colon
      if (!normalized[normalizedKey]) {
        normalized[normalizedKey] = project[key]
      }
    }
  })
  
  // Also handle reverse: if we have 'people' but not 'people:', copy it
  // This ensures ProjectBuilder gets the data it needs
  if (project.people && !project['people:']) {
    normalized['people:'] = project.people
  }
  
  return normalized
}

// Process content item - can be string (text) or object (image/image row)
const processContentItem = (item) => {
  if (typeof item === 'string') {
    // Text content - mark it as text
    return { contentType: 'text', value: item }
  } else if (item && typeof item === 'object' && item.type === 'image') {
    // Image content - convert to Image or ImageRow component
    const srcArray = Array.isArray(item.src) ? item.src : [item.src]
    const captionArray = Array.isArray(item.caption) ? item.caption : (item.caption ? [item.caption] : [])
    
    if (srcArray.length === 1) {
      // Single image
      return {
        contentType: 'image',
        component: {
          type: 'Image',
          data: {
            src: srcArray[0],
            height: item.height || '200px',
            caption: captionArray.join(' / ')
          }
        }
      }
    } else {
      // Multiple images - use ImageRow
      // Check if we should use shared caption: multiple images but only one caption
      const useSharedCaption = srcArray.length > 1 && captionArray.length === 1
      
      const images = srcArray.map((src, index) => ({
        type: 'Image',
        data: {
          src: src,
          height: item.height || '200px',
          // Only assign individual captions if NOT using shared caption
          caption: useSharedCaption ? null : (captionArray[index] || '')
        }
      }))
      
      return {
        contentType: 'imageRow',
        component: {
          type: 'ImageRow',
          data: {
            items: images,
            // Use shared caption if applicable
            caption: useSharedCaption ? captionArray[0] : undefined
          }
        }
      }
    }
  }
  
  // Unknown format - treat as text
  return { contentType: 'text', value: String(item) }
}

// Build project components with mixed content support
const buildProjectComponentsWithImages = (project) => {
  // Check if content has mixed types (text and images)
  const hasMixedContent = project.content && Array.isArray(project.content) && 
    project.content.some(item => item && typeof item === 'object' && item.contentType)
  
  if (!hasMixedContent) {
    // Use standard builder if no mixed content
    return buildProjectComponents(project)
  }
  
  // Build components manually for mixed content
  const components = []
  
  // Use standard builder to get title and info tables
  const standardComponents = buildProjectComponents({ ...project, content: [], learnings: [] })
  // Add title and info tables (first 2 components)
  components.push(...standardComponents.slice(0, 2))
  
  // Now build content items by grouping text and inserting images
  const cellItems = []
  let currentTextGroup = []
  
  project.content.forEach((item) => {
    if (item.contentType === 'text') {
      currentTextGroup.push(item.value)
    } else {
      // Flush current text group if any
      if (currentTextGroup.length > 0) {
        cellItems.push({
          type: 'TextList',
          data: {
            mode: 'unordered',
            items: currentTextGroup.map(text => ({
              content: text,
              cssClass: 'cell-content',
              display: 'block'
            }))
          }
        })
        currentTextGroup = []
      }
      // Add some spacing before image
      cellItems.push({
        type: 'VSpace',
        data: { height: 8 }
      })
      // Add the image/imageRow component
      cellItems.push(item.component)
      // Add some spacing after image
      cellItems.push({
        type: 'VSpace',
        data: { height: 8 }
      })
    }
  })
  
  // Flush remaining text group
  if (currentTextGroup.length > 0) {
    cellItems.push({
      type: 'TextList',
      data: {
        mode: 'unordered',
        items: currentTextGroup.map(text => ({
          content: text,
          cssClass: 'cell-content',
          display: 'block'
        }))
      }
    })
  }
  
  // Build content table similar to ProjectBuilder but with mixed items
  if (cellItems.length > 0) {
    components.push({
      type: 'Table',
      data: {
        rows: [{
          type: 'Tr',
          data: {
            items: [{
              items: [
                {
                  type: 'Text',
                  data: {
                    content: 'プロジェクト内容',
                    cssClass: 'cell-label'
                  }
                },
                ...cellItems
              ],
              cssClass: 'cv-jp-cell content-cell',
              fillToPageBottom: true
            }],
            cssClass: 'content-row'
          }
        }],
        cssClass: 'form-table font-cv project-table',
        cssStyle: {
          width: '100%',
          borderCollapse: 'collapse'
        }
      }
    })
  }
  
  // Add learnings if present
  if (project.learnings && Array.isArray(project.learnings) && project.learnings.length > 0) {
    const learningsComponents = buildProjectComponents({ ...project, content: [] })
    // Get learnings table (last component if it exists)
    if (learningsComponents.length > 2) {
      components.push(learningsComponents[learningsComponents.length - 1])
    }
  }
  
  return components
}

// Fetch project data from config entries
const fetchProjectData = async () => {
  isFetchingData.value = true
  fetchError.value = null
  fetchedProjects.value = []
  
  logger.addLog('Starting to fetch project data', 'panel_test_experience.fetchProjectData', LogType.Normal)
  
  try {
    // Import projectEntries from config.0.js
    const config = await import('@/config.js')
    projectEntries.value = config.projectEntries || []
    
    if (projectEntries.value.length === 0) {
      fetchError.value = 'No project entries found in config.projectEntries'
      logger.addLog(fetchError.value, 'panel_test_experience.fetchProjectData', LogType.Warning)
      buildDocData()
      return
    }
    
    logger.addLog(`Found ${projectEntries.value.length} project entries`, 'panel_test_experience.fetchProjectData', LogType.Normal)
    
    // Fetch each project
    const fetchPromises = projectEntries.value.map(async (entry, index) => {
      try {
        logger.addLog(`Fetching entry ${index + 1}: ${entry}`, 'panel_test_experience.fetchProjectData', LogType.Normal)
        
        const result = await fetchRemoteData(
          entry,
          null, // serverOrigin (not used for mongo patterns)
          null, // getToken (not used for mongo patterns)
          SERVER_MONGO_INFO.origin,
          SERVER_MONGO_INFO.username,
          SERVER_MONGO_INFO.password
        )
        
        // Check if result is an error string
        if (typeof result === 'string' && result.startsWith('[Error:')) {
          logger.addLog(`Failed to fetch ${entry}: ${result}`, 'panel_test_experience.fetchProjectData', LogType.Error)
          return { error: `Entry ${index + 1}: ${result}` }
        }
        
        // Check if result is a valid project object
        if (result && typeof result === 'object') {
          const projectName = result.name || result.title || 'unknown'
          logger.addLog(`Successfully fetched project: ${projectName}`, 'panel_test_experience.fetchProjectData', LogType.Normal)
          
          // Process content array if it exists
          if (Array.isArray(result.content)) {
            result.content = result.content.map(item => processContentItem(item))
          }
          
          // Normalize the project data
          return normalizeProject(result)
        } else {
          const errorMsg = `Entry ${index + 1} (${entry}): Invalid result format`
          logger.addLog(errorMsg, 'panel_test_experience.fetchProjectData', LogType.Error)
          return { error: errorMsg }
        }
      } catch (error) {
        const errorMsg = `Entry ${index + 1} (${entry}): ${error.message}`
        logger.addLog(errorMsg, 'panel_test_experience.fetchProjectData', LogType.Error)
        return { error: errorMsg }
      }
    })
    
    const results = await Promise.all(fetchPromises)
    
    // Separate successful fetches from errors
    const validProjects = results.filter(p => p && !p.error)
    const errors = results.filter(p => p && p.error).map(p => p.error)
    
    fetchedProjects.value = validProjects
    
    if (validProjects.length === 0) {
      fetchError.value = `Failed to fetch any valid project data.\n${errors.join('\n')}`
      logger.addLog('Failed to fetch any valid project data', 'panel_test_experience.fetchProjectData', LogType.Error)
    } else {
      logger.addLog(`Successfully fetched ${validProjects.length} projects`, 'panel_test_experience.fetchProjectData', LogType.Normal)
      if (errors.length > 0) {
        fetchError.value = `Partially successful: ${validProjects.length} projects fetched, ${errors.length} failed:\n${errors.join('\n')}`
      }
    }
  } catch (error) {
    fetchError.value = `Error during fetch: ${error.message}`
    logger.addLog(`Error during fetch: ${error.message}`, 'panel_test_experience.fetchProjectData', LogType.Error)
  } finally {
    isFetchingData.value = false
    buildDocData()
  }
}

// Build doc data based on current settings
const buildDocData = () => {
  const components = []
  
  // If there's a fetch error, display it as Text component
  if (fetchError.value) {
    const errorLines = fetchError.value.split('\n')
    errorLines.forEach((line, index) => {
      if (index > 0) {
        components.push({
          type: 'VSpace',
          data: { height: 5 }
        })
      }
      components.push({
        type: 'TextRow',
        data: {
          items: [{
            type: 'Text',
            data: {
              content: line,
              cssClass: 'error-text',
              display: 'block'
            }
          }]
        }
      })
    })
    
    // Still show example projects if no data fetched
    if (fetchedProjects.value.length === 0) {
      components.push({
        type: 'VSpace',
        data: { height: 20 }
      })
      components.push({
        type: 'TextRow',
        data: {
          items: [{
            type: 'Text',
            data: {
              content: 'Showing example projects:',
              display: 'block'
            }
          }]
        }
      })
      components.push({
        type: 'VSpace',
        data: { height: 10 }
      })
      
      exampleProjects.forEach((project, index) => {
        if (index > 0) {
          components.push({
            type: 'VSpace',
            data: { height: 30 }
          })
        }
        components.push(...buildProjectComponents(project))
      })
    }
    
    docData.value = components
    logger.addLog(`Built doc data with error display and ${components.length} components`, 'panel_test_experience.buildDocData', LogType.Normal)
    return
  }
  
  // Use fetched projects if available, otherwise use examples
  const projectsToUse = fetchedProjects.value.length > 0 ? fetchedProjects.value : exampleProjects
  const useMixedBuilder = fetchedProjects.value.length > 0

  // Show all projects with spacing
  projectsToUse.forEach((project, index) => {
    if (index > 0) {
      // Add spacing between projects
      components.push({
        type: 'VSpace',
        data: { height: 30 }
      })
    }
    // Add the project's internal components directly
    if (useMixedBuilder) {
      components.push(...buildProjectComponentsWithImages(project))
    } else {
      components.push(...buildProjectComponents(project))
    }
  })

  docData.value = components
  logger.addLog(`Built doc data with ${components.length} components from ${projectsToUse.length} projects`, 'panel_test_experience.buildDocData', LogType.Normal)
}

// Fetch image data for all images in fetched projects
const fetchImageData = async () => {
  if (fetchedProjects.value.length === 0) {
    logger.addLog('No projects to fetch images for', 'panel_test_experience.fetchImageData', LogType.Warning)
    return
  }
  
  isFetchingImages.value = true
  logger.addLog('Starting to fetch image data', 'panel_test_experience.fetchImageData', LogType.Normal)
  
  try {
    // Collect all image src patterns
    const imageSrcs = []
    fetchedProjects.value.forEach(project => {
      if (Array.isArray(project.content)) {
        project.content.forEach(item => {
          if (item && typeof item === 'object') {
            if (item.type === 'Image' && item.data && item.data.src) {
              imageSrcs.push(item.data.src)
            } else if (item.type === 'ImageRow' && item.data && item.data.items) {
              item.data.items.forEach(img => {
                if (img.data && img.data.src) {
                  imageSrcs.push(img.data.src)
                }
              })
            }
          }
        })
      }
    })
    
    logger.addLog(`Found ${imageSrcs.length} images to fetch`, 'panel_test_experience.fetchImageData', LogType.Normal)
    
    // Trigger fetch for all images
    shouldFetchImages.value = true
    
    // Wait a bit for images to start fetching
    await new Promise(resolve => setTimeout(resolve, 100))
    
    logger.addLog('Image fetching initiated', 'panel_test_experience.fetchImageData', LogType.Normal)
  } catch (error) {
    logger.addLog(`Error initiating image fetch: ${error.message}`, 'panel_test_experience.fetchImageData', LogType.Error)
  } finally {
    isFetchingImages.value = false
  }
}

// Provide shouldFetchImages to child components
provide('shouldFetchImages', shouldFetchImages)

// Initialize on mount
onMounted(() => {
  logger.addLog('Initialized with all projects view', 'panel_test_experience.init', LogType.Normal)
  buildDocData()
})

// Run pagination test
const runPagination = async () => {
  logger.addLog('Starting pagination test', 'panel_test_experience.runPagination')
  if (paginationRef.value) {
    paginationRef.value.setDocData(docData.value)
    logger.addLog('Set doc data, running pagination', 'panel_test_experience.runPagination')
    await paginationRef.value.runPagination()
    logger.addLog('Pagination completed', 'panel_test_experience.runPagination')

    // Merge pagination logs into display logs
    const paginationLogs = paginationRef.value.getLogs()
    logger.addLog(`Retrieved ${paginationLogs ? paginationLogs.length : 'null'} pagination logs`, 'panel_test_experience.runPagination')
    if (paginationLogs && paginationLogs.length > 0) {
      logs.value = [...logs.value, ...paginationLogs]
      logger.addLog(`Merged ${paginationLogs.length} pagination logs`, 'panel_test_experience.runPagination')
    } else {
      logger.addLog('No pagination logs to merge', 'panel_test_experience.runPagination')
    }
  } else {
    logger.addLog('Pagination ref not available', 'panel_test_experience.runPagination', 'Error')
  }
}

// Clear logs
const clearLogs = () => {
  logs.value = []
}
</script>

<template>
  <PanelTest
    title="Experience Test"
    description="Test data-driven pagination for Japanese project components."
    doc-id="test-experience"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    :logs="logs"
    @run-pagination="runPagination"
    @clear-logs="clearLogs"
  >
    <template #extra-buttons>
      <button @click="fetchProjectData" class="control-button" :disabled="isFetchingData">
        {{ isFetchingData ? 'Fetching...' : 'Fetch Data' }}
      </button>
      
      <button @click="fetchImageData" class="control-button" :disabled="isFetchingImages || fetchedProjects.length === 0">
        {{ isFetchingImages ? 'Fetching Images...' : 'Fetch Image Data' }}
      </button>
    </template>

    <template #extra-info>
      <div class="info-row">
        <span>Data Source:</span>
        <span>{{ fetchedProjects.length > 0 ? 'MongoDB (Fetched)' : 'Example Data' }}</span>
      </div>
      <div class="info-row">
        <span>Total Projects:</span>
        <span>{{ fetchedProjects.length > 0 ? fetchedProjects.length : exampleProjects.length }}</span>
      </div>

      <div class="description" style="margin-top: 20px;">
        <strong>How it works:</strong><br/>
        <strong>Project Components:</strong> Uses Table/VSpace/Text components directly for pagination
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Structure: [Table (Title), Table (Info), Table (Content)] per project</li>
          <li>Can split across pages when content overflows</li>
          <li>Tables split at row boundaries, Text components split internally</li>
          <li>Learnings section is optional and will paginate if present</li>
        </ul>

        <strong>Data Sources:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><strong>Example Data:</strong> 3 sample projects (AI Chatbot, E-commerce, Health App)</li>
          <li><strong>MongoDB:</strong> Click "Fetch Data" to load projects from config.projectEntries</li>
          <li>Fetched data uses pattern: <code>&#123;&#123;mongo:db/collection?key=value&path=.&#125;&#125;</code></li>
        </ul>

        <strong>Controls:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>"Fetch Data" - Load project data from MongoDB (processes content)</li>
          <li>"Fetch Image Data" - Trigger image fetching for all images in projects</li>
          <li>"Run Pagination" - Test page splitting and layout</li>
          <li>Errors are displayed as Text components in the document</li>
        </ul>

        <strong>Mixed Content Support:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Content arrays can contain strings (text) and image objects</li>
          <li>Image objects use: <code>{type: 'image', src: [...], caption: [...], height: '200px'}</code></li>
          <li>Single src creates Image component, multiple src creates ImageRow</li>
          <li>Images use pattern: <code>&#123;&#123;file:accessPointId/path/to/file&#125;&#125;</code></li>
        </ul>
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-experience-original">
          <component
            v-for="(comp, idx) in docData"
            :key="idx"
            :is="getComponent(comp.type)"
            v-bind="comp.data"
          />
        </Doc>
      </div>
    </template>

    <template #content>
      <PaginationWrapper
        ref="paginationRef"
        docId="test-experience"
        :pageHeight="PAGE_SIZES.pageHeight"
        :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
      />
    </template>
  </PanelTest>
</template>
