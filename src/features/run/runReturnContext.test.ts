import { describe, expect, it } from 'vitest'
import {
  consumeRunReturnContext,
  loadRunReturnContext,
  RUN_RETURN_CONTEXT_STORAGE_KEY,
  saveRunReturnContext,
} from './runReturnContext'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

describe('Run Return Context sessionStorage', () => {
  it('measurement idだけをv1形式で保存して読み込む', () => {
    const storage = new MemoryStorage()

    expect(saveRunReturnContext('measurement-1', storage)).toEqual({
      version: 1,
      measurementId: 'measurement-1',
    })
    expect(loadRunReturnContext(storage)).toEqual({
      version: 1,
      measurementId: 'measurement-1',
    })
    expect(JSON.parse(storage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      measurementId: 'measurement-1',
    })
  })

  it.each([
    ['invalid JSON', '{'],
    ['wrong version', JSON.stringify({ version: 2, measurementId: 'measurement-1' })],
    ['empty id', JSON.stringify({ version: 1, measurementId: '' })],
    ['non-string id', JSON.stringify({ version: 1, measurementId: 1 })],
    ['unknown field', JSON.stringify({ version: 1, measurementId: 'measurement-1', score: 1 })],
  ])('不正な%sを拒否して削除する', (_caseName, value) => {
    const storage = new MemoryStorage()
    storage.setItem(RUN_RETURN_CONTEXT_STORAGE_KEY, value)

    expect(loadRunReturnContext(storage)).toBeNull()
    expect(storage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY)).toBeNull()
  })

  it('consume後にcontextを削除する', () => {
    const storage = new MemoryStorage()
    saveRunReturnContext('measurement-1', storage)

    expect(consumeRunReturnContext(storage)).toEqual({ version: 1, measurementId: 'measurement-1' })
    expect(consumeRunReturnContext(storage)).toBeNull()
    expect(storage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY)).toBeNull()
  })

  it('sessionStorageが利用できなくても例外を伝播しない', () => {
    const storage = new MemoryStorage()
    storage.getItem = () => { throw new Error('blocked') }
    storage.setItem = () => { throw new Error('blocked') }
    storage.removeItem = () => { throw new Error('blocked') }

    expect(saveRunReturnContext('measurement-1', storage)).toBeNull()
    expect(loadRunReturnContext(storage)).toBeNull()
    expect(consumeRunReturnContext(storage)).toBeNull()
  })
})
