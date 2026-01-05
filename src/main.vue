<template>
  <!-- Print Preview Mode (at root level, outside MasterDetail) -->
  <PrintWrapper 
    v-if="printPreviewActive && printPreviewData"
    :pages="printPreviewData.pages"
    :docData="printPreviewData.docData"
    :pageWidth="printPreviewData.pageWidth"
    @back="exitPrintPreview"
  />
  
  <!-- Normal UI Mode -->
  <MasterDetail v-else title="CV Generator" sidebarWidth="200px">
    <Tab label="Basic Components">
      <SubTab label="Table Cross-Page">
        <Panel>
          <PanelTestTable />
        </Panel>
      </SubTab>
      <SubTab label="Text Cross-Page">
        <Panel>
          <PanelTestText />
        </Panel>
      </SubTab>
      <SubTab label="TextList,vue Paignation Test">
        <Panel>
          <PanelTestTextList />
        </Panel>
      </SubTab>
      <SubTab label="TextRow.vue Pagination Test">
        <Panel>
          <PanelTestTextRow />
        </Panel>
      </SubTab>
      <SubTab label="Table/Tr/Td Pagination Test">
        <Panel>
          <PanelTestTableTrTd />
        </Panel>
      </SubTab>
      <SubTab label="Image/ImageRow Pagination Test">
        <Panel>
          <PanelTestImageRow />
        </Panel>
      </SubTab>
    </Tab>

    <Tab label="CV-Japanese style">
      <SubTab label="CV-JP">
        <Panel>
          <PanelTestCvJp />
        </Panel>
      </SubTab>
      <SubTab label="CV-JP-Experience">
        <Panel>
          <PanelTestExperience />
        </Panel>
      </SubTab>

    </Tab>

    <Tab label="Old Pagination System">
      <SubTab label="Pagination-old">
        <Panel>
          <PanelPagination1 />
        </Panel>
      </SubTab>
      
      <SubTab label="Pagination-new">
        <Panel>
          <PanelPagination2 />
        </Panel>
      </SubTab>
    </Tab>

    <Tab label="Settings">
      <SubTab label="SQL Server" :isDefault="true">
        <Panel>
          <PanelServer />
        </Panel>
      </SubTab>
      <SubTab label="MongoDB Server">
        <Panel>
          <PanelServerMongo />
        </Panel>
      </SubTab>
    </Tab>
  </MasterDetail>
</template>

<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import MasterDetail from '@wwf971/vue-comp-misc/src/layout/MasterDetail.vue'
import { Tab, SubTab, Panel } from '@wwf971/vue-comp-misc/src/layout/MasterDetailSlots'
import Content from '@/content/content.vue'
import PanelPagination1 from '@/panels/panel_pagination_1.vue'
import PanelPagination2 from '@/panels/panel_pagination_2.vue'
import PanelTestTable from '@/panels/panel_test_table.vue'
import PanelTestText from '@/panels/panel_test_text.vue'
import PanelTestTextList from '@/panels/panel_test_text_list.vue'
import PanelTestTableTrTd from '@/panels/panel_test_table_tr_td.vue'
import PanelTestCvJp from '@/panels/panel_test_cv_jp.vue'
import PanelTestExperience from '@/panels/panel_test_experience.vue'
import PanelTestTextRow from '@/panels/panel_test_text_row.vue'
import PanelTestImageRow from '@/panels/panel_test_image_row.vue'
import PanelServer from '@/remote/panel_server.vue'
import PanelServerMongo from '@/remote/panel_server_mongo.vue'
import PrintWrapper from '@/panels/PrintWrapper.vue'
import { useInfoStore } from '@/content/info.js'

// Use the Pinia store
const infoStore = useInfoStore()

// Print preview state
const printPreviewActive = ref(false)
const printPreviewData = ref<any>(null)

// Print preview API for descendant components
const enterPrintPreview = (data: any) => {
  printPreviewData.value = data
  printPreviewActive.value = true
  console.log('[main] Entering print preview mode')
}

const exitPrintPreview = () => {
  printPreviewActive.value = false
  printPreviewData.value = null
  console.log('[main] Exiting print preview mode')
}

// Provide print preview API to all descendant components
provide('printPreview', {
  enter: enterPrintPreview,
  exit: exitPrintPreview,
  isActive: printPreviewActive
})

// Lifecycle hooks
onMounted(async () => {
  console.log("before login")
  await infoStore.login()
  console.log("after login")
})
</script>

<style>
/* Global styles remain here */
[v-cloak] {
  display: none;
}
</style>
