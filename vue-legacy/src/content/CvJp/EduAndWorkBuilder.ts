import { toYearJp, processDescription } from './Utils'
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
  certEntries?: (EduWorkEntry | TreeResponse | string)[]
}

// Helper to check if entry is a tree response
const isTreeResponse = (entry: any): entry is TreeResponse => {
  return entry && typeof entry === 'object' && 
         'code' in entry && 'data' in entry && 'message' in entry &&
         entry.data && 'tree' in entry.data
}


// Helper to parse a single entry (start, end, or direct entry)
const parseEntry = (timeNode: any, descNode: any, noteNode?: any): EduWorkEntry | null => {
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

  // If noteNode is provided separately (cert entries), use it
  if (noteNode && noteNode.type === 'content' && noteNode.content?.value) {
    note = String(noteNode.content.value)
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
    const noteId = Object.keys(tree).find(key => tree[key].name === 'note')

    if (timeId && descId) {
      // Direct entry pattern (work/cert entries)
      const entry = parseEntry(tree[timeId], tree[descId], noteId ? tree[noteId] : undefined)
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
const createDateCells = (entry: EduWorkEntry, isLastEntry: boolean = false, borderClass: string = '') => {
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
      cssClass: `cv-jp-cell time-cell year-cell${borderClass ? ` ${borderClass}` : ''}${isLastEntry ? ' last-row-cell' : ''}`
    },
    {
      items: monthItems,
      widthRatio: COL_MONTH,
      cssClass: `cv-jp-cell time-cell month-cell${borderClass ? ` ${borderClass}` : ''}${isLastEntry ? ' last-row-cell' : ''}`
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

// Build education table rows (Year, Month, Content columns)
const buildEducationTableRows = (eduEntries: EduWorkEntry[]) => {
  const rows: any[] = []

  // Education section header (Year, Month, Content columns only)
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '年', noSplit: true } }],
          widthRatio: COL_YEAR,
          cssClass: 'cv-jp-cell header-cell date-column-header td-no-bottom-border'
        },
        {
          items: [{ type: 'Text', data: { content: '月', noSplit: true } }],
          widthRatio: COL_MONTH,
          cssClass: 'cv-jp-cell header-cell date-column-header td-no-bottom-border'
        },
        {
          items: [{ type: 'Text', data: { content: '学 歴', noSplit: true } }],
          widthRatio: 1.0 - COL_YEAR - COL_MONTH,
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5 td-no-bottom-border',
          cssStyle: { wordSpacing: '0.5em' }
        },
      ],
      cssClass: 'header-row'
    }
  })

  // Education entries
  eduEntries.forEach((edu: EduWorkEntry, index: number) => {
    const hasJpYear = !!(edu.year_jp || (edu.year && toYearJp(edu.year)))
    const isMultiLine = Array.isArray(edu.value)
    const isLastEntry = index === eduEntries.length - 1

    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(edu, isLastEntry, 'td-no-bottom-border'),
          {
            // Use createMultiLineContentCell for array values, createContentCell for strings
            ...(isMultiLine
              ? createMultiLineContentCell(edu.value as string[], 1.0 - COL_YEAR - COL_MONTH, `form-cell value-cell align-left content-cell td-no-bottom-border${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
              : createContentCell(edu.value as string, 1.0 - COL_YEAR - COL_MONTH, `form-cell value-cell align-left content-cell td-no-bottom-border${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
            )
          }
        ],
        cssClass: `entry-row${isLastEntry ? ' last-entry-row' : ''}`,
        fillToPageBottom: !isLastEntry  // Only fill to page bottom for non-last rows
      }
    })
  })

  return rows
}

// Build work table rows (Year, Month, Content, Note columns)
const buildWorkTableRows = (workEntries: EduWorkEntry[]) => {
  const rows: any[] = []

  // Work section header (Year, Month, Content, Note columns)
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
          items: [{ type: 'Text', data: { content: '職 歴', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'cv-jp-cell header-cell word-spacing-0p5',
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
  workEntries.forEach((work: EduWorkEntry, index: number) => {
    const hasJpYear = !!(work.year_jp || (work.year && toYearJp(work.year)))
    const isMultiLine = Array.isArray(work.value)
    const isLastEntry = index === workEntries.length - 1

    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(work, isLastEntry, 'td-no-top-border'),
          // Use createMultiLineContentCell for array values, createContentCell for strings
          isMultiLine
            ? createMultiLineContentCell(work.value as string[], COL_CONTENT, `form-cell value-cell align-left content-cell td-no-top-border${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
            : createContentCell(work.value as string, COL_CONTENT, `form-cell value-cell align-left content-cell td-no-top-border${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear),
          createContentCell(work.note || '', COL_NOTE, `form-cell value-cell no-left-border align-center content-cell td-no-top-border${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
        ],
        cssClass: `entry-row${isLastEntry ? ' last-entry-row' : ''}`,
        fillToPageBottom: !isLastEntry  // Only fill to page bottom for non-last rows
      }
    })
  })

  return rows
}

// Build table 2 rows (Certificate section)
const buildTable2Rows = (certEntries: EduWorkEntry[]) => {
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
  
  // Certificate entries
  certEntries.forEach((cert: EduWorkEntry, index: number) => {
    const hasJpYear = !!(cert.year_jp || (cert.year && toYearJp(cert.year)))
    const isMultiLine = Array.isArray(cert.value)
    const isLastEntry = index === certEntries.length - 1

    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(cert, isLastEntry, ''),
          // Use createMultiLineContentCell for array values, createContentCell for strings
          isMultiLine
            ? createMultiLineContentCell(cert.value as string[], COL_CONTENT, `form-cell value-cell align-left content-cell${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
            : createContentCell(cert.value as string, COL_CONTENT, `form-cell value-cell align-left content-cell${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear),
          createContentCell(cert.note || '', COL_NOTE, `form-cell value-cell no-left-border align-center content-cell${isLastEntry ? ' last-row-cell' : ''}`, hasJpYear)
        ],
        cssClass: `entry-row${isLastEntry ? ' last-entry-row' : ''}`,
        fillToPageBottom: !isLastEntry  // Only fill to page bottom for non-last rows
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
  const certEntries = expandEntries(data.certEntries, logger)

  return [
    {
      type: 'Table',
      data: {
        rows: buildEducationTableRows(eduEntries),
        cssClass: 'form-table font-cv table-no-bottom-border',
        cssStyle: tableStyle
      }
    },
    {
      type: 'Table',
      data: {
        rows: buildWorkTableRows(workEntries),
        cssClass: 'form-table font-cv table-no-top-border',
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
        rows: buildTable2Rows(certEntries),
        cssClass: 'form-table font-cv',
        cssStyle: tableStyle
      }
    }
  ]
}

