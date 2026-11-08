/**
 * Shared component mapping for pagination and print preview
 * This ensures all components are consistently available in both contexts
 */

import Text from './component/Text.vue'
import TextList from './component/TextList.vue'
import TextRow from './component/TextRow.vue'
import ImageRow from './component/ImageRow.vue'
import Image from './component/Image.vue'
import Tr from './component/TableTr.vue'
import Td from './component/TableTd.vue'
import Table from './component/Table.vue'
import VSpace from './component/VSpace.vue'
import PageBreak from './component/PageBreak.vue'
import BasicInfoJp from '../content/CvJp/BasicInfoJp.vue'
import ProjectJp from '../content/CvJp/ProjectJp.vue'
import Title from '../content/CvJp/Title.vue'

const COMPONENT_MAP = {
  'Text': Text,
  'TextList': TextList,
  'TextRow': TextRow,
  'ImageRow': ImageRow,
  'Image': Image,
  'Tr': Tr,
  'Td': Td,
  'Table': Table,
  'VSpace': VSpace,
  'PageBreak': PageBreak,
  'BasicInfoJp': BasicInfoJp,
  'ProjectJp': ProjectJp,
  'Title': Title
}

/**
 * Get Vue component by type string
 * @param {string} type - Component type name
 * @returns {Component|null} Vue component or null if not found
 */
export function getComponent(type) {
  return COMPONENT_MAP[type] || null
}

/**
 * Get all registered component types
 * @returns {string[]} Array of component type names
 */
export function getComponentTypes() {
  return Object.keys(COMPONENT_MAP)
}
