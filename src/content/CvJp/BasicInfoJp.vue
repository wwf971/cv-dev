<template>
<div ref="basicInfoRef" class="section-basic-info-jp font-cv">
	<!-- Header section with title and current date -->
	<div class="header-top" style="display:flex; flex-direction: column;">
		<div class="cv-title">履 歴 書</div>
		<div class="section-1" style="display:flex; flex-direction: row;">

			<div class="form-section" style="position: relative; flex: 1; margin-right: 10px;">
				<div class="current-date">
					<span class="date-label">{{ displayData.currentDate }}</span>
				</div>
				<!-- Name section -->
				<table class="form-table">
				  <tbody>
					<tr style="height: 15px !important;">
						<td class="form-cell key-cell" style="width: 115px;">ふりがな</td>
						<td class="form-cell value-cell name-furigana align-center no-right-border">{{ displayData.nameFuriganaLast }}</td>
						<td class="form-cell value-cell name-furigana align-center no-hori-border">{{ displayData.nameFuriganaFirst }}</td>
						<td class="form-cell no-left-border"></td>
					</tr>
					<tr>
						<td class="form-cell key-cell" style="width: 115px; word-spacing: 1.2em;">氏 名</td>
						<td class="form-cell value-cell name-kanji align-center no-right-border">{{ displayData.nameKanjiLast }}</td>
						<td class="form-cell value-cell name-kanji align-center no-hori-border">{{ displayData.nameKanjiFirst }}</td>
						<td class="form-cell no-left-border"></td>
					</tr>
				  </tbody>
				</table>
				<table class="form-table no-top-border">
				  <tbody>
					<tr>
						<td class="form-cell key-cell" style="width: 115px;">生年月日</td>
						<td colspan="2" class="form-cell value-cell align-left">
							<div style="display: flex; flex-direction: row; align-items: flex-end; padding-left: 4px;">
								<span class="main-date"><div class="year-jp">{{ displayData.birthYearJp }}</div>{{ displayData.birthYear }}年</span>
								<span class="main-date">{{ displayData.birthMonthDay }}</span>
								<span class="main-date" style="margin-left: auto;">（満{{ displayData.age }}歳）</span>
							</div>
						</td>
						<td class="form-cell no-left-border align-center">
							<div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
								<div style="justify-self: flex-start;">※</div>
								<div>
								  <span class="gender-option" :class="{ selected: displayData.gender === 'male' }">男</span>·<span class="gender-option" :class="{ selected: displayData.gender === 'female' }">女</span>
								</div>
								<div></div>
							</div>
						</td>
					</tr>

					<tr>
						<td class="form-cell key-cell" style="width: 115px;">住所</td>
						<td colspan="3" class="form-cell value-cell align-left">
							<div style="padding-left: 4px;">
								<div class="address-text">{{ displayData.postalCode }}</div>
								<div>{{ displayData.address }}</div>
							</div>
						</td>
					</tr>
					<tr>
						<td class="form-cell key-cell" style="width: 115px;">メール<br>アドレス</td>
						<td class="form-cell value-cell">{{ displayData.email }}</td>
						<td class="form-cell key-cell" style="width: 115px;">電話番号</td>
						<td class="form-cell value-cell">{{ displayData.phone }}</td>
					</tr>
				  </tbody>
				</table>
			</div>

			<div class="photo-section">
				<div v-if="!displayData.photoData" class="photo-placeholder">
					<div class="photo-text">写真をはる位置</div>
					<div class="photo-instructions">
						<div>写真をはる必要がある場合</div>
						<span style="display:flex">1.<div><div>縦</div><div>横</div></div></span>
						<span>2.本人単身胸から上</span>
						<span>3.裏面のりづけ</span>
					</div>
				</div>
				<div v-if="displayData.photoData && displayData.photoData !== ''" class="photo-base64">
					<img 
						:src="displayData.photoData" 
						alt="Profile Photo"
						class="photo-image"
					/>
				</div>
			</div>
		</div>
