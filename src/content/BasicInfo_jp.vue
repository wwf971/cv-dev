<template>
<div class="section-basic-info-jp font-cv">
    <!-- Header section with title and current date -->
    <div class="header-top" style="display:flex; flex-direction: column;">
        <div class="cv-title">履 歴 書</div>
        <div class="section-1" style="display:flex; flex-direction: row;">

            <div class="form-section" style="position: relative; flex: 1; margin-right: 10px;">
                <div class="current-date">
                    <span class="date-label">2025年07月20日現在</span>
                </div>
                <!-- Name section -->
                <table class="form-table">
                  <tbody>
                    <tr style="height: 15px !important;">
                        <td class="form-cell key-cell">ふりがな</td>
                        <td class="form-cell value-cell name-furigana align-center no-right-border">やまだ</td>
                        <td class="form-cell value-cell name-furigana align-center no-hori-border">たろう</td>
                        <td class="form-cell no-left-border"></td>
                    </tr>
                    <tr>
                        <!-- <td class="form-cell key-cell" tracking-extra-wide>氏名</td> -->
                        <td class="form-cell key-cell" style="word-spacing: 1.2em;">氏 名</td>
                        <td class="form-cell value-cell name-kanji align-center no-right-border">{{ info("name/last/en/upper") }}</td>
                        <td class="form-cell value-cell name-kanji align-center no-hori-border">{{ info("name/first/en/upper") }}</td>
                        <td class="form-cell no-left-border" style="width: 300px !important;"></td>
                            <!-- 必须关闭table-layout: fixed; 否则width: xxx px;无效 -->
                    </tr>
                  </tbody>
                </table>
                <table class="form-table no-top-border">
                  <tbody>
                    <tr>
                        <td class="form-cell key-cell">生年月日</td>
                        <td colspan="2" class="form-cell value-cell align-left">
                            <div style="display: flex; flex-direction: row; align-items: flex-end; padding-left: 4px;">
                                <span class="main-date"><div class="year-jp">平成7</div>1995年</span>
                                <span class="main-date">01月01日</span>
                                <span class="main-date" style="margin-left: auto;">（満30歳）</span>
                            </div>
                        </td>
                        <td class="form-cell no-left-border align-center">
                            <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
                                <div style="justify-self: flex-start;">※</div>
                                <div><span class="gender-option selected">男</span>·<span class="gender-option">女</span></div>
                                <div></div>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td class="form-cell key-cell">住所</td>
                        <td colspan="3" class="form-cell value-cell align-left">
                            <div style="padding-left: 4px;">
                                <div class="address-text">〒100-0001</div>
                                <div>東京都千代田区千代田1-1-1サンプルビル101</div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="form-cell key-cell">メール<br>アドレス</td>
                        <td class="form-cell value-cell">{{info("email/example")}}</td>
                        <td class="form-cell key-cell">電話番号</td>
                        <td class="form-cell value-cell">090-1234-5678</td>
                    </tr>
                  </tbody>
                </table>
            </div>

            <div class="photo-section">
                <div v-if="!photoData" class="photo-placeholder">
                    <div class="photo-text">写真をはる位置</div>
                    <div class="photo-instructions">
                        <div>写真をはる必要がある場合</div>
                        <span style="display:flex">1.<div><div>縦</div><div>横</div></div></span>
                        <span>2.本人単身胸から上</span>
                        <span>3.裏面のりづけ</span>
                    </div>
                </div>
                <div v-if="photoData" class="photo-base64">
                    <img 
                        :src="photoData" 
                        alt="Profile Photo"
                        class="photo-image"
                        @load="onImageLoad"
                        @error="onImageError"
                    />
                </div>
            </div>
        </div>
</div>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Define component name
defineOptions({
name: 'BasicInfoJP'
})

const props = defineProps({})

import { useInfoStore } from '@/content/info.js'
const infoStore = useInfoStore()
import { storeToRefs } from 'pinia'
const { infoCache, infoCacheState, infoCacheMessage} = storeToRefs(infoStore)

// Reactive data for photo
const photoData = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)



// Watch for changes in photo data
const loadPhotoData = () => {
    const photo = infoCache.value[photo_query]
    if (photo && typeof photo === 'string' && photo.trim() !== '') {
        // Ensure the base64 string has proper format
        if (photo.startsWith('data:image/') || photo.startsWith('/9j/') || photo.startsWith('iVBORw0KGgo')) {
            photoData.value = photo.startsWith('data:image/') ? photo : `data:image/jpeg;base64,${photo}`
            imageError.value = false
        } else {
            console.warn('Invalid photo data format')
            imageError.value = true
        }
    } else {
        photoData.value = null
    }
}

// Image event handlers
const onImageLoad = () => {
    imageLoaded.value = true
    imageError.value = false
}

const onImageError = () => {
    imageLoaded.value = false
    imageError.value = true
    photoData.value = null
}

const info = infoStore.info;

// Load photo data on mount and watch for changes
onMounted(() => {
    try {
        infoStore.info(
            "photo/example",
            false // false
        )
    } catch (error) {
        console.error('BasicInfoJP: infoStore.info error:', error)
    }
})

const photo_query = "photo/example"

// Watch for changes in the info function result
import { watch } from 'vue'
watch(() => infoCacheState.value[photo_query], (newVal) => {
    if (newVal === "ready") {
        loadPhotoData()
    } else {
        photoData.value = null
    }
}, { immediate: true })
</script>

<style scoped>
@import '../styles-shared.css';

.cv-header-jp {
background: white;
}

.header-top {
display: flex;
justify-content: space-between;
align-items: flex-start;
position: relative;
}

.cv-title {
font-size: 28px;
font-weight: 500;
color: #000;
margin-left: 3px;
margin-bottom: 2px;
word-spacing: 15px; /* space between characters */
}

.current-date {
position: absolute;
bottom: calc(100% + 2px);
right: 0px;
font-size: 14px;
padding-right: 5px;
}

.photo-section {
width: 150px;
height: 200px;
border: 1px solid #000;
position: relative;
overflow: hidden;
}

.photo-placeholder {
width: 100%;
height: 100%;
border: 1px dashed #666;
display: flex;
flex-direction: column;
justify-content: center;
align-items: center;
font-size: 10px;
color: #666;
padding: 5px;
box-sizing: border-box;
}

.photo-base64 {
width: 100%;
height: 100%;
position: relative;
overflow: hidden;
}

.photo-image {
width: 100%;
height: 100%;
object-fit: cover;
object-position: center;
display: block;
}

.photo-text {
font-size: 12px;
margin-bottom: 10px;
text-align: center;
}

.photo-instructions {
font-size: 8px;
line-height: 1.2;
text-align: left;
}

.form-section {
display: flex;
flex-direction: column;
}

.main-date {}



.furigana {
font-size: 12px;
color: #666;
}

.name-kanji {
font-size: 16px;
font-weight: 500;
}

.section-1 {
position: relative;
width: 100%;
}

.address-text {
font-size: 12px;
margin-bottom: -3px;
margin-top: 2px;
}


.name-furigana {
font-size: 12px;
/* color: #666; */
}

.family-name {
/* width: 80px; */
}

.first-name {
/* Takes remaining space */
}

/* Date container styles */
.date-container {
position: relative;
display: inline-block;
}


/* Gender option styles */
.gender-option {
display: inline-block;
padding: 2px 6px;
border-radius: 50%;
border: 1px solid transparent;
transition: all 0.2s ease;
}

.gender-option.selected {
border-color: #000;
}
</style> 