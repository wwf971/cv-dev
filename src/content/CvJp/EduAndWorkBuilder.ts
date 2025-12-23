import { toYearJp } from './Utils'
import type { Logger } from '../../pagination/LogTypes'
import { LogType } from '../../pagination/LogTypes'

// Column width ratios - must sum to 100% for table-layout: fixed
const COL_YEAR = 0.08
const COL_MONTH = 0.08
const COL_CONTENT = 0.66  // Only used when there's a note column after it
const COL_NOTE = 0.18     // Explicitly set to remaining 18%

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const
}

interface EduWorkEntry {
  year?: number
  month?: number
  year_jp?: string
  value: string | string[]  // Can be single string or array of lines
  note?: string
}

interface TreeResponse {
  code: number
  data: {
    tree: any
    [key: string]: any
  }
  message: string
}

interface EduAndWorkData {
  eduEntries?: (EduWorkEntry | TreeResponse | string)[]
  workEntries?: (EduWorkEntry | TreeResponse | string)[]
  licenseEntries?: (EduWorkEntry | TreeResponse | string)[]
}

// Helper to check if entry is a tree response
const isTreeResponse = (entry: any): entry is TreeResponse => {
  return entry && typeof entry === 'object' && 
         'code' in entry && 'data' in entry && 'message' in entry &&
         entry.data && 'tree' in entry.data
}

// Helper to process description text: replace spaces with 2×&nbsp; and split by \n
const processDescription = (text: string): string[] => {
  if (!text) return []
  
  // Split by \n first
  const lines = text.split('\n')
  
  // For each line, replace each space with 2 non-breaking spaces
  // DON'T trim - preserve leading spaces
  return lines
    .filter(line => line.length > 0)
    .map(line => line.replace(/ /g, '\u00A0')) // Each space becomes 2 non-breaking spaces
}

// Helper to parse a single entry (start, end, or direct entry)
const parseEntry = (timeNode: any, descNode: any): EduWorkEntry | null => {
  if (!timeNode || !descNode) return null
  
  const yearId = Object.keys(timeNode.children || {}).find(key => timeNode.children[key].name === 'year')
  const monthId = Object.keys(timeNode.children || {}).find(key => timeNode.children[key].name === 'month')
  
  const year = yearId ? Number(timeNode.children[yearId].content?.value) : undefined
  const month = monthId ? (timeNode.children[monthId].content?.value) : undefined
  
  // Get description value and type/note
  let rawValue = ''
  let note = ''
  
  if (descNode.type === 'content' && descNode.content?.value) {
    // Description node is directly a content node
    rawValue = String(descNode.content.value)
  } else if (descNode.children) {
    // Description node is a segment, look for 'jp' and 'type' children
    const jpId = Object.keys(descNode.children).find(key => descNode.children[key].name === 'jp')
    const typeId = Object.keys(descNode.children).find(key => descNode.children[key].name === 'type')
    
    rawValue = jpId ? String(descNode.children[jpId].content?.value || '') : ''
    note = typeId ? String(descNode.children[typeId].content?.value || '') : ''
  }
  
  // Process description: split by \n and replace spaces
  const processedLines = processDescription(rawValue)
  
  if (processedLines.length === 0) return null
  
  const entry: EduWorkEntry = {
    year,
    month,
    value: processedLines.length === 1 ? processedLines[0] : processedLines
  }
  
  if (note) {
    entry.note = note
  }
  
  return entry
}

