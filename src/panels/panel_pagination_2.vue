<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) -->
    <div class="control-panel">
      <h3>Pagination 2 (Fixed-Position)</h3>
      <p class="description">Components register positions for precise pagination control.</p>
      
      <button @click="updateComponents" class="control-button">
        Update Components
      </button>
      
      <button @click="updatePageLines" class="control-button">
        Update Page Lines
      </button>
      
      <div class="info-panel">
        <h4>Page Height Info</h4>
        <div class="info-row">
          <span>A4 Height:</span>
          <span>{{ paginationStore.containerInfo.pageHeight?.toFixed(0) }}px</span>
        </div>
        <div class="info-row">
          <span>Effective Height:</span>
          <span>{{ paginationStore.containerInfo.effectivePageHeight?.toFixed(0) }}px</span>
        </div>
        <div class="info-row">
          <span>Padding:</span>
          <span>{{ paginationStore.containerInfo.paddingTop }} / {{ paginationStore.containerInfo.paddingBottom }}px</span>
        </div>
        
        <h4>Update Status</h4>
        <div class="info-row">
          <span>Components Updating:</span>
          <span>{{ paginationStore.isUpdating ? 'Yes' : 'No' }}</span>
        </div>
        <div class="info-row">
          <span>Page Lines Updating:</span>
          <span>{{ paginationStore.isUpdatingPageLines ? 'Yes' : 'No' }}</span>
        </div>
        <div class="info-row">
          <span>Registered Components:</span>
          <span>{{ paginationStore.registeredComponents.size }}</span>
        </div>
      </div>
      
    </div>

    <!-- Content Panel (Right) with Pagination2 wrapper -->
    <div class="content-panel">
      <Pagination2 ref="pagination2Ref">
        <Content :paginationMode="2" />
      </Pagination2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Pagination2 from '@/pagination/Pagination_2.vue'
import Content from '@/content/content.vue'
import { usePaginationStore } from './paginationStore.js'

const pagination2Ref = ref(null)
const paginationStore = usePaginationStore()

// Enable pagination 2 when this panel mounts
onMounted(() => {
  paginationStore.setPaginationActive(true)
})

const updateComponents = () => {
  paginationStore.updatePaginationComponents()
}

const updatePageLines = () => {
  paginationStore.updatePageLines()
}
</script>

<style scoped>
@import './panelStyles.css';

/* Panel-specific styles (if any) */
</style>

