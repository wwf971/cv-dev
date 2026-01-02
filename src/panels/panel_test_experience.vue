<script setup>
// Example project data for testing
const exampleProject1 = {
  title: 'AI Chatbot Development',
  title_en: 'AI Chatbot Development',
  type: '個人プロジェクト',
  people: '開発者1名',
  time: '2023年4月 - 2023年8月',
  place: '自宅',
  techTags: ['Python', 'TensorFlow', 'Flask', 'JavaScript', 'Vue.js'],
  content: [
    '自然言語処理を用いたAIチャットボットの開発を行いました。',
    'ユーザーの質問に適切に応答する対話システムを実装し、機械学習モデルを活用して会話の質を向上させました。',
    'WebインターフェースをVue.jsで作成し、バックエンドAPIをFlaskで構築しました。',
    '約500件の対話データを用いてモデルを学習させ、応答精度を85%まで向上させました。'
  ],
  learnings: [
    '機械学習モデルの実装とチューニングの方法を学びました。',
    '自然言語処理の基本的なアルゴリズムを理解しました。',
    'Webアプリケーションのフルスタック開発を経験しました。',
    'API設計とセキュリティの重要性を学びました。'
  ]
}

const exampleProject2 = {
  title: 'E-commerce Platform',
  title_en: 'E-commerce Platform',
  type: 'チームプロジェクト',
  people: '開発者3名 + デザイナー1名',
  time: '2023年9月 - 2024年3月',
  place: 'オフィス',
  techTags: ['React', 'Node.js', 'MongoDB', 'Express', 'AWS'],
  content: [
    'フル機能のEコマースプラットフォームを開発しました。',
    '商品管理、ショッピングカート、決済処理、在庫管理などの機能を備えています。',
    'ユーザー認証、注文管理、商品検索・フィルタリング機能をReactで実装しました。',
    'バックエンドAPIをNode.jsとExpressで構築し、MongoDBでデータを管理しました。',
    'AWSクラウドサービスを使用して本番環境を構築し、スケーラビリティを確保しました。'
  ],
  learnings: [
    '大規模Webアプリケーションのアーキテクチャ設計を学びました。',
    'クラウドサービスの活用方法を習得しました。',
    'チーム開発におけるGitの効果的な使用方法を学びました。',
    'セキュリティとパフォーマンスの最適化について理解しました。'
  ]
}

const exampleProject3 = {
  title: 'Mobile Health App',
  type: '企業プロジェクト',
  people: '開発チーム5名',
  time: '2024年4月 - 現在',
  place: 'リモート',
  techTags: ['React Native', 'Firebase', 'TypeScript', 'Redux'],
  content: [
    '健康管理を目的としたモバイルアプリケーションを開発しています。',
    '歩数計測、食事記録、体重管理、睡眠分析などの機能を備えています。',
    'React Nativeを使用してiOS/Android両対応のアプリを開発しました。',
    'Firebaseを活用してリアルタイムデータ同期と認証を実装しました。',
    'ユーザー体験を重視した直感的なUI/UXデザインを採用しています。'
  ],
  learnings: [
    'モバイルアプリケーション開発のベストプラクティスを学びました。',
    'クロスプラットフォーム開発の利点と課題を理解しました。',
    'リアルタイムデータ処理の実装方法を習得しました。',
    'ユーザー中心設計の重要性を学びました。'
  ]
}

import { ref, onMounted } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import ProjectJp from '@/content/CvJp/ProjectJp.vue'
import Table from '@/pagination/component/Table.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import { buildProjectComponents } from '@/content/CvJp/ProjectBuilder'
import { PAGE_SIZES } from '@/config.js'
import { LogType } from '@/pagination/LogTypes'
import { createLogger } from './logger'
import TextRow from '@/pagination/component/TextRow.vue'
import TextList from '@/pagination/component/TextList.vue'
import Text from '@/pagination/component/Text.vue'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'Table': Table,
    'VSpace': VSpace,
    'TextRow': TextRow,
    'TextList': TextList,
    'Text': Text
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const logs = ref([])
const currentProjectIndex = ref(0)
const showAllProjects = ref(true)

// Single logger that writes to logs array
const logger = createLogger(logs.value, 'panel_test_experience')

// Available example projects
const exampleProjects = [exampleProject1, exampleProject2, exampleProject3]

// Doc data - initialize with all projects
const docData = ref([])

// Build doc data based on current settings
const buildDocData = () => {
  const components = []

  if (showAllProjects.value) {
    // Add all projects with spacing
    exampleProjects.forEach((project, index) => {
      if (index > 0) {
        // Add spacing between projects
        components.push({
          type: 'VSpace',
          data: { height: 30 }
        })
      }
      // Add the project's internal components directly
      components.push(...buildProjectComponents(project))
    })
  } else {
    // Show single project
    const project = exampleProjects[currentProjectIndex.value]
    components.push(...buildProjectComponents(project))
  }

  docData.value = components
  logger.addLog(`Built doc data with ${components.length} components`, 'panel_test_experience.buildDocData', LogType.Normal)
}