// Helper to expand tree response into start/end entries
const expandTreeResponse = (treeResponse: TreeResponse, logger?: Logger | null): EduWorkEntry[] => {
  try {
    if (treeResponse.code !== 0 || !treeResponse.data?.tree) {
      if (logger) {
        logger.addLog(`Invalid tree response: ${treeResponse.message || 'No tree data'}`, 'EduAndWorkBuilder.expandTreeResponse', LogType.Error)
      }
      return []
    }
    
    const tree = treeResponse.data.tree
    const entries: EduWorkEntry[] = []
    
    // Check if tree has direct time/description nodes (work entry pattern)
    const timeId = Object.keys(tree).find(key => tree[key].name === 'time')
    const descId = Object.keys(tree).find(key => tree[key].name === 'description')
    
    if (timeId && descId) {
      // Direct entry pattern (work entries)
      const entry = parseEntry(tree[timeId], tree[descId])
      if (entry) entries.push(entry)
      return entries
    }
    
    // Otherwise, check for start/end pattern (education entries)
    // Parse start entry
    const startId = Object.keys(tree).find(key => tree[key].name === 'start')
    if (startId) {
      const startNode = tree[startId]
      const startTimeId = Object.keys(startNode.children || {}).find(key => startNode.children[key].name === 'time')
      const startDescId = Object.keys(startNode.children || {}).find(key => startNode.children[key].name === 'description')
      
      if (startTimeId && startDescId) {
        const entry = parseEntry(startNode.children[startTimeId], startNode.children[startDescId])
        if (entry) entries.push(entry)
      }
    }
    
    // Parse end entry
    const endId = Object.keys(tree).find(key => tree[key].name === 'end')
    if (endId) {
      const endNode = tree[endId]
      const endTimeId = Object.keys(endNode.children || {}).find(key => endNode.children[key].name === 'time')
      const endDescId = Object.keys(endNode.children || {}).find(key => endNode.children[key].name === 'description')
      
      if (endTimeId && endDescId) {
        const entry = parseEntry(endNode.children[endTimeId], endNode.children[endDescId])
        if (entry) entries.push(entry)
      }
    }
    
    return entries
  } catch (error) {
    if (logger) {
      logger.addLog(`Error expanding tree response: ${error}`, 'EduAndWorkBuilder.expandTreeResponse', LogType.Error)
    }
    return []
  }
}

// Helper to check if entry is a valid EduWorkEntry
const isValidEntry = (entry: any): entry is EduWorkEntry => {
  return entry && typeof entry === 'object' && 
         (typeof entry.value === 'string' || Array.isArray(entry.value)) &&
         !('code' in entry)  // Not a tree response
}

// Helper to expand entries (handle both regular entries and tree responses)
const expandEntries = (entries?: (EduWorkEntry | TreeResponse | string)[], logger?: Logger | null): EduWorkEntry[] => {
  if (!entries) return []
  
  const expanded: EduWorkEntry[] = []
  
  for (const entry of entries) {
    if (typeof entry === 'string') {
      // String pattern (unfetched) - skip it
      if (logger) {
        logger.addLog(`Skipping unfetched pattern: ${entry}`, 'EduAndWorkBuilder.expandEntries', LogType.Warning)
      }
      continue
    } else if (isTreeResponse(entry)) {
      // Tree response - expand it
      const treeEntries = expandTreeResponse(entry, logger)
      expanded.push(...treeEntries)
    } else if (isValidEntry(entry)) {
      // Regular entry
      expanded.push(entry)
    } else {
      if (logger) {
        logger.addLog(`Skipping invalid entry: ${JSON.stringify(entry)}`, 'EduAndWorkBuilder.expandEntries', LogType.Warning)
      }
    }
  }
  
  return expanded
}

// Helper to create year/month cells with year_jp support
const createDateCells = (entry: EduWorkEntry) => {
  const japaneseYear = entry.year_jp || (entry.year ? toYearJp(entry.year) : '')
  const gregorianYear = entry.year ? String(entry.year) : ''
  
  const yearItems: any[] = []
  if (japaneseYear) {
    yearItems.push({
      type: 'Text',
      data: { content: japaneseYear, cssClass: 'japanese-year' }
    })
  }
  if (gregorianYear) {
    yearItems.push({ 
      type: 'Text', 
      data: { content: gregorianYear, cssClass: 'gregorian-year' }
    })
  }
  
  const monthItems: any[] = []
  if (japaneseYear) {
    monthItems.push({
      type: 'Text',
      data: { content: '\u00A0', cssClass: 'alignment-spacer' }
    })
  }
  monthItems.push({
    type: 'Text',
    data: { content: entry.month ? String(entry.month) : '' }
  })
  
  return [
    {
      items: yearItems,
      widthRatio: COL_YEAR,
      cssClass: 'cv-jp-cell time-cell year-cell'
    },
    {
      items: monthItems,
      widthRatio: COL_MONTH,
      cssClass: 'cv-jp-cell time-cell month-cell'
    }
  ]
}

