<script setup>
// Test data for TextRow component - lots of content to trigger pagination
const textRowTestData = [
  // Row 1: Mix of splittable and non-splittable items
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Non-splittable short item',
            cssClass: 'text-style-1',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'This is a very long splittable text that should definitely need to be split across pages when it reaches the end of the available space on the current page. It contains enough content to trigger pagination behavior.',
            cssClass: 'text-style-2',
            noSplit: false
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Another long text item that will also need splitting. This demonstrates how the TextRow component handles multiple splittable items and determines where to break them across page boundaries.',
            cssClass: 'text-style-3',
            noSplit: false
          }
        }
      ]
    }
  },

  // Row 2: Tech stack with many items
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Technologies Used:',
            cssClass: 'text-label',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'React',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'TypeScript',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Node.js',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'MongoDB',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Express',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Docker',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'AWS',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Kubernetes',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'GraphQL',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Redis',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'PostgreSQL',
            cssClass: 'tech-tag',
            noSplit: true
          }
        }
      ]
    }
  },

  // Row 3: Very long splittable content
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'This is an extremely long paragraph that demonstrates how the TextRow component handles very long content that needs to be split multiple times across several pages. The pagination algorithm should be able to break this text at appropriate points while maintaining readability and proper text flow. It\'s important that the splitting preserves word boundaries and doesn\'t cut words in half, which would make the text difficult to read and understand.',
            cssClass: 'text-style-long',
            noSplit: false
          }
        }
      ]
    }
  },

  // Row 4: Multiple short non-splittable items
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Item A',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item B',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item C',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item D',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item E',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item F',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item G',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item H',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item I',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item J',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item K',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item L',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item M',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item N',
            cssClass: 'text-short',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Item O',
            cssClass: 'text-short',
            noSplit: true
          }
        }
      ]
    }
  },

  // Row 5: Mixed content with various lengths
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Short',
            cssClass: 'text-mixed-1',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'This medium length text need careful placement near page boundaries.',
            cssClass: 'text-mixed-2',
            noSplit: false
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Long',
            cssClass: 'text-mixed-3',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'This is another piece of content that contains sufficient length to potentially cause pagination issues when combined with other elements on the page. The goal is to create realistic test scenarios that demonstrate how the pagination system handles various text lengths and splitting requirements.',
            cssClass: 'text-mixed-4',
            noSplit: false
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Final',
            cssClass: 'text-mixed-5',
            noSplit: true
          }
        }
      ]
    }
  },

  // Row 6: More tech tags to test wrapping
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Additional Skills:',
            cssClass: 'text-label',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Python',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Java',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'C++',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Go',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Rust',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Swift',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Kotlin',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Scala',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'PHP',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Ruby',
            cssClass: 'tech-tag',
            noSplit: true
          }
        },
        {
          type: 'Text',
          data: {
            content: 'Perl',
            cssClass: 'tech-tag',
            noSplit: true
          }
        }
      ]
    }
  }
]

import { ref, onMounted } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import TextRow from '@/pagination/component/TextRow.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import { PAGE_SIZES } from '@/config.js'
import { LogType } from '@/pagination/LogTypes'
import { createLogger } from './logger'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'TextRow': TextRow,
    'VSpace': VSpace
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const logs = ref([])

// Single logger that writes to logs array
const logger = createLogger(logs.value, 'panel_test_text_row')

// Doc data - moderate VSpace at top, then TextRow test data
const docData = ref([
  // Moderate VSpace to allow some content at top but test pagination
  {
    type: 'VSpace',
    data: { height: 850 }  // Moderate space
  },
  // TextRow test data with lots of content
  ...textRowTestData
])

// Initialize on mount
onMounted(() => {
  logger.addLog('Initialized TextRow test with large top spacing', 'panel_test_text_row.init', LogType.Normal)
})

