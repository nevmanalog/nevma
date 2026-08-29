import type { PhysicalToolId, ToolParameterValues } from '@/domain/types'

export interface ReferenceImage {
  id: string
  source: string
  scaleMicronsPerPixel?: number
  lighting?: 'flat' | 'raking' | 'transmitted' | 'unknown'
  notes?: string
}

export interface MaterialObservation {
  property: string
  value: number
  tolerance: number
  unit: string
}

export interface ReferenceProfile {
  id: string
  revision: number
  tool: PhysicalToolId
  images: ReferenceImage[]
  observations: MaterialObservation[]
  parameterOverrides: ToolParameterValues
}