// Helper to add alignment spacer to content cells
const createContentCell = (content: string, widthRatio: number | undefined, cssClass: string, hasJapaneseYear: boolean = true) => {
  const items: any[] = []
  
  if (hasJapaneseYear) {
    items.push({
      type: 'Text',
      data: { content: '\u00A0', cssClass: 'alignment-spacer' }
    })
  }
  
  items.push({
    type: 'Text',
    data: { content }
  })
  
  const cell: any = {
    items,
    cssClass: `cv-jp-cell ${cssClass}`
  }
  
  // Only set widthRatio if defined (last column auto-fills)
  if (widthRatio !== undefined) {
    cell.widthRatio = widthRatio
  }
  
  return cell
}

// Helper to create content cell with multiple lines
const createMultiLineContentCell = (lines: string[], widthRatio: number | undefined, cssClass: string, hasJapaneseYear: boolean = true) => {
  const items: any[] = []
  
  // Add alignment spacer if Japanese year exists (same as single-line)
  if (hasJapaneseYear) {
    items.push({
      type: 'Text',
      data: { content: '\u00A0', cssClass: 'alignment-spacer' }
    })
  }
  
  // Add each line as a separate Text item
  lines.forEach(line => {
    items.push({
      type: 'Text',
      data: { content: line }
    })
  })
  
  const cell: any = {
    items,
    cssClass: `cv-jp-cell ${cssClass}`
  }
  
  // Only set widthRatio if defined (last column auto-fills)
  if (widthRatio !== undefined) {
    cell.widthRatio = widthRatio
  }
  
  return cell
}

// Build table 1 rows (Education and Work sections)
const buildTable1Rows = (eduEntries: EduWorkEntry[], workEntries: EduWorkEntry[]) => {
  const rows: any[] = []
  
  // Header row 1 - Define all 4 columns explicitly to match Table 2 structure
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '年', noSplit: true } }],
          widthRatio: COL_YEAR,
          cssClass: 'cv-jp-cell header-cell date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '月', noSplit: true } }],
          widthRatio: COL_MONTH,
          cssClass: 'cv-jp-cell header-cell date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '学 歴・職 歴', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5',
          cssStyle: { wordSpacing: '0.5em' }
        },
        {
          items: [{ type: 'Text', data: { content: '', noSplit: true } }],
          widthRatio: COL_NOTE,
          cssClass: 'cv-jp-cell header-cell no-left-border'
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Section header: 学歴 - Define all 4 columns explicitly
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [],
          widthRatio: COL_YEAR,
          isEmpty: true,
          cssClass: 'cv-jp-cell section-divider no-right-border'
        },
        {
          items: [],
          widthRatio: COL_MONTH,
          isEmpty: true,
          cssClass: 'cv-jp-cell section-divider no-left-border no-right-border'
        },
        {
          items: [{ type: 'Text', data: { content: '学 歴', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5 no-left-border',
          cssStyle: { wordSpacing: '0.5em' }
        },
        {
          items: [],
          widthRatio: COL_NOTE,
          isEmpty: true,
          cssClass: 'cv-jp-cell section-divider no-left-border'
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Education entries
  eduEntries.forEach((edu: EduWorkEntry) => {
    const hasJpYear = !!(edu.year_jp || (edu.year && toYearJp(edu.year)))
    const isMultiLine = Array.isArray(edu.value)
    
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(edu),
          {
            // Use createMultiLineContentCell for array values, createContentCell for strings
            // Colspan=2 spans Content + Note columns
            ...(isMultiLine 
              ? createMultiLineContentCell(edu.value as string[], COL_CONTENT + COL_NOTE, 'form-cell value-cell align-left content-cell', hasJpYear)
              : createContentCell(edu.value as string, COL_CONTENT + COL_NOTE, 'form-cell value-cell align-left content-cell', hasJpYear)
            ),
            colspan: 2
          }
        ],
        cssClass: 'entry-row',
        fillToPageBottom: true
      }
    })
  })
  
  // Section header: 職歴 - Define all 4 columns explicitly
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [],
          widthRatio: COL_YEAR,
          isEmpty: true,
          cssClass: 'cv-jp-cell section-divider no-right-border'
        },
        {
          items: [],
          widthRatio: COL_MONTH,
          isEmpty: true,
          cssClass: 'cv-jp-cell section-divider no-left-border no-right-border'
        },
        {
          items: [{ type: 'Text', data: { content: '職 歴', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5 no-left-border',
          cssStyle: { wordSpacing: '0.5em' }
        },
        {
          items: [{ type: 'Text', data: { content: '備考', noSplit: true } }],
          widthRatio: COL_NOTE,
          cssClass: 'cv-jp-cell header-cell'
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Work entries
  workEntries.forEach((work: EduWorkEntry) => {
    const hasJpYear = !!(work.year_jp || (work.year && toYearJp(work.year)))
    const isMultiLine = Array.isArray(work.value)
    
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(work),
          // Use createMultiLineContentCell for array values, createContentCell for strings
          isMultiLine 
            ? createMultiLineContentCell(work.value as string[], COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear)
            : createContentCell(work.value as string, COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear),
          createContentCell(work.note || '', COL_NOTE, 'form-cell value-cell no-left-border align-center content-cell', hasJpYear)
        ],
        cssClass: 'entry-row',
        fillToPageBottom: true
      }
    })
  })
  
  return rows
}

