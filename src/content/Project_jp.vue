<template>
  <div class="font-cv project-container">
    <table class="form-table project-table">
      <tbody>
        <!-- Title row with project type -->
        <TrCrossPage trClass="title-row" :hideEmptyFirstRow="true">
          <TdCrossPage colspan="3" tdClass="title-cell" :vText="''">
            <div class="title-content">
              <div class="title-wrapper">
                <span class="project-title">{{ data_validated.title }}</span>
                <span v-if="data_validated.title_en" class="project-title-en">{{ data_validated.title_en }}</span>
              </div>
              <div class="project-type">{{ data_validated.type }}</div>
            </div>
          </TdCrossPage>
        </TrCrossPage>
      </tbody>
    </table>
    <table class="form-table project-table">
      <colgroup>
        <col style="width: 40%;">
        <col style="width: 25%;">
        <col style="width: 35%;">
      </colgroup>
      <tbody>
        <!-- People and Time row -->
        <TrCrossPage trClass="info-row no-top-border">
          <TdCrossPage tdClass="people-cell" :vText="''">
            <div class="cell-label">関連人員</div>
            <div class="cell-content" v-html="data_validated.people"></div>
          </TdCrossPage>
          <TdCrossPage tdClass="time-cell" :vText="''">
            <div class="cell-label">期間</div>
            <div class="cell-content">{{ data_validated.time }}</div>
          </TdCrossPage>
          <TdCrossPage tdClass="place-cell" :vText="''">
            <div class="cell-label">場所</div>
            <div class="cell-content" v-html="data_validated.place"></div>
          </TdCrossPage>
        </TrCrossPage>
      </tbody>
    </table>
    <table class="form-table project-table">
      <tbody>
        <!-- Tech stack row -->
        <TrCrossPage trClass="tech-row no-top-border">
          <TdCrossPage colspan="3" tdClass="tech-cell" :vText="''">
            <div style="display: flex; gap: 10px; align-items: center;">
            <div class="cell-label">使用技術</div>
            <div class="tech-stack">
              <span 
                  v-for="tech in data.techTags" 
                :key="tech" 
                class="tech-tag"
              >
                {{ tech }}
              </span>
              </div>
            </div>
          </TdCrossPage>
        </TrCrossPage>
        
        <!-- Project content - this can split across pages -->
        <TrCrossPage trClass="content-row no-top-border">
          <TdCrossPage colspan="3" tdClass="content-cell" :vText="''">
            <h4 class="content-title">プロジェクト内容</h4>
            <ListComponent :content="data.content" />
          </TdCrossPage>
        </TrCrossPage>
        
        <!-- Learning outcomes - this can also split across pages -->
        <TrCrossPage trClass="learning-row no-top-border" v-if="data?.learnings && data.learnings?.length > 0">
          <TdCrossPage colspan="3" tdClass="learning-cell" :vText="''">
            <h4 class="learning-title">学習・実践内容</h4>
            <ListComponent :content="data.learnings" />
          </TdCrossPage>
        </TrCrossPage>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TrCrossPage from '@/pagination/TrCrossPage.vue'
import TdCrossPage from '@/pagination/TdCrossPage.vue'
import ListComponent from '@/components/list.vue'
import { useInfoStore } from '@/content/info.js'

// Define component name
defineOptions({
  name: 'ProjectJP'
})

// Props
const props = defineProps({
  project: {
    type: [Object, String],
    required: false,
  },
  url: {
    type: String,
    required: false,
    default: null,
  },
})

// Get info store for remote fetching
const infoStore = useInfoStore()

// Ref for remote project data
const remoteProjectData = ref(null)
const isLoading = computed(() => {
  if (props.url) {
    return infoStore.infoCacheState[props.url] !== "ready"
  }
  return false
})
const error = ref(null)

// Default project template
const data_default = {
  title: 'null',
  type: 'null',
  people: 'null',
  time: 'null',
  techTags: [],
  content: 'null',
  learnings: []
}

// Computed to fetch data from URL if provided
const data_fetch = computed(() => {
  if (props.url !== null) {
    if (infoStore.infoCacheState[props.url] === "ready") {
      return infoStore.infoCache[props.url]
    }
  }
  return null
})

// Local data ref that gets updated when remote data is fetched
const data = ref(props.project);


const data_validated = computed(() => {
  if(data.value == null){
    data.value = data_default;
  }
  return validateProject(data.value)
})

// Watch for changes in fetched data and update local data
watch(data_fetch, (newVal) => {
  if (newVal !== null) {
    data.value = newVal
  }
})

