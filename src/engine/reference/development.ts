import type { PhysicalToolId, ReferenceBinding, ToolParameterValue, ToolParameterValues } from '@/domain/types'
import type { ReferenceProfile } from './types'

class ReferenceDevelopment {
  private readonly profiles = new Map<string, ReferenceProfile>()
  private readonly active = new Map<PhysicalToolId, string>()
  private readonly listeners = new Set<() => void>()
  private currentVersion = 0

  private changed(): void {
    this.currentVersion += 1
    for (const listener of this.listeners) listener()
  }

  register(profile: ReferenceProfile): void {
    this.profiles.set(profile.id, {
      ...profile,
      images: profile.images.map((image) => ({ ...image })),
      observations: profile.observations.map((observation) => ({ ...observation })),
      parameterOverrides: { ...profile.parameterOverrides },
    })
    this.changed()
  }

  activate(tool: PhysicalToolId, profileId: string | null): void {
    if (profileId === null) {
      this.active.delete(tool)
      return
    }
    const profile = this.profiles.get(profileId)
    if (!profile || profile.tool !== tool) throw new Error(`Reference profile ${profileId} does not belong to ${tool}`)
    this.active.set(tool, profileId)
  }

  binding(tool: PhysicalToolId): ReferenceBinding | undefined {
    const profileId = this.active.get(tool)
    if (!profileId) return undefined
    const profile = this.profiles.get(profileId)
    return profile ? { profileId, revision: profile.revision } : undefined
  }

  resolve(tool: PhysicalToolId, base: ToolParameterValues, binding?: ReferenceBinding): ToolParameterValues {
    if (!binding) return { ...base }
    const profile = this.profiles.get(binding.profileId)
    if (!profile || profile.tool !== tool) return { ...base }
    return { ...base, ...profile.parameterOverrides }
  }

  tune(profileId: string, key: string, value: ToolParameterValue): void {
    const profile = this.profiles.get(profileId)
    if (!profile) throw new Error(`Unknown reference profile ${profileId}`)
    profile.parameterOverrides = { ...profile.parameterOverrides, [key]: value }
    profile.revision += 1
    this.changed()
  }

  version(): number {
    return this.currentVersion
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot(): ReferenceProfile[] {
    return Array.from(this.profiles.values()).map((profile) => ({
      ...profile,
      images: profile.images.map((image) => ({ ...image })),
      observations: profile.observations.map((observation) => ({ ...observation })),
      parameterOverrides: { ...profile.parameterOverrides },
    }))
  }
}

export const referenceDevelopment = new ReferenceDevelopment()

declare global {
  interface Window {
    __REFERENCE_DEVELOPMENT__?: ReferenceDevelopment
  }
}

// Only expose the dev calibration handle on a real Window. Guard both the env
// flag (absent under Node/test harnesses) and `window` (absent inside Workers)
// so the engine registry can be imported off the main thread.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  Object.defineProperty(window, '__REFERENCE_DEVELOPMENT__', {
    value: referenceDevelopment,
    configurable: true,
  })
}
