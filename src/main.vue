<template>
  <MasterDetail title="CV Generator" sidebarWidth="200px" class="print:hidden">
    <Tab label="CV Content">
      <SubTab label="CV Content" :isDefault="true">
        <Panel>
          <Content :paginationMode="0" />
        </Panel>
      </SubTab>
    </Tab>

    <Tab label="Test">
      <SubTab label="BasicInfoJp">
        <Panel>
          <PanelTestCvJp />
        </Panel>
      </SubTab>
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
      <SubTab label="TextList Cross-Page">
        <Panel>
          <PanelTestTextList />
        </Panel>
      </SubTab>
      <SubTab label="Table Tr/Td Cross-Page">
        <Panel>
          <PanelTestTableTrTd />
        </Panel>
      </SubTab>
    </Tab>

    <Tab label="Export">
      <SubTab label="Pagination 1">
        <Panel>
          <PanelPagination1 />
        </Panel>
      </SubTab>
      
      <SubTab label="Pagination 2">
        <Panel>
          <PanelPagination2 />
        </Panel>
      </SubTab>
    </Tab>

    <Tab label="Settings">
      <SubTab label="Server Config" :isDefault="true">
        <Panel>
          <PanelServer />
        </Panel>
      </SubTab>
    </Tab>
  </MasterDetail>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
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
import PanelServer from '@/remote/panel_server.vue'
import { useInfoStore } from '@/content/info.js'

// Use the Pinia store
const infoStore = useInfoStore()

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
