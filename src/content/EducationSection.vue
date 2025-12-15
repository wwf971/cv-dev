<template>
  <div>
    <div class="section-title">Education</div>
    <div class="education-section">
      <div class="education-item" v-for="(edu, index) in getEducationData()" :key="index">
        <div style="display: flex; flex-direction: row; justify-content: space-between;">
          <div class="school-name">{{ edu.school }}</div>
          <div class="graduation-date">Graduation: {{ edu.graduation_time }}</div>
        </div>

        <div class="degree-info" v-if="Array.isArray(edu.degree)">
          <div v-for="(degree, i) in edu.degree" :key="i">{{ degree }}</div>
        </div>
        <div class="degree-info" v-else>{{ edu.degree }}</div>
        <div v-if="edu.supervisor" class="degree-info">Supervisor: {{ edu.supervisor }}</div>
        <div class="thesis-info" v-if="edu.thesis">Thesis: {{ edu.thesis }}</div>
        <div class="thesis-info" v-if="edu.scholarship">Scholarship: {{ edu.scholarship }}</div>
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

// Helper function to safely parse education data
const getEducationData = () => {
  try {
    const data = props.info('education')
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
    console.warn('Failed to parse education data:', error)
    return []
  }
}
</script> 