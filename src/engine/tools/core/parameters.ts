import type { ToolParameterValue, ToolParameterValues } from '@/domain/types'

export function numberParameter(values: ToolParameterValues, key: string, fallback: number): number {
  const value = values[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function stringParameter(values: ToolParameterValues, key: string, fallback: string): string {
  const value = values[key]
  return typeof value === 'string' ? value : fallback
}

export function mergeParameters(defaults: ToolParameterValues, values: ToolParameterValues): ToolParameterValues {
  return { ...defaults, ...values }
}

export function cloneParameters(values: ToolParameterValues): ToolParameterValues {
  const result: ToolParameterValues = {}
  for (const [key, value] of Object.entries(values)) result[key] = value as ToolParameterValue
  return result
}
