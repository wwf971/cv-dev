<template>
<div class="font-cv">
    <table class="form-table">
      <tbody>
        <!-- Header row -->
        <tr class="header-row">
            <td class="date-column-header">年</td>
            <td class="date-column-header">月</td>
            <td colspan="2" class="word-spacing-0p5" style="word-spacing: 0.5em;">学 歴・職 歴</td>
            <!-- <td colspan="1" class="section-divider word-spacing-0p5 no-left-border"></td> -->
        </tr>
        
        <!-- Education section header -->
        <tr class="section-divider-row">
            <td colspan="2" class="section-divider no-right-border"></td>
            <td colspan="2" class="section-divider word-spacing-0p5 no-left-border">学 歴</td>
            <!-- <td colspan="1" class="section-divider word-spacing-0p5 no-left-border"></td> -->
        </tr>
        
        <!-- Education entries -->
        <tr v-for="(education, index) in educationEntries" :key="`education-${index}`" class="entry-row">
            <td class="time-cell">
                <!-- {{ education.year }} -->
                <span class="main-date"><div v-if="education.year_jp" class="year-jp">{{ education.year_jp }}</div>{{ education.year }}</span>
            </td>
            <td class="time-cell">{{ education.month }}</td>
            <td colspan="2" class="form-cell value-cell align-left" v-html="education.value"></td>
            <!-- <td class="form-cell no-left-border"></td> -->
        </tr>
        
        <!-- Work history section header -->
        <tr class="section-divider-row">
            <td colspan="2" class="section-divider no-right-border"></td>
            <td colspan="1" class="section-divider word-spacing-0p5 no-left-border">職 歴</td>
            <td colspan="1" class="section-divider word-spacing-0p5 no-left-border">備 考</td>
        </tr>
        
        <!-- Work history entries -->
        <tr v-for="(work, index) in workEntries" :key="`work-${index}`" class="entry-row">
            <td class="time-cell">
                <!-- {{ work.year }} -->
                <span class="main-date"><div v-if="work.year_jp" class="year-jp">{{ work.year_jp }}</div>{{ work.year }}</span>
            </td>
            <td class="time-cell">{{ work.month }}</td>
            <td class="form-cell value-cell align-left" v-html="work.value"></td>
            <td class="form-cell value-cell no-left-border align-center" v-html="work.note"></td>
        </tr>
        
        <!-- End marker -->
        <!-- <tr class="entry-row">
            <td class="time-cell"></td>
            <td class="time-cell"></td>
            <td class="value-cell end-marker">以上</td>
        </tr> -->
    <!-- </table>
    <table class="form-table" style="margin-top: 20px;"> -->
        <tr class="empty-row" style="height: 15px !important;"> <!-- empty row -->
            <td colspan="4" class="word-spacing-0p5 no-hori-border"></td>
        </tr>
        <!-- Header row -->
        <tr class="header-row">
            <td class="section-divider date-column-header">年</td>
            <td class="section-divider date-column-header">月</td>
            <td class="section-divider word-spacing-0p5" style="word-spacing: 0.5em;">免 許・資 格</td>
            <td class="section-divider word-spacing-0p5 no-left-border">備 考</td>
        </tr>

        <!-- License entries -->
        <tr v-for="(license, index) in licenseEntries" :key="`license-${index}`" class="entry-row">
            <td class="time-cell">
                <!-- {{ license.year }} -->
                <span class="main-date"><div v-if="license.year_jp" class="year-jp">{{ license.year_jp }}</div>{{ license.year }}</span>
            </td>
            <td class="time-cell">{{ license.month }}</td>
            <td class="form-cell value-cell align-left" v-html="license.value"></td>
            <td class="form-cell value-cell no-left-border align-center" v-html="license.note"></td>
        </tr>
      </tbody>
    </table>
</div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineOptions({ // define component name
    name: 'EducationAndWorkJP'
})

const props = defineProps({
    info: {
        type: Function,
        required: true
    }
})

// Import private data from config.js (which loads from config.0.js if available)
import { educationEntries as importedEducationEntries, workEntries as importedWorkEntries, licenseEntries as importedLicenseEntries } from '../config.js'

const educationEntries = ref(importedEducationEntries)
const workEntries = ref(importedWorkEntries)
const licenseEntries = ref(importedLicenseEntries)

// Calculate empty rows needed to fill the table (minimum 8 total rows for content)
const totalContentRows = computed(() => {
    return 2 + educationEntries.value.length + workEntries.value.length + 1 // +2 for section headers, +1 for "以上"
})
</script>

<style scoped>
@import './CvJp/styles-shared.css';

.section-education-work-jp {
    margin-bottom: 20px;
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

.end-marker {
    text-align: right;
    padding-right: 20px;
}

.empty-row {
    height: 35px;
}

/* Ensure consistent cell heights */
.education-work-table td {
    vertical-align: middle;
    box-sizing: border-box;
}
</style>
