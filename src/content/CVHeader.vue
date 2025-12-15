<template>
  <div class="cv-header">
    <div class="cv-name">{{ info("name/full/en") }}</div>
    <div class="cv-contact">
      <span>{{ info("email/google") }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  info: {
    type: Function,
    required: true
  }
})
</script> 