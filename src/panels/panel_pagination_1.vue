<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) -->
    <div class="control-panel">
      <h3>Pagination 1 (Content-Based)</h3>
      <p class="description">Automatically detects content breaks for pagination.</p>
      
      <button @click="rerunPagination" class="control-button">
        Refresh Pagination
      </button>
      
      <div v-if="pagination1Ref" class="status-info">
        <small>Status: {{ pagination1Ref.status || 'Ready' }}</small>
      </div>
      
    </div>

    <!-- Content Panel (Right) -->
    <div class="content-panel">
      <Pagination1 ref="pagination1Ref" />
      <Content :paginationMode="1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Pagination1 from '@/pagination/Pagination_1.vue'
import Content from '@/content/content.vue'

const pagination1Ref = ref(null)

const rerunPagination = () => {
  if (pagination1Ref.value && pagination1Ref.value.rerunPagination) {
    pagination1Ref.value.rerunPagination()
  }
}
</script>

<style scoped>
@import './panel_styles.css';

/* Panel-specific styles (if any) */
</style>

