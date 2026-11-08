import type { Logger } from '../../pagination/LogTypes'
import { LogType } from '../../pagination/LogTypes'
import { processDescription, createContentCell } from './Utils'

/**
 * Build motivation component array for pagination
 * Returns array of components: [Table (Motivation), VSpace, Table (Interest)]
 * @param data - Motivation and interest data
 * @param logger - Optional logger for warning/error messages
 */
export function buildMotivationComponents(data: MotivationData, logger?: Logger | null) {
  const motivationData = processMotivationData(data.motivation, logger)
  const interestData = processMotivationData(data.interest, logger)

  return [
    {
      type: 'VSpace',
      data: {
        height: 15,
        hiddenIfAtPageTop: true
      }
    },
    {
      type: 'Table',
      data: {
        rows: buildMotivationTableRows(motivationData),
        cssClass: 'form-table font-cv table-no-bottom-border',
        cssStyle: tableStyle
      }
    },
    {
      type: 'Table',
      data: {
        rows: buildInterestTableRows(interestData),
        cssClass: 'form-table font-cv table-no-top-border',
        cssStyle: tableStyle,
        // Remove top border when not first on page (shares border with motivation table)
        // But restore top border if pagination places this table at page top
        removeTopBorderIfNotFirst: true
      }
    }
  ]
}


const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const
}

interface TreeResponse {
  code: number
  data: {
    tree: any
    [key: string]: any
  }
  message: string
}

interface MotivationData {
  motivation?: string | TreeResponse | string[]
  interest?: string | TreeResponse | string[]
}

// Helper to check if entry is a tree response
const isTreeResponse = (entry: any): entry is TreeResponse => {
  return entry && typeof entry === 'object' &&
         'code' in entry && 'data' in entry && 'message' in entry &&
         entry.data && 'tree' in entry.data
}

// Helper to extract text content from tree response
const extractTextFromTree = (treeResponse: TreeResponse, logger?: Logger | null): string => {
  try {
    if (treeResponse.code !== 0 || !treeResponse.data?.tree) {
      if (logger) {
        logger.addLog(`Invalid tree response: ${treeResponse.message || 'No tree data'}`, 'MotivationBuilder.extractTextFromTree', LogType.Error)
      }
      return ''
    }

    const tree = treeResponse.data.tree

    // Look for content nodes with text values
    const extractText = (node: any): string => {
      if (node.type === 'content' && node.content?.value) {
        return String(node.content.value)
      }

      if (node.children) {
        let text = ''
        for (const childKey in node.children) {
          text += extractText(node.children[childKey])
        }
        return text
      }

      return ''
    }

    return extractText(tree)
  } catch (error) {
    if (logger) {
      logger.addLog(`Error extracting text from tree: ${error}`, 'MotivationBuilder.extractTextFromTree', LogType.Error)
    }
    return ''
  }
}


// Helper to process motivation/interest data
const processMotivationData = (data: string | TreeResponse | string[] | undefined, logger?: Logger | null): string | string[] => {
  if (!data) return ''

  // Handle array data directly (e.g., ["xxx","yyy"])
  if (Array.isArray(data)) {
    return data.length === 1 ? data[0] : data
  }

  let rawText = ''

  if (typeof data === 'string') {
    rawText = data
  } else if (isTreeResponse(data)) {
    rawText = extractTextFromTree(data, logger)
  } else {
    rawText = String(data)
  }

  // Apply the same text processing as EduAndWorkBuilder
  const processedLines = processDescription(rawText)

  // Return single string if only one line, otherwise return array
  return processedLines.length === 1 ? processedLines[0] : processedLines
}


// Helper to create content cell with TextList for array data
const createTextListContentCell = (lines: string[], cssClass: string, textDisplayMode: 'bullet' | 'paragraph' | 'none' = 'paragraph') => {
  return {
    items: [
      {
        type: 'TextList',
        data: {
          mode: 'unordered',
          textDisplayMode: textDisplayMode,
          items: lines.map(line => ({
            content: line,
            display: 'block'
          }))
        }
      }
    ],
    cssClass: `cv-jp-cell ${cssClass}`,
    fillToPageBottom: true
  }
}

// Build motivation table rows
const buildMotivationTableRows = (motivationData: string | string[]) => {
  const rows: any[] = []

  // Header row
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '志 望 動 機', noSplit: true } }],
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5',
          cssStyle: { wordSpacing: '0.5em' }
        }
      ],
      cssClass: 'header-row'
    }
  })

  // Content row
  const isMultiLine = Array.isArray(motivationData)
  rows.push({
    type: 'Tr',
    data: {
      items: [
        isMultiLine
          ? createTextListContentCell(motivationData as string[], 'motivation-content')
          : createContentCell(motivationData as string, 'motivation-content')
      ],
      cssClass: 'content-row'
    }
  })

  return rows
}

// Build interest table rows
const buildInterestTableRows = (interestData: string | string[]) => {
  const rows: any[] = []

  // Header row (first row of interest table, remove TD top border to avoid thick edge)
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '趣 味', noSplit: true } }],
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5 td-no-top-border',
          cssStyle: { wordSpacing: '0.5em' }
        }
      ],
      cssClass: 'header-row'
    }
  })

  // Content row
  const isMultiLine = Array.isArray(interestData)
  rows.push({
    type: 'Tr',
    data: {
      items: [
        isMultiLine
          ? createTextListContentCell(interestData as string[], 'motivation-content', 'none')
          : createContentCell(interestData as string, 'motivation-content')
      ],
      cssClass: 'content-row'
    }
  })

  return rows
}


