<template>
  <div class="education-section">
    <h2>学歴 / Education</h2>
    
    <!-- Each education entry -->
    <div v-for="(edu, index) in education" :key="index" class="education-item">
      
      <!-- School Name -->
      <div class="field-container">
        <div class="field-key">
          <div class="jp-text">学校</div>
          <div class="en-text">School</div>
        </div>
        <div class="field-value">
          <div class="jp-text">{{ edu.school_jp || edu.school }}</div>
          <div class="en-text">{{ edu.school }}</div>
        </div>
      </div>

      <!-- Degree -->
      <div class="field-container">
        <div class="field-key">
          <div class="jp-text">学位</div>
          <div class="en-text">Degree</div>
        </div>
        <div class="field-value">
          <!-- For single language fields -->
          <div class="en-text">{{ edu.degree }}</div>
        </div>
      </div>

      <!-- Graduation -->
      <div class="field-container compact">
        <div class="field-key narrow">
          <div class="jp-text">卒業</div>
          <div class="en-text">Graduated</div>
        </div>
        <div class="field-value">
          <div class="en-text">{{ edu.graduation_time }}</div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
defineProps({
  education: {
    type: Array,
    required: true
  }
})
</script>

<style scoped>
/* Component-specific styles only */
.education-section {
  margin-bottom: 30px;
}

.education-item {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.education-item:last-child {
  margin-bottom: 0;
}

h2 {
  margin-bottom: 20px;
  color: #333;
}
</style> 