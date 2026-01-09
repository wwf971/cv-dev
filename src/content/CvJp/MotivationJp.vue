<template>
  <div ref="motivationRef" class="font-cv">
    <component
      v-for="(comp, index) in displayComponents"
      :key="index"
      :is="getComponent(comp.type)"
      v-bind="comp.data"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import Table from '../../pagination/component/Table.vue'
import VSpace from '../../pagination/component/VSpace.vue'
import TextList from '../../pagination/component/TextList.vue'
import { buildMotivationComponents } from './MotivationBuilder'

interface Props {
  motivation?: string | string[] | Record<string, any>
  interest?: string | string[] | Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  motivation: undefined,
  interest: undefined
})

const motivationRef = ref<HTMLElement | null>(null)

// Inject logger (optional - may not be available in all contexts)
const logger = inject('paginationLogger', null) as any

// Display components: use builder function to generate components
const displayComponents = computed(() => buildMotivationComponents({
  motivation: props.motivation as any,
  interest: props.interest as any
}, logger))

// Component mapping
const getComponent = (type: string) => {
  switch (type) {
    case 'Table':
      return Table
    case 'VSpace':
      return VSpace
    case 'TextList':
      return TextList
    default:
      return null
  }
}

// Note: No trySplit implementation
// This component acts as a transparent container for child components (Table, VSpace)
// The pagination system will handle splitting of the child components individually
</script>

<style scoped>
@import './styles-shared.css';

/* Motivation content styling */
:deep(.motivation-content) {
    border: 1px solid #000;
    padding: 12px;
    vertical-align: top;
    text-align: left;
    min-height: 100px;
}

:deep(.motivation-content .text-component) {
    line-height: 1.8;
    font-size: 14px;
    white-space: pre-line;
    word-wrap: break-word;
}

/* Header cell styling */
:deep(.header-cell) {
    background-color: #f0f0f0;
    text-align: center;
    font-weight: bold;
    border: 1px solid #000;
    padding: 8px;
}

:deep(.word-spacing-0p5) {
    word-spacing: 0.5em;
}

/* Content row styling */
:deep(.content-row) {
    min-height: 150px;
}

/* Ensure consistent cell heights */
:deep(.cv-jp-cell) {
    vertical-align: middle;
    box-sizing: border-box;
}
</style> 