<template>
  <div class="cv-header">
    <!-- Name Field -->
    <div class="field-container">
      <div class="field-key">
        <div class="jp-text">氏名</div>
        <div class="en-text">Name</div>
      </div>
      <div class="field-value">
        <div class="jp-text">{{ info("name/full/jp") }}</div>
        <div class="en-text">{{ info("name/full/en") }}</div>
      </div>
    </div>

    <!-- Contact Information -->
    <div class="field-container">
      <div class="field-key">
        <div class="jp-text">連絡先</div>
        <div class="en-text">Contact</div>
      </div>
      <div class="field-value">
        <div class="en-text">{{ info("email/google") }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Define component name
defineOptions({
  name: 'CVHeader'
})

defineProps({
  info: {
    type: Function,
    required: true
  }
})
</script>

<style scoped>

</style> 