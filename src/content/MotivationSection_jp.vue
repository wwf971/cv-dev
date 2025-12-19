<template>
<div class="font-cv">
    <table class="form-table" style="margin-top: 25px;">
        <tbody>
            <!-- Header row -->
            <tr class="header-row">
                <td colspan="4" class="word-spacing-0p5">志 望 の 動 機</td>
            </tr>
            <!-- Content area -->
            <TrCrossPage trClass="content-row no-top-border">
                <!-- <TdCrossPage colspan="4" tdClass="motivation-content" :vText="motivationText_render"> -->
                <TdCrossPage colspan="4" tdClass="motivation-content" :vText="motivationText_render">
                </TdCrossPage>
            </TrCrossPage>
            <TrCrossPage trClass="content-row no-top-border">
                <TdCrossPage colspan="1" tdClass="key-cell form-cell" :vText="'趣 味'"></TdCrossPage>
                <TdCrossPage colspan="3" tdClass="motivation-content" :vText="interest">

                </TdCrossPage>
            </TrCrossPage>
        </tbody>
    </table>
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import TrCrossPage from '@/pagination/component_old/TrCrossPage.vue'
import TdCrossPage from '@/pagination/component_old/TdCrossPage.vue'

// Import private data from config.js (which loads from config.0.js if available)
import { interest, url_motivation_text } from '../config.js'

// Define component name
defineOptions({
    name: 'MotivationSectionJP'
})

const props = defineProps({})

import { useInfoStore } from '@/content/info.js'
import { storeToRefs } from 'pinia'
const infoStore = useInfoStore()
const { infoCache, infoCacheState, infoCacheMessage } = storeToRefs(infoStore)

const url_motication_text = url_motivation_text

const motivationText = computed(() => {
    const state = infoCacheState.value[url_motication_text];
    if(state === "ready"){
        const cacheData = infoCache.value[url_motication_text].text
        // Extract the actual text content from the data property
        if (cacheData && typeof cacheData === 'object' && cacheData.data) {
            return cacheData.data
        }
        return cacheData || 'No content available'
    }else if(state === "error"){
        return infoCacheMessage.value[url_motication_text]
    }else{
        return 'Loading...'
    }
})

const motivationText_render = ref('')
watch(motivationText, (newVal) => {
    motivationText_render.value = newVal
})


onMounted(() => {
    infoStore.info(url_motication_text, false)
})

// Calculate empty rows needed to fill the table
</script>

<style scoped>
@import '../styles-shared.css';

.content-row {
    height: auto;
    min-height: 200px;
}

.motivation-content {
    border: 1px solid #000;
    padding: 12px;
    vertical-align: top;
    text-align: left;
}

.motivation-text {
    line-height: 1.8;
    font-size: 14px;
    white-space: pre-line;
    word-wrap: break-word;
}

.empty-row {
    height: 35px;
}

.empty-row td {
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
}

/* Ensure consistent cell heights */
.form-table td {
    vertical-align: middle;
    box-sizing: border-box;
}

.motivation-content {
    vertical-align: top;
}
</style> 