// Initialize on mount
onMounted(() => {
  logger.addLog('Initialized with single project view', 'panel_test_experience.init', LogType.Normal)
  buildDocData()
})

// Toggle between single project and all projects
const toggleViewMode = () => {
  showAllProjects.value = !showAllProjects.value
  buildDocData()
}

// Switch to next project (single project mode)
const nextProject = () => {
  if (showAllProjects.value) return
  currentProjectIndex.value = (currentProjectIndex.value + 1) % exampleProjects.length
  buildDocData()
}

// Switch to previous project (single project mode)
const prevProject = () => {
  if (showAllProjects.value) return
  currentProjectIndex.value = currentProjectIndex.value === 0 ? exampleProjects.length - 1 : currentProjectIndex.value - 1
  buildDocData()
}

// Run pagination test
const runPagination = async () => {
  logger.addLog('Starting pagination test', 'panel_test_experience.runPagination')
  if (paginationRef.value) {
    paginationRef.value.setDocData(docData.value)
    logger.addLog('Set doc data, running pagination', 'panel_test_experience.runPagination')
    await paginationRef.value.runPagination()
    logger.addLog('Pagination completed', 'panel_test_experience.runPagination')

    // Merge pagination logs into display logs
    const paginationLogs = paginationRef.value.getLogs()
    logger.addLog(`Retrieved ${paginationLogs ? paginationLogs.length : 'null'} pagination logs`, 'panel_test_experience.runPagination')
    if (paginationLogs && paginationLogs.length > 0) {
      logs.value = [...logs.value, ...paginationLogs]
      logger.addLog(`Merged ${paginationLogs.length} pagination logs`, 'panel_test_experience.runPagination')
    } else {
      logger.addLog('No pagination logs to merge', 'panel_test_experience.runPagination')
    }
  } else {
    logger.addLog('Pagination ref not available', 'panel_test_experience.runPagination', 'Error')
  }
}

// Clear logs
const clearLogs = () => {
  logs.value = []
}
</script>

<template>
  <PanelTest
    title="Experience Test"
    description="Test data-driven pagination for Japanese project components."
    doc-id="test-experience"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    :logs="logs"
    @run-pagination="runPagination"
    @clear-logs="clearLogs"
  >
    <template #extra-buttons>
      <button @click="toggleViewMode" class="control-button">
        {{ showAllProjects ? 'Show Single Project' : 'Show All Projects' }}
      </button>

      <button @click="prevProject" class="control-button" :disabled="showAllProjects">
        Previous Project
      </button>

      <button @click="nextProject" class="control-button" :disabled="showAllProjects">
        Next Project
      </button>
    </template>

    <template #extra-info>
      <div class="info-row">
        <span>View Mode:</span>
        <span>{{ showAllProjects ? 'All Projects' : `Project ${currentProjectIndex + 1}/${exampleProjects.length}` }}</span>
      </div>
      <div class="info-row">
        <span>Current Project:</span>
        <span>{{ showAllProjects ? 'All' : exampleProjects[currentProjectIndex].title }}</span>
      </div>

      <div class="description" style="margin-top: 20px;">
        <strong>How it works:</strong><br/>
        <strong>Project Components:</strong> Uses Table/VSpace/Text components directly for pagination
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Structure: [Table (Title), Table (Info), Table (Content)] per project</li>
          <li>Can split across pages when content overflows</li>
          <li>Tables split at row boundaries, Text components split internally</li>
          <li>Learnings are individual Text components that can paginate</li>
        </ul>

        <strong>Test Projects:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><strong>AI Chatbot:</strong> Personal project with learnings section</li>
          <li><strong>E-commerce:</strong> Team project with full features</li>
          <li><strong>Health App:</strong> Enterprise project (no learnings section)</li>
        </ul>

        <strong>Controls:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>"Show All Projects" - Test multiple projects with spacing</li>
          <li>"Previous/Next Project" - Cycle through individual projects</li>
          <li>"Run Pagination" - Test page splitting and layout</li>
        </ul>
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-experience-original">
          <component
            v-for="(comp, idx) in docData"
            :key="idx"
            :is="getComponent(comp.type)"
            v-bind="comp.data"
          />
        </Doc>
      </div>
    </template>

    <template #content>
      <PaginationWrapper
        ref="paginationRef"
        docId="test-experience"
        :pageHeight="PAGE_SIZES.pageHeight"
        :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
      />
    </template>
  </PanelTest>
</template>
