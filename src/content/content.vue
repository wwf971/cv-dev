<template>
  <div class="page_a4_width">
    <!-- Demo AlignToPageBegin component (only show when pagination 2 is active) -->
    <AlignToPageBegin v-if="paginationMode === 2" :showDebugInfo="true" />

    <BasicInfoJP :info="info" />
    <!-- Education and Work Section -->
    <EducationAndWorkJP :info="info" />
    <MotivationSectionJP :info="info" />
    
    <AlignToNextPageBegin :showDebugInfo="true" />
    <div class="font-cv" style="font-size: 20px; font-weight: bold; text-align: center; margin-top: 25px;">プロジェクト経験</div>
    <ProjectJP :url="'project/semantic-motion-jp'" />
    
    <VSkip :height="25" :showDebugInfo="true" />
    <ProjectJP :url="'project/dimension-robotics'" />
    
    <VSkip :height="25" :showDebugInfo="true" />
    <ProjectJP :url="'project/music-haptic/jp'" />
    
    <VSkip :height="25" :showDebugInfo="true" />
    <ProjectJP :url="'project/mu-jp'" />
    
    <VSkip :height="25" :showDebugInfo="true" />
    <ProjectJP :url="'project/mocap-vis'" />
    
    <VSkip :height="25" :showDebugInfo="true" />
    <ProjectJP :url="'project/tab-manager'" />
  </div>

  <div style="height: 200px; border: 1px solid red;" class="no-render"></div>
</template>

<script setup lang="ts">
import BasicInfoJP from './BasicInfo_jp.vue'
import EducationAndWorkJP from './EducationAndWork_jp.vue'
import MotivationSectionJP from './MotivationSection_jp.vue'
import VSkip from '@/pagination/VSkip.vue'
import AlignToPageBegin from '@/pagination/AlignToPageBegin.vue'
import AlignToNextPageBegin from '@/pagination/AlignToNextPageBegin.vue'
import ProjectJP from './Project_jp.vue'
import { useInfoStore } from '@/content/info.js'

// Props
const props = defineProps<{
  paginationMode?: number
}>()

// Use the Pinia store
const infoStore = useInfoStore()
const { info } = infoStore
</script>

