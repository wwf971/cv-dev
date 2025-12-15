<template>
  <PanelTest
    title="Table Tr/Td Cross-Page Test"
    description="Testing table row (Tr) and cell (Td) pagination with multiple cells having different content lengths. First Td has short content, second Td has long TextList content that needs splitting."
    docId="test-table-tr-td"
    :paginationRef="paginationRef"
    :componentCount="testData.length"
    @runPagination="handleRunPagination"
  >
    <template #content>
      <Pagination
        ref="paginationRef"
        docId="test-table-tr-td"
        :pageHeight="pageHeight"
        :pagePadding="{ top: 40, bottom: 40, left: 40, right: 40 }"
      />
    </template>
  </PanelTest>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Pagination from '@/pagination/Pagination.vue'
import PanelTest from './panel_test.vue'

const paginationRef = ref(null)
const pageHeight = ref(300)

const handleRunPagination = () => {
  if (paginationRef.value) {
    paginationRef.value.runPagination()
  }
}

const testData = [
  {
    type: 'Table',
    data: {
      rows: [
        {
          type: 'Tr',
          data: {
            items: [
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Short cell content'
                    }
                  }
                ],
                widthRatio: 0.3
              },
              {
                items: [
                  {
                    type: 'TextList',
                    data: {
                      mode: 'unordered',
                      items: [
                        { content: 'First list item with some content. '.repeat(20) },
                        { content: 'Second list item with more content. '.repeat(25) },
                        { content: 'Third list item. '.repeat(15) },
                        { content: 'Fourth list item. '.repeat(10) }
                      ]
                    }
                  }
                ],
                widthRatio: 0.7
              }
            ]
          }
        },
        {
          type: 'Tr',
          data: {
            items: [
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Another short cell'
                    }
                  }
                ],
                widthRatio: 0.3
              },
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Another cell with moderate content that fits in one page'
                    }
                  }
                ],
                widthRatio: 0.7
              }
            ]
          }
        }
      ]
    }
  }
]

onMounted(() => {
  if (paginationRef.value) {
    paginationRef.value.setDocData(testData)
  }
})
</script>

