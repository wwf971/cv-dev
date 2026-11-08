<template>
  <div class="page-padding-top" :style="{ height: `${height}px` }"></div>
</template>

<script setup lang="ts">
defineProps<{
  height: number
}>()
</script>

<style scoped>
.page-padding-top {
  width: 100%;
  /* This represents the top padding of the page */
}
</style>

