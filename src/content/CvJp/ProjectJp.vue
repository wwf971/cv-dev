<template>
  <div class="font-cv project-container">
    <component
      v-for="(comp, index) in displayComponents"
      :key="index"
      :is="getComponent(comp.type)"
      v-bind="comp.data"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import Table from '../../pagination/component/Table.vue'
import VSpace from '../../pagination/component/VSpace.vue'
import { buildProjectComponents } from './ProjectBuilder'
import { useInfoStore } from '../../content/info.js'

// Define component name
defineOptions({
  name: 'ProjectJp'
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

// Inject logger (optional - may not be available in all contexts)
const logger = inject('paginationLogger', null) as any

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

// Validate and normalize project data
const validateProject = (projectData: any) => {
  // If project is a string (like loading state), return default
  if (typeof projectData === 'string') {
    console.warn('ProjectJp: Project data is a string, using default values:', projectData)
    return data_default
  }

  // If not an object, return default
  if (!projectData || typeof projectData !== 'object') {
    console.error('ProjectJp: Invalid project data format, using default values:', projectData)
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

const data_validated = computed(() => {
  if(data.value == null){
    data.value = data_default;
  }
  return validateProject(data.value)
})

// Display components: use builder function to generate components
const displayComponents = computed(() => buildProjectComponents(data_validated.value))

// Component mapping
const getComponent = (type: string) => {
  switch (type) {
    case 'Table':
      return Table
    case 'VSpace':
      return VSpace
    default:
      return null
  }
}

// Watch for changes in fetched data and update local data
watch(data_fetch, (newVal) => {
  if (newVal !== null) {
    data.value = newVal
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
  console.log('ProjectJp mounted')
  console.log('props.project:', props.project)
  console.log('props.url:', props.url)
  console.log('data:', data.value)
})

// Expose project data for debugging
defineExpose({
  data,
  remoteProjectData,
  isLoading,
  data_validated,
  displayComponents
})
</script>

<style>
@import './styles-shared.css';

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

.info-cell {
  padding: 8px 12px;
  text-align: left;
  vertical-align: middle;
}

.cell-label {
  font-size: 12px;
  color: #666;
  font-weight: normal;
  display: block;
  margin-bottom: 2px;
  line-height: 1.4;
}

.cell-content {
  font-size: 14px !important;
  font-weight: normal !important;
  color: #333 !important;
  display: block !important;
  line-height: 1.0 !important;
}

/* Learnings content should have tighter line height */
.learning-cell .cell-content {
  line-height: 1 !important;
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

:deep(.tech-cell .text-component.tech-tag) {
  display: inline-block;
  background-color: #e8f5e8;
  border: 1px solid #b8d4b8;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #2c5a2c;
  font-weight: 500;
  margin-right: 6px;
  margin-bottom: 4px;
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