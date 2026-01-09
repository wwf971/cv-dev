const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const
}

/**
 * Process image data object with src array and caption
 * Handles format: { src: [url1, url2], caption: "text", height: "200px", ... }
 * @param imageData - Object with src array and optional caption
 * @returns ImageRow component data
 */
const processImageDataObject = (imageData: any) => {
  if (!imageData || !imageData.src) {
    return null
  }

  const sources = Array.isArray(imageData.src) ? imageData.src : [imageData.src]
  const caption = imageData.caption
  const height = imageData.height
  const width = imageData.width
  const maxHeight = imageData.maxHeight
  const maxWidth = imageData.maxWidth

  // Create image items WITHOUT individual captions
  const items = sources.map((src: string) => ({
    type: 'Image',
    data: {
      src: typeof src === 'string' ? src : src,
      caption: null,  // Explicitly null - no individual captions
      height,
      width,
      maxHeight,
      maxWidth
    }
  }))

  // Return ImageRow data
  return {
    type: 'ImageRow',
    data: {
      items,
      caption: caption || undefined,  // Use shared caption
      align: 'center'
    }
  }
}

/**
 * Process images and captions for ImageRow
 * If multiple images share a single caption, extract it as shared caption
 * @param images - Array of image data (can be src strings or {src, caption} objects)
 * @param captions - Caption string or array of captions
 * @returns Object with items array and optional caption
 */
const processImagesWithCaptions = (images: any[], captions?: string | string[]) => {
  if (!images || images.length === 0) {
    return { items: [] }
  }

  // Convert caption to array form
  let captionArray: string[] = []
  if (typeof captions === 'string' && captions) {
    captionArray = [captions]
  } else if (Array.isArray(captions)) {
    captionArray = captions.filter((c: any) => c && typeof c === 'string' && c.trim())  // Filter out empty/null values
  }

  // Check if we should use shared caption:
  // - Single image or multiple images (>=1)
  // - Caption is string OR array with only one non-empty element
  // This ensures even single images use ImageRow's centered caption display
  const useSharedCaption = images.length >= 1 && captionArray.length === 1 && captionArray[0]

  if (useSharedCaption) {
    // Create images without individual captions - caption will be shown by ImageRow
    const items = images.map((img: any) => {
      const imageData: any = {
        src: typeof img === 'string' ? img : img.src,
        width: typeof img === 'object' ? img.width : undefined,
        height: typeof img === 'object' ? img.height : undefined,
        maxWidth: typeof img === 'object' ? img.maxWidth : undefined,
        maxHeight: typeof img === 'object' ? img.maxHeight : undefined
      }
      // Do NOT include caption property at all for individual images
      return {
        type: 'Image',
        data: imageData
      }
    })

    return {
      items,
      caption: captionArray[0]
    }
  } else {
    // Create images with individual captions
    const items = images.map((img: any, index: number) => ({
      type: 'Image',
      data: {
        src: typeof img === 'string' ? img : img.src,
        caption: captionArray[index] || (typeof img === 'object' ? img.caption : undefined),
        width: typeof img === 'object' ? img.width : undefined,
        height: typeof img === 'object' ? img.height : undefined,
        maxWidth: typeof img === 'object' ? img.maxWidth : undefined,
        maxHeight: typeof img === 'object' ? img.maxHeight : undefined
      }
    }))

    return { items }
  }
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
  images?: any  // Can be: 1) {src: [urls], caption, height} 2) Array of such objects 3) Array of url strings
  imageCaptions?: string | string[]  // Single caption for all images or array of captions (used with format 3)
}

// Helper to process project data
const processProjectData = (data: any): ProjectData => {
  if (!data) return {}

  return {
    title: data.title || data.name || '',  // Support both 'title' and 'name' field names
    title_en: data.title_en || null,
    type: data.type || '',
    people: data.people || data['people:'] || '',  // Support both 'people' and 'people:' field names
    time: data.time || '',
    place: data.place || '',
    techTags: Array.isArray(data.techTags) ? data.techTags : [],
    content: data.content || [],
    learnings: data.learnings || [],
    images: data.images || null,  // Preserve as-is, can be object or array
    imageCaptions: data.imageCaptions || data.imageCaption || null
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
                display: 'block',
                cssClass: 'project-title'
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
// Only show the row if at least one field has a value
const buildInfoTableRows = (projectData: ProjectData) => {
  const rows: any[] = []
  
  // Check if at least one field has a value
  const hasPeople = projectData.people && projectData.people.trim() !== ''
  const hasTime = projectData.time && projectData.time.trim() !== ''
  const hasPlace = projectData.place && projectData.place.trim() !== ''
  
  // If all three are empty, don't show the row
  if (!hasPeople && !hasTime && !hasPlace) {
    return rows
  }

  // At least one field exists, show the row with "-" for missing fields
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
                content: hasPeople ? projectData.people : '-',
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
                content: hasTime ? projectData.time : '-',
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
                content: hasPlace ? projectData.place : '-',
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
              ...projectData.techTags.map((tag: string) => ({
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
                  textDisplayMode: 'paragraph',
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
                  textDisplayMode: 'paragraph',
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
 * Returns array of components: [Table (Title), Table (Info), VSpace, Table (Content), ImageRow (if images present)]
 * @param data - Project data
 * 
 * Example with images:
 * {
 *   title: 'My Project',
 *   images: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
 *   imageCaptions: 'Shared caption for all three images'  // Will be shown below all images
 * }
 * 
 * Or with individual captions:
 * {
 *   title: 'My Project',
 *   images: ['image1.jpg', 'image2.jpg'],
 *   imageCaptions: ['Caption 1', 'Caption 2']  // Each image gets its own caption
 * }
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

  // Info table (people, time, place) - only add if rows exist
  const infoRows = buildInfoTableRows(projectData)
  if (infoRows.length > 0) {
    components.push({
      type: 'Table',
      data: {
        rows: infoRows,
        cssClass: 'form-table font-cv project-table',
        cssStyle: tableStyle
      }
    })
  }

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

  // Images (if present)
  if (projectData.images) {
    // Add spacing before images
    components.push({
      type: 'VSpace',
      data: { height: 10 }
    })

    // Check if images is an object with src array (single image group)
    // Format: { src: [url1, url2], caption: "text", height: "200px" }
    if (typeof projectData.images === 'object' && !Array.isArray(projectData.images) && 
        projectData.images.src && Array.isArray(projectData.images.src)) {
      const imageRowComponent = processImageDataObject(projectData.images)
      if (imageRowComponent) {
        components.push(imageRowComponent)
      }
    }
    // Check if images is an array
    else if (Array.isArray(projectData.images) && projectData.images.length > 0) {
      // Check if first element is an object with src array (array of image groups)
      const firstItem: any = projectData.images[0]
      if (firstItem && typeof firstItem === 'object' && firstItem.src && Array.isArray(firstItem.src)) {
        // Multiple image groups
        projectData.images.forEach((imgGroup: any) => {
          const imageRowComponent = processImageDataObject(imgGroup)
          if (imageRowComponent) {
            components.push(imageRowComponent)
            components.push({ type: 'VSpace', data: { height: 8 } })
          }
        })
      } else {
        // Array of image sources or {src, caption} objects
        const imageRowData = processImagesWithCaptions(projectData.images, projectData.imageCaptions)
        components.push({
          type: 'ImageRow',
          data: {
            items: imageRowData.items,
            caption: imageRowData.caption,
            align: 'center'
          }
        })
      }
    }
  }

  return components
}

// Export helpers for use in other builders
export { processImagesWithCaptions, processImageDataObject }
