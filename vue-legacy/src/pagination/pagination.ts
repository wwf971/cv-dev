


// a doc concists of a list of paginateable components
export interface PaginateableComponent {
  canSplit(): boolean       // whether the component is allowed to split
  getHeight(): number       // returns current rendered height
  getSplitPosition?(): number // optional: where to split

}

export type DocContext = {
  containerId: string, // used to locate the root container of the doc
}

export type PageContext = {
  pageIndex: number
  pageStartY: number | null // relative to doc container's top edge, null if not determined yet
  pageEndY: number | null, // page's physical bottom edge, relative to doc container's top edge, null if not determined yet
  pageBottomY: number | null, // top edge of bottom padding (where content should stop), null if not determined yet
  pageHeight: number,
  padding: PagePadding
}

export type PagePadding = {
  top: number
  bottom: number
  left: number
  right: number
}

function getVueComponentOfType(type: string) {
  // return components that support pagination based on type
  switch(type) {
    // case 'Text':
    //   return new Text()
    // case 'TrCrossPage':
    //   return new TrCrossPage()
    // case 'AlignToPageBegin':
    //   return new AlignToPageBegin()
    default:
      return null
  }

}

function runPagination(docData, pageData, apis) {
  // every time, fetch one component from the docData
  const {
    appendEmptyPage,
    trySplit,
  } = apis
  
  // clear pageData
  pageData.clear()
  let compIndexCurrent = 0

  while(true) { // loop for creating new pages
    const {pageIndexCurrent, pageDataCurrent} = appendEmptyPage(pageData)    
    while(true) { // loop for putting components to page
      compIndexCurrent++
      // pop one component from the head of docData
      let compDataCurrent = docData.shift()
      if(!compDataCurrent) {
        break
      }

      // put compDataCurrent to pageDataCurrent
      pageDataCurrent.add(compDataCurrent)
      const compDataAfterSplitTrialList = trySplit(compDataCurrent)

      if(compDataAfterSplitTrialList.length === 1) {
        pageDataCurrent.remove(compDataCurrent)
        pageDataCurrent.add(compDataAfterSplitTrialList[0])
        continue
      }else if(compDataAfterSplitTrialList.length > 1) {
        pageDataCurrent.add(compDataAfterSplitTrialList[0])
        // push the rest of compDataAfterSplitTrialList to the head of docData
        docData.unshift(...compDataAfterSplitTrialList.slice(1))
        break
      }else{
        // report error
      }
    }
  }
}