</div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'

const props = defineProps({
  currentDate: String,
  nameFuriganaLast: String,
  nameFuriganaFirst: String,
  nameKanjiLast: String,
  nameKanjiFirst: String,
  birthYearJp: String,
  birthYear: String,
  birthMonth: Number,
  birthDay: Number,
  birthMonthDay: String,
  age: Number,
  gender: String,
  postalCode: String,
  address: String,
  email: String,
  phone: String,
  photoData: String
})

const basicInfoRef = ref<HTMLElement | null>(null)
const logger = inject('paginationLogger', null) as any

// Example data defined internally
const exampleData = {
  currentDate: '2025年07月20日現在',
  nameFuriganaLast: 'やまだ',
  nameFuriganaFirst: 'たろう',
  nameKanjiLast: '山田',
  nameKanjiFirst: '太郎',
  birthYearJp: '平成2',
  birthYear: '1990',
  birthMonth: 12,
  birthDay: 31,
  birthMonthDay: '12月31日',
  age: 34,
  gender: 'male',
  postalCode: '〒100-0001',
  address: '東京都千代田区千代田1-1-1サンプルビル101',
  email: 'example@example.com',
  phone: '090-1234-5678',
  photoData: null
}

// Use props if provided, otherwise use example data
const displayData = computed(() => {
  // Filter out undefined props
  const definedProps = Object.keys(props).reduce((acc, key) => {
	const value = props[key]
	if (value !== undefined) {
	  acc[key] = value
	}
	return acc
  }, {})
  
  const hasAnyProps = Object.keys(definedProps).length > 0
  
  if (hasAnyProps) {
	return {
	  ...exampleData,
	  ...definedProps
	}
  }
  return exampleData
})

// trySplit implementation - returns code 2 (not splittable)
const trySplit = (pageContext: any, docContext: any) => {
  if (!basicInfoRef.value || !docContext || !pageContext) {
	if (logger) {
	  const reason = !basicInfoRef.value ? 'basicInfoRef is null' : !docContext ? 'docContext param is null' : 'pageContext param is null'
	  logger.addLog(`Error: Cannot split - ${reason}`, 'BasicInfoJp.trySplit', 1)
	}
	return {
	  code: -1,
	  data: null
	}
  }

  const componentBottom = docContext.measureVerticalPosEnd(basicInfoRef.value)
  const pageBottomY = pageContext.pageBottomY
  
  if (logger) {
	logger.addLog(`BasicInfoJp bottom: ${componentBottom.toFixed(2)}, Page bottom: ${pageBottomY.toFixed(2)}`, 'BasicInfoJp.trySplit')
  }
  
  // If it fits, return code 0
  if (componentBottom <= pageBottomY) {
	if (logger) {
	  logger.addLog(`BasicInfoJp fits in page`, 'BasicInfoJp.trySplit')
	}
	return {
	  code: 0,
	  data: null
	}
  }
  
  // If it doesn't fit, return code 2 (not splittable)
  if (logger) {
	logger.addLog(`BasicInfoJp doesn't fit and is not splittable (code: 2)`, 'BasicInfoJp.trySplit', 1)
  }
  
  // Check if any props are provided (not using example data)
  const hasAnyProps = Object.keys(props).some(key => props[key as keyof typeof props] !== undefined)
  
  // If no props provided (using example data), return component with example data filled in
  if (!hasAnyProps) {
	return {
	  code: 2,
	  data: {
		type: 'BasicInfoJp',
		data: exampleData
	  }
	}
  }
  
  return {
	code: 2,
	data: null
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
@import './styles-shared.css';

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

.furigana {
font-size: 12px;
color: #666;
}

.name-kanji {
font-size: 16px;
font-weight: 500;
white-space: nowrap;
width: 1px;
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
white-space: nowrap;
width: 1px;
}

.date-container {
position: relative;
display: inline-block;
}

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
