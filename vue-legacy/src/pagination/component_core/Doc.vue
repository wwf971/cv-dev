<template>
  <div :id="docId" ref="docContainerRef" class="doc-container">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'

const props = defineProps<{
  docId: string
}>()

const docContainerRef = ref<HTMLElement | null>(null)

// API for descendants to measure vertical position relative to doc top
const measureVerticalPos = (element: HTMLElement) => {
  if (!docContainerRef.value) return 0
  
  const docRect = docContainerRef.value.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  
  return elementRect.top - docRect.top
}

const measureVerticalPosEnd = (element: HTMLElement) => {
  if (!docContainerRef.value) return 0
  
  const docRect = docContainerRef.value.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  
  return elementRect.bottom - docRect.top
}

const getDocRect = () => {
  return docContainerRef.value?.getBoundingClientRect()
}

// Provide APIs to descendants
provide('docContext', {
  docId: props.docId,
  measureVerticalPos,
  measureVerticalPosEnd,
  getDocRect
})

onMounted(() => {
  // console.log(`Doc ${props.docId} mounted`)
})

// Expose methods to parent component
defineExpose({
  measureVerticalPos,
  measureVerticalPosEnd,
  getDocRect
})
</script>

<style scoped>
.doc-container {
  position: relative;
  width: 100%;
}
</style>

