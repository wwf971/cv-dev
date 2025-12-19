<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) -->
    <div class="control-panel">
      <h3>Table Cross-Page Test</h3>
      <p class="description">Test pagination for tables that span across pages.</p>
      
      <button @click="updatePagination" class="control-button">
        Update Pagination
      </button>
      
      <div class="info-panel">
        <h4>Test Info</h4>
        <div class="info-row">
          <span>Doc ID:</span>
          <span>test-table-cross-page</span>
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
        <div class="page_a4_width">
          <h2>Cross-Page Table Test</h2>
          <p>This tests the TrCrossPage and TdCrossPage components.</p>
          
          <table class="test-table">
            <tbody>
              <TrCrossPage :trClass="'test-row'" :threshold="0">
                <TdCrossPage :tdClass="'test-cell'" :vText="longText" />
              </TrCrossPage>
              
              <TrCrossPage :trClass="'test-row'" :threshold="0">
                <TdCrossPage :tdClass="'test-cell'">
                  <h4>Slot Content Test</h4>
                  <p v-for="i in 20" :key="i">This is paragraph {{ i }} to test slot-based pagination.</p>
                </TdCrossPage>
              </TrCrossPage>
              
              <TrCrossPage :trClass="'test-row'" :threshold="0">
                <TdCrossPage :tdClass="'test-cell'" :vText="mediumText" />
              </TrCrossPage>
            </tbody>
          </table>
        </div>
      </Pagination2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Pagination2 from '../pagination/Pagination_2.vue'
import TrCrossPage from '../pagination/component_old/TrCrossPage.vue'
import TdCrossPage from '../pagination/component_old/TdCrossPage.vue'
import { usePaginationStore } from './paginationStore.js'

const pagination2Ref = ref(null)
const paginationStore = usePaginationStore()

const updatePagination = () => {
  paginationStore.updatePaginationComponents()
}

// Test data
const longText = computed(() => {
  return 'これはとても長いテキストです。'.repeat(50) + 
    '改行テストも含まれています。\n'.repeat(10) +
    'This is a very long text for testing cross-page table rows. '.repeat(30)
})

const mediumText = computed(() => {
  return 'Medium length text for testing. '.repeat(20)
})
</script>

<style scoped>
@import './panel_styles.css';

/* Test panel specific styles */
.test-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 5px;
}

.test-row {
  border: 1px solid #ddd;
}

.test-cell {
  padding: 10px;
  border: 1px solid #ddd;
}
</style>

