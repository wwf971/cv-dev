import type { Logger } from '../../pagination/LogTypes'

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const
}

interface ProjectData {
  title?: string
  title_en?: string
  type?: string
  people?: string
  time?: string
  place?: string
  techTags?: string[]
  content?: any
  learnings?: any
}

// Helper to process project data
const processProjectData = (data: any): ProjectData => {
  if (!data) return {}

  return {
    title: data.title || '',
    title_en: data.title_en || null,
    type: data.type || '',
    people: data.people || '',
    time: data.time || '',
    place: data.place || '',
    techTags: Array.isArray(data.techTags) ? data.techTags : [],
    content: data.content || [],
    learnings: data.learnings || []
  }
}

// Build title table rows
const buildTitleTableRows = (projectData: ProjectData) => {
  const rows: any[] = []

  // Title row
  rows.push({
    type: 'Tr',
    data: {
      items: [
        {
          items: [
            {
              type: 'Text',
              data: {
                content: `${projectData.title || ''}${projectData.title_en ? `\n${projectData.title_en}` : ''}`,
                display: 'block'
              }
            },
            {
              type: 'Text',
              data: {
                content: projectData.type || '',
                cssClass: 'project-type'
              }
            }
          ],
          cssClass: 'cv-jp-cell title-cell',
          fillToPageBottom: false
        }
      ],
      cssClass: 'title-row'
    }
  })

  return rows
}

// Build info table rows (people, time, place - in one row with three cells)
const buildInfoTableRows = (projectData: ProjectData) => {
  const rows: any[] = []

  // Single row with three cells
  rows.push({
    type: 'Tr',
    data: {
      items: [
        // People cell
        {
          items: [
            {
              type: 'Text',
              data: {
                content: '関連人員',
                cssClass: 'cell-label',
                display: 'block'
              }
            },
            {
              type: 'Text',
              data: {
                content: projectData.people || '',
                cssClass: 'cell-content',
                display: 'block'
              }
            }
          ],
          cssClass: 'cv-jp-cell info-cell'
        },
        // Time cell
        {
          items: [
            {
              type: 'Text',
              data: {
                content: '期間',
                cssClass: 'cell-label',
                display: 'block'
              }
            },
            {
              type: 'Text',
              data: {
                content: projectData.time || '',
                cssClass: 'cell-content',
                display: 'block'
              }
            }
          ],
          cssClass: 'cv-jp-cell info-cell'
        },
        // Place cell
        {
          items: [
            {
              type: 'Text',
              data: {
                content: '場所',
                cssClass: 'cell-label',
                display: 'block'
              }
            },
            {
              type: 'Text',
              data: {
                content: projectData.place || '',
                cssClass: 'cell-content',
                display: 'block'
              }
            }
          ],
          cssClass: 'cv-jp-cell info-cell'
        }
      ],
      cssClass: 'info-row'
    }
  })

  return rows
}

// Build content table rows (tech stack, project content, learning content)
const buildContentTableRows = (projectData: ProjectData) => {
  const rows: any[] = []

  // Tech stack row
  if (projectData.techTags && projectData.techTags.length > 0) {
    rows.push({
      type: 'Tr',
      data: {
        items: [
          {
            items: [
              {
                type: 'Text',
                data: {
                  content: '使用技術',
                  cssClass: 'cell-label'
                }
              },
              // Create individual Text components for tech tags
              ...projectData.techTags.map((tag: string, index: number) => ({
                type: 'Text',
                data: {
                  content: tag,
                  cssClass: 'tech-tag',
                  display: 'inline-block',
                  noSplit: true
                }
              }))
            ],
            cssClass: 'cv-jp-cell tech-cell',
            fillToPageBottom: false
          }
        ],
        cssClass: 'tech-row'
      }
    })
  }

  // Project content row
  if (projectData.content && (Array.isArray(projectData.content) ? projectData.content.length > 0 : true)) {
    rows.push({
      type: 'Tr',
      data: {
        items: [
          {
            items: [
              {
                type: 'Text',
                data: {
                  content: 'プロジェクト内容',
                  cssClass: 'cell-label'
                }
              },
              {
                type: 'TextList',
                data: {
                  mode: 'unordered',
                  items: Array.isArray(projectData.content)
                    ? projectData.content.map((item: any) => ({
                        content: typeof item === 'string' ? item : String(item),
                        cssClass: 'cell-content',
                        display: 'block'
                      }))
                    : [{
                        content: String(projectData.content),
                        cssClass: 'cell-content',
                        display: 'block'
                      }]
                }
              }
            ],
            cssClass: 'cv-jp-cell content-cell',
            fillToPageBottom: true
          }
        ],
        cssClass: 'content-row'
      }
    })
  }

  // Learning outcomes row (only if learnings exist and have content)
  if (projectData.learnings && Array.isArray(projectData.learnings) && projectData.learnings.length > 0) {
    rows.push({
      type: 'Tr',
      data: {
        items: [
          {
            items: [
              {
                type: 'Text',
                data: {
                  content: '学習・実践内容',
                  cssClass: 'cell-label'
                }
              },
              // Note: ListComponent content would need to be converted to text components
              // For now, using a placeholder
              {
                type: 'TextList',
                data: {
                  mode: 'unordered',
                  items: Array.isArray(projectData.learnings)
                    ? projectData.learnings.map((item: any) => ({
                        content: typeof item === 'string' ? item : String(item),
                        cssClass: 'cell-content',
                        display: 'block'
                      }))
                    : [{
                        content: String(projectData.learnings),
                        cssClass: 'cell-content',
                        display: 'block'
                      }]
                }
              }
            ],
            cssClass: 'cv-jp-cell learning-cell',
            fillToPageBottom: false
          }
        ],
        cssClass: 'learning-row'
      }
    })
  }

  return rows
}

/**
 * Build project component array for pagination
 * Returns array of components: [Table (Title), Table (Info), VSpace, Table (Content)]
 * @param data - Project data
 */
export function buildProjectComponents(data: ProjectData) {
  const projectData = processProjectData(data)

  const components: any[] = []

  // Title table
  components.push({
    type: 'Table',
    data: {
      rows: buildTitleTableRows(projectData),
      cssClass: 'form-table font-cv project-table',
      cssStyle: tableStyle
    }
  })

  // Info table (people, time, place)
  components.push({
    type: 'Table',
    data: {
      rows: buildInfoTableRows(projectData),
      cssClass: 'form-table font-cv project-table',
      cssStyle: tableStyle
    }
  })

  // No gap between tables

  // Content table (tech stack, project content, learning content)
  components.push({
    type: 'Table',
    data: {
      rows: buildContentTableRows(projectData),
      cssClass: 'form-table font-cv project-table',
      cssStyle: tableStyle
    }
  })

  return components
}
