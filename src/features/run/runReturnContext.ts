export const RUN_RETURN_CONTEXT_STORAGE_KEY = 'net-speed-run-return-v1'

export interface RunReturnContext {
  version: 1
  measurementId: string
}

const getBrowserSessionStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const isValidRunReturnContext = (value: unknown): value is RunReturnContext => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  const context = value as Partial<RunReturnContext>
  return keys.length === 2
    && keys.includes('version')
    && keys.includes('measurementId')
    && context.version === 1
    && typeof context.measurementId === 'string'
    && context.measurementId.length > 0
}

const removeRunReturnContext = (storage: Storage | null): void => {
  if (!storage) return
  try {
    storage.removeItem(RUN_RETURN_CONTEXT_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export const saveRunReturnContext = (
  measurementId: string,
  storage: Storage | null = getBrowserSessionStorage(),
): RunReturnContext | null => {
  const context: RunReturnContext = { version: 1, measurementId }
  if (!storage || !isValidRunReturnContext(context)) return null

  try {
    storage.setItem(RUN_RETURN_CONTEXT_STORAGE_KEY, JSON.stringify(context))
    return context
  } catch {
    return null
  }
}

export const loadRunReturnContext = (
  storage: Storage | null = getBrowserSessionStorage(),
): RunReturnContext | null => {
  if (!storage) return null

  try {
    const raw = storage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (isValidRunReturnContext(value)) return value
  } catch {
    // Invalid or unavailable values are rejected and removed below when possible.
  }
  removeRunReturnContext(storage)
  return null
}

export const consumeRunReturnContext = (
  storage: Storage | null = getBrowserSessionStorage(),
): RunReturnContext | null => {
  const context = loadRunReturnContext(storage)
  if (context) removeRunReturnContext(storage)
  return context
}
