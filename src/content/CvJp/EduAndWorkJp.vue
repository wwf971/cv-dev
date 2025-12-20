<template>
  <div ref="eduWorkRef" class="font-cv">
    <component
      v-for="(comp, index) in displayComponents"
      :key="index"
      :is="getComponent(comp.type)"
      v-bind="comp.data"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Table from '../../pagination/component/Table.vue'
import VSpace from '../../pagination/component/VSpace.vue'
import { buildEduAndWorkComponents } from './EduAndWorkBuilder'

const props = defineProps({
  eduEntries: Array,
  workEntries: Array,
  licenseEntries: Array
})

const eduWorkRef = ref<HTMLElement | null>(null)

// Display components: use builder function to generate components
const displayComponents = computed(() => buildEduAndWorkComponents({
  eduEntries: props.eduEntries as any,
  workEntries: props.workEntries as any,
  licenseEntries: props.licenseEntries as any
}))

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

// Note: No trySplit implementation
// This component acts as a transparent container for child components (Table, VSpace, Table)
// The pagination system will handle splitting of the child components individually
</script>

<style scoped>
@import './styles-shared.css';

/* Add padding to all table rows */
:deep(tr) {
  padding-top: 8px;
  padding-bottom: 6px;
}

.date-column-header {
  width: 60px;
  min-width: 60px;
}

.section-divider-row {
  height: 35px;
}

.section-divider {
  border: 1px solid #000;
  background-color: #f0f0f0;
  text-align: center;
  font-weight: bold;
  font-size: 14px;
  padding: 8px;
}

.entry-row {
  height: 35px;
}

.empty-row {
  height: 15px !important;
}

.time-cell {
  text-align: center;
  vertical-align: middle;
  padding: 4px;
}

/* Year cell minimum width */
.year-cell {
  min-width: 60px;
}

/* Year cell specific styling - force child text components to display as blocks */
:deep(.year-cell .text-component) {
  display: block !important;
  line-height: 1.2;
  white-space: nowrap;
}

/* Japanese year (first text component) - smaller and gray */
:deep(.year-cell .text-component:first-child) {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  line-height: 1;
  margin-bottom: 2px;
}

/* Gregorian year (second text component) - normal size */
:deep(.year-cell .text-component:last-child:not(:first-child)) {
  font-size: 14px;
  line-height: 1;
}

/* Month cell and content cell alignment - match year cell structure */
:deep(.month-cell .text-component),
:deep(.content-cell .text-component) {
  display: block !important;
  line-height: 1.2;
}

/* Spacer (first text component) in month and content cells - match Japanese year style */
:deep(.month-cell .text-component:first-child),
:deep(.content-cell .text-component:first-child) {
  font-size: 11px;
  font-weight: 500;
  color: transparent; /* Invisible but takes up space */
  line-height: 1;
  margin-bottom: 2px;
}

/* Actual content (second text component) - normal size */
:deep(.month-cell .text-component:last-child:not(:first-child)),
:deep(.content-cell .text-component:last-child:not(:first-child)) {
  font-size: 14px;
  line-height: 1;
}

.no-hori-border {
  border-top: none !important;
  border-bottom: none !important;
}
</style>
