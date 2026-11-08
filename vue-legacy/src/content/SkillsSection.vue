<template>
  <div>
    <div class="section-title">Skills</div>
    <div class="skills-section">
      <!-- Languages -->
      <div class="skill-category" v-if="getSkillsData().Language">
        <div class="skill-category-title">Languages / Tests</div>
        <div style="display: flex; flex-direction: row; flex-wrap: wrap;">
          <div v-for="(lang, name) in getSkillsData().Language" :key="name" class="language-skill">
            <span class="skill-item-name">{{ lang.language || name }}</span>
            <span class="skill-tag" v-html="lang.description"></span>
          </div>
        </div>
      </div>
      
      <!-- Programming Skills -->
      <div class="skill-category" v-if="getSkillsData().Programming">
        <div class="skill-category-title">Programming</div>                    
        <div v-for="(skills, category) in getSkillsData().Programming" :key="category" v-if="category !== 'language' && category !== 'Web'" class="skill-item">
          <div style="display: flex; flex-direction: row; flex-wrap: wrap;">
            <div class="skill-item-name">{{ category }}</div>
            <div class="skill-list">
              <span v-for="(skill, i) in skills" :key="i" class="skill-tag">{{ skill }}</span>
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

// Helper function to safely parse skills data
const getSkillsData = () => {
  try {
    const data = props.info('skills')
    // Check if data is a string that looks like HTML (loading/error state)
    if (typeof data === 'string' && data.includes('<div>')) {
      return {} // Return empty object during loading/error
    }
    // If it's already an object, return it
    if (typeof data === 'object' && data !== null) {
      return data
    }
    // Try to parse as JSON
    return JSON.parse(data || '{}')
  } catch (error) {
    console.warn('Failed to parse skills data:', error)
    return {}
  }
}
</script> 