<template>
  <div>
    <div style="display: flex; justify-content: flex-start; align-items: center; gap: 10px;" class="section-title">
      <div style="margin: 0;">Research Projects</div>
      <a href="https://wwf194.myqnapcloud.com:10001/research_project" style="font-size: 14px; color: #5b9bd5; text-decoration: none;">View Details</a>
    </div>
    <div class="research-section">
      <div class="research-project" v-for="(project, index) in getResearchData()" :key="index">
        <img v-if="project.cover" class="project-cover" :src="project.cover" :alt="project.title">
        <div class="project-details">
          <div>
            <div class="project-title">{{ project.title }}</div>
            <div class="project-intro">{{ project.intro }}</div>
          </div>
          <div class="project-header">
            <div class="project-people" v-if="project.people">
              Worked with: {{ Array.isArray(project.people) ? project.people.join(', ') : project.people }}
            </div>
            <div v-if="project.status">
              <span v-if="Array.isArray(project.status)" v-for="(status, i) in project.status" :key="i" class="status-tag">{{ status }}</span>
              <span v-else class="status-tag">{{ project.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  info: {
    type: Function,
    required: true
  }
})

// Helper function to safely parse research projects data
const getResearchData = () => {
  try {
    const data = props.info('research_projects')
    // Check if data is a string that looks like HTML (loading/error state)
    if (typeof data === 'string' && data.includes('<div>')) {
      return [] // Return empty array during loading/error
    }
    // If it's already an array, return it
    if (Array.isArray(data)) {
      return data
    }
    // Try to parse as JSON
    return JSON.parse(data || '[]')
  } catch (error) {
    console.warn('Failed to parse research projects data:', error)
    return []
  }
}
</script> 