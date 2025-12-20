import { toYearJp } from './Utils'

// Column width ratios
const COL_YEAR = 0.08
const COL_MONTH = 0.05
const COL_CONTENT = 0.72
const COL_NOTE = 0.15

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const
}

interface EduWorkEntry {
  year?: number
  month?: number
  year_jp?: string
  value: string
  note?: string
}

interface EduAndWorkData {
  eduEntries?: EduWorkEntry[]
  workEntries?: EduWorkEntry[]
  licenseEntries?: EduWorkEntry[]
}

// Helper to create year/month cells with year_jp support
const createDateCells = (entry: EduWorkEntry) => {
  const japaneseYear = entry.year_jp || (entry.year ? toYearJp(entry.year) : '')
  const gregorianYear = entry.year ? String(entry.year) : ''
  
  const yearItems: any[] = []
  if (japaneseYear) {
    yearItems.push({ 
      type: 'Text', 
      data: { content: japaneseYear }
    })
  }
  if (gregorianYear) {
    yearItems.push({ 
      type: 'Text', 
      data: { content: gregorianYear }
    })
  }
  
  const monthItems: any[] = []
  if (japaneseYear) {
    monthItems.push({
      type: 'Text',
      data: { content: '\u00A0' }
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
      cssClass: 'time-cell year-cell'
    },
    {
      items: monthItems,
      widthRatio: COL_MONTH,
      cssClass: 'time-cell month-cell'
    }
  ]
}

// Helper to add alignment spacer to content cells
const createContentCell = (content: string, widthRatio: number, cssClass: string, hasJapaneseYear: boolean = true) => {
  const items: any[] = []
  
  if (hasJapaneseYear) {
    items.push({
      type: 'Text',
      data: { content: '\u00A0' }
    })
  }
  
  items.push({
    type: 'Text',
    data: { content }
  })
  
  return {
    items,
    widthRatio,
    cssClass
  }
}

// Build table 1 rows (Education and Work sections)
const buildTable1Rows = (data: EduAndWorkData) => {
  const rows: any[] = []
  
  // Header row 1
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '年', noSplit: true } }],
          widthRatio: COL_YEAR,
          cssClass: 'date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '月', noSplit: true } }],
          widthRatio: COL_MONTH,
          cssClass: 'date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '学 歴・職 歴', noSplit: true } }],
          widthRatio: COL_CONTENT + COL_NOTE,
          colspan: 2,
          cssClass: 'header-cell word-spacing-0p5',
          cssStyle: { wordSpacing: '0.5em' }
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Section header: 学歴
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [],
          widthRatio: COL_YEAR + COL_MONTH,
          colspan: 2,
          isEmpty: true,
          cssClass: 'section-divider no-right-border'
        },
        {
          items: [{ type: 'Text', data: { content: '学 歴', noSplit: true } }],
          widthRatio: COL_CONTENT + COL_NOTE,
          colspan: 2,
          cssClass: 'header-cell word-spacing-0p5 no-left-border',
          cssStyle: { wordSpacing: '0.5em' }
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Education entries
  data.eduEntries?.forEach((edu: EduWorkEntry) => {
    const hasJpYear = !!(edu.year_jp || (edu.year && toYearJp(edu.year)))
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(edu),
          {
            ...createContentCell(edu.value, COL_CONTENT + COL_NOTE, 'form-cell value-cell align-left content-cell', hasJpYear),
            colspan: 2
          }
        ],
        cssClass: 'entry-row'
      }
    })
  })
  
  // Section header: 職歴
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [],
          widthRatio: COL_YEAR + COL_MONTH,
          colspan: 2,
          isEmpty: true,
          cssClass: 'section-divider no-right-border'
        },
        {
          items: [{ type: 'Text', data: { content: '職 歴', noSplit: true } }],
          widthRatio: COL_CONTENT + COL_NOTE,
          colspan: 2,
          cssClass: 'header-cell word-spacing-0p5 no-left-border',
          cssStyle: { wordSpacing: '0.5em' }
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // Work entries
  data.workEntries?.forEach((work: EduWorkEntry) => {
    const hasJpYear = !!(work.year_jp || (work.year && toYearJp(work.year)))
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(work),
          createContentCell(work.value, COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear),
          createContentCell(work.note || '', COL_NOTE, 'form-cell value-cell no-left-border align-center content-cell', hasJpYear)
        ],
        cssClass: 'entry-row'
      }
    })
  })
  
  return rows
}

// Build table 2 rows (License section)
const buildTable2Rows = (data: EduAndWorkData) => {
  const rows: any[] = []
  
  // Header row 2
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [{ type: 'Text', data: { content: '年', noSplit: true } }],
          widthRatio: COL_YEAR,
          cssClass: 'date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '月', noSplit: true } }],
          widthRatio: COL_MONTH,
          cssClass: 'date-column-header'
        },
        {
          items: [{ type: 'Text', data: { content: '免許・資格', noSplit: true } }],
          widthRatio: COL_CONTENT,
          cssClass: 'section-divider'
        },
        {
          items: [{ type: 'Text', data: { content: '備考', noSplit: true } }],
          widthRatio: COL_NOTE,
          cssClass: 'section-divider'
        }
      ],
      cssClass: 'header-row'
    }
  })
  
  // License entries
  data.licenseEntries?.forEach((license: EduWorkEntry) => {
    const hasJpYear = !!(license.year_jp || (license.year && toYearJp(license.year)))
    rows.push({
      type: 'Tr',
      data: {
        items: [
          ...createDateCells(license),
          createContentCell(license.value, COL_CONTENT, 'form-cell value-cell align-left content-cell', hasJpYear),
          createContentCell(license.note || '', COL_NOTE, 'form-cell value-cell no-left-border align-center content-cell', hasJpYear)
        ],
        cssClass: 'entry-row'
      }
    })
  })
  
  return rows
}

/**
 * Build Education and Work component array for pagination
 * Returns array of components: [Table, VSpace, Table]
 */
export function buildEduAndWorkComponents(data: EduAndWorkData) {
  return [
    {
      type: 'Table',
      data: {
        rows: buildTable1Rows(data),
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
        rows: buildTable2Rows(data),
        cssClass: 'form-table font-cv',
        cssStyle: tableStyle
      }
    }
  ]
}