// Build table 2 rows (License section)
const buildTable2Rows = (licenseEntries: EduWorkEntry[]) => {
  const rows: any[] = []
  
  // First header row (matches Table 1 structure with Year, Month, Content, Note columns)
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '年', noSplit: true } }],
          widthRatio: COL_YEAR,
          cssClass: 'cv-jp-cell header-cell date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '月', noSplit: true } }],
          widthRatio: COL_MONTH,
          cssClass: 'cv-jp-cell header-cell date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '免許・資格', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'cv-jp-cell header-cell'
        },
        {
          items: [{ type: 'Text', data: { content: '備考', noSplit: true } }],
          widthRatio: COL_NOTE,
          cssClass: 'cv-jp-cell header-cell'
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // License entries
  licenseEntries.forEach((license: EduWorkEntry) => {
    const hasJpYear = !!(license.year_jp || (license.year && toYearJp(license.year)))
    const isMultiLine = Array.isArray(license.value)
    
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(license),
          // Use createMultiLineContentCell for array values, createContentCell for strings
          isMultiLine 
            ? createMultiLineContentCell(license.value as string[], COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear)
            : createContentCell(license.value as string, COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear),
          createContentCell(license.note || '', COL_NOTE, 'form-cell value-cell no-left-border align-center content-cell', hasJpYear)
        ],
        cssClass: 'entry-row',
        fillToPageBottom: true
      }
    })
  })
  
  return rows
}

/**
 * Build Education and Work component array for pagination
 * Returns array of components: [Table, VSpace, Table]
 * Now supports tree response expansion
 * @param data - Education and work data
 * @param logger - Optional logger for warning/error messages
 */
export function buildEduAndWorkComponents(data: EduAndWorkData, logger?: Logger | null) {
  // Expand all entries (handle tree responses)
  const eduEntries = expandEntries(data.eduEntries, logger)
  const workEntries = expandEntries(data.workEntries, logger)
  const licenseEntries = expandEntries(data.licenseEntries, logger)
  
  return [
    {
      type: 'Table',
      data: {
        rows: buildTable1Rows(eduEntries, workEntries),
        cssClass: 'form-table font-cv',
        cssStyle: tableStyle
      }
    },
    {
      type: 'VSpace',
      data: {
        height: 15
      }
    },
    {
      type: 'Table',
      data: {
        rows: buildTable2Rows(licenseEntries),
        cssClass: 'form-table font-cv',
        cssStyle: tableStyle
      }
    }
  ]
}