// Run pagination test
const runPagination = async () => {
  logger.addLog('Starting pagination test', 'panel_test_text_row.runPagination')
  if (paginationRef.value) {
    paginationRef.value.setDocData(docData.value)
    logger.addLog('Set doc data, running pagination', 'panel_test_text_row.runPagination')
    await paginationRef.value.runPagination()
    logger.addLog('Pagination completed', 'panel_test_text_row.runPagination')

    // Merge pagination logs into display logs
    const paginationLogs = paginationRef.value.getLogs()
    logger.addLog(`Pagination returned ${paginationLogs ? paginationLogs.length : 'null'} logs`, 'panel_test_text_row.runPagination')
    if (paginationLogs && paginationLogs.length > 0) {
      logs.value = [...logs.value, ...paginationLogs]
      logger.addLog(`Merged ${paginationLogs.length} pagination logs`, 'panel_test_text_row.runPagination')
    } else {
      logger.addLog('No pagination logs to merge', 'panel_test_text_row.runPagination')
    }
  } else {
    logger.addLog('Pagination ref not available', 'panel_test_text_row.runPagination', 'Error')
  }
}

// Clear logs
const clearLogs = () => {
  logs.value = []
}
</script>

<template>
  <PanelTest
    title="TextRow Test"
    description="Test TextRow component with multiple text items and pagination splitting."
    doc-id="test-text-row"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    :logs="logs"
    @run-pagination="runPagination"
    @clear-logs="clearLogs"
  >
    <template #extra-info>
      <div class="info-row">
        <span>Test Structure:</span>
        <span>Large VSpace → TextRow → Individual Text components</span>
      </div>

      <div class="description" style="margin-top: 20px;">
        <strong>How it works:</strong><br/>
        <strong>TextRow Component:</strong> Contains multiple text items in a row
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Tries to fit items one by one on the current page</li>
          <li>If an item doesn't fit, can split it (if splittable) or move remaining items to next page</li>
          <li>Uses flexbox layout with wrapping</li>
        </ul>

        <strong>Test Data:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><strong>Row 1:</strong> Mixed splittable/non-splittable with long text</li>
          <li><strong>Row 2:</strong> Tech stack (12 items) - tests wrapping</li>
          <li><strong>Row 3:</strong> Very long paragraph - tests text splitting</li>
          <li><strong>Row 4:</strong> 15 short non-splittable items - tests item-by-item placement</li>
          <li><strong>Row 5:</strong> Mixed lengths with various split behaviors</li>
          <li><strong>Row 6:</strong> More tech tags (12 items) - tests extensive wrapping</li>
        </ul>

        <strong>Large VSpace:</strong> Pushes content near page end to test pagination behavior

        <strong>How to Use:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>1. Click "Run Pagination" to process content</li>
          <li>2. Switch to "Paginated" tab to see split results</li>
          <li>3. Check "Logs" tab for TextRow.trySplit() logs</li>
        </ul>

        <strong>Note:</strong> TextRow pagination logs only appear in the "Logs" tab after running pagination on the "Paginated" tab.
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-text-row-original">
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
        docId="test-text-row"
        :pageHeight="PAGE_SIZES.pageHeight"
        :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
      />
    </template>
  </PanelTest>
</template>

<style>
/* Test styles for different text elements */
.text-style-1 {
  color: #e74c3c;
  font-weight: bold;
  font-size: 16px;
}

.text-style-2 {
  color: #27ae60;
  font-style: italic;
  font-size: 14px;
}

.text-style-3 {
  color: #3498db;
  text-decoration: underline;
  font-size: 12px;
}

.text-style-long {
  color: #9b59b6;
  line-height: 1.6;
  font-size: 13px;
  text-align: justify;
}

.text-short {
  color: #e67e22;
  font-weight: bold;
  font-size: 14px;
  background-color: #fff3cd;
  padding: 2px 6px;
  border-radius: 3px;
}

.text-mixed-1 {
  color: #16a085;
  font-size: 18px;
  font-weight: bold;
}

.text-mixed-2 {
  color: #8e44ad;
  font-style: italic;
  font-size: 14px;
}

.text-mixed-3 {
  color: #d35400;
  font-size: 16px;
  text-decoration: underline;
}

.text-mixed-4 {
  color: #27ae60;
  font-size: 13px;
  line-height: 1.5;
}

.text-mixed-5 {
  color: #2980b9;
  font-size: 15px;
  font-weight: bold;
}

.text-label {
  color: #333;
  font-weight: bold;
  margin-right: 8px;
  font-size: 14px;
}

.tech-tag {
  display: inline-block;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #495057;
  margin-right: 4px;
  margin-bottom: 2px;
  font-weight: 500;
}
</style>