// Validate and normalize project data
const validateProject = (projectData) => {
  // If project is a string (like loading state), return default
  if (typeof projectData === 'string') {
    console.warn('ProjectJP: Project data is a string, using default values:', projectData)
    return data_default
  }
  
  // If not an object, return default
  if (!projectData || typeof projectData !== 'object') {
    console.error('ProjectJP: Invalid project data format, using default values:', projectData)
    return data_default
  }
  
  // Merge with default values for missing properties
  return {
    title: projectData.title || 'null',
    title_en: projectData.title_en || null,
    type: projectData.type || 'null',
    people: projectData.people || 'null',
    place: projectData.place || 'null',
    time: projectData.time || 'null',
    techTags: Array.isArray(projectData.techTags) ? projectData.techTags : [],
    content: projectData.content || 'null',
    learnings: Array.isArray(projectData.learnings) ? projectData.learnings : []
  }
}

const formatLearningText = computed(() => {
  try {
    const learnings = data.value.learnings
    if (!learnings || learnings.length === 0) {
      return '学習・実践内容\n学習内容を読み込み中...'
    }
    // Handle both string array and mixed content array
    const learningItems = Array.isArray(learnings) 
      ? learnings.filter(item => typeof item === 'string').map(item => `• ${item}`).join('\n')
      : `• ${learnings}`
    return `学習・実践内容\n${learningItems}`
  } catch (error) {
    console.error('ProjectJP: Error formatting learning text:', error)
    return '学習・実践内容\nエラーが発生しました'
  }
})

// Helper computed property to debug content structure
const contentDebugInfo = computed(() => {
  const content = data.value.content
  return {
    type: typeof content,
    isArray: Array.isArray(content),
    length: Array.isArray(content) ? content.length : (typeof content === 'string' ? content.length : 'N/A'),
    structure: Array.isArray(content) 
      ? content.map((item, index) => ({ 
          index, 
          type: typeof item, 
          hasType: typeof item === 'object' && item?.type,
          preview: typeof item === 'string' ? item.substring(0, 50) + '...' : JSON.stringify(item)
        }))
      : content
  }
})

// Fetch remote project data if URL is provided
const fetchRemoteProject = async () => {
  if (!props.url) return
  // Trigger data loading through the info store
  infoStore.info(
    props.url, false // verbose
  )
}

// Watch for URL changes
watch(() => props.url, fetchRemoteProject, { immediate: true })

onMounted(() => {
  console.log('ProjectJP mounted')
  console.log('props.project:', props.project)
  console.log('props.url:', props.url)
  console.log('data:', data.value)
  
  // URL-based data loading is handled automatically by the computed property
})

// Expose project data for debugging
defineExpose({
  data,
  remoteProjectData,
  isLoading,
  error,
  contentDebugInfo,
  formatLearningText
})
</script>

<style scoped>
@import '../styles-shared.css';

.project-container {
}

.project-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* Title row styles */
.title-row {
  height: 50px;
}

.title-cell {
  background-color: #f8f8f8;
  font-weight: bold;
  text-align: center;
  padding: 8px 12px;
  position: relative;
}

.title-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.title-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.project-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.project-title-en {
  font-size: 12px;
  font-weight: normal;
  color: #888;
}

.project-type {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background-color: #d4edda;
  color: #155724;
  padding: 4px 6px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: normal;
}

/* Info row styles */
.info-row {
  height: 45px;
}

.people-cell,
.time-cell {
  width: 50%;
  padding: 8px 12px;
  text-align: center;
  vertical-align: middle;
}

.cell-label {
  font-size: 12px;
  color: #666;
  font-weight: normal;
  align-self: center;
  text-align: center;
}

.cell-content {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  align-self: center;
  text-align: center;
}

/* Tech stack styles */
.tech-row {
  height: auto;
  min-height: 45px;
}

.tech-cell {
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tech-tag {
  background-color: #e8f4f8;
  border: 1px solid #b8d4e0;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #2c5aa0;
  font-weight: 500;
}

/* Content styles */
.content-row {
  height: auto;
  min-height: 80px;
}

.content-cell {
  padding: 12px;
  text-align: left;
  vertical-align: top;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.content-wrapper,
.learning-wrapper {
  width: 100%;
}

.content-title,
.learning-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin: 0 0 4px 0;  /* Fixed margin */
  padding: 0;
  line-height: 1.2;   /* Fixed line height */
  height: 17px;       /* Fixed height for predictable measurements */
  display: block;
  box-sizing: border-box;
}

/* Learning styles */
.learning-row {
  height: auto;
  min-height: 60px;
}

.learning-cell {
  padding: 12px;
  text-align: left;
  vertical-align: top;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
}

/* Debug styles for list component */
.debug-item {
  background-color: #f0f8ff;
  border: 1px solid #87ceeb;
  padding: 4px 8px;
  margin: 2px 0;
  border-radius: 3px;
  font-family: monospace;
}

.debug-object {
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  padding: 8px;
  margin: 4px 0;
  border-radius: 3px;
  font-size: 10px;
  overflow-x: auto;
}

.debug-value {
  display: block;
  margin-top: 4px;
  font-style: italic;
  color: #666;
}

/* Ensure consistent table styling */
.project-table td {
  border: 1px solid #000;
  box-sizing: border-box;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  
  .title-content {
    flex-direction: column;
    gap: 4px;
  }
}
</style>

