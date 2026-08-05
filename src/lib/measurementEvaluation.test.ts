import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { evaluateUseCases, generateMeasurementComment } from './measurementEvaluation'

const result = (
  downloadMbps: number,
  uploadMbps: number,
  pingMs: number | null,
): SpeedMeasurementResult => ({
  id: 'test', measuredAt: '2026-08-03T12:00:00.000Z', downloadMbps, uploadMbps, pingMs,
})

describe('evaluateUseCases', () => {
  it.each([
    [0.99, 'difficult'], [1, 'available'], [1.01, 'available'],
    [4.99, 'available'], [5, 'comfortable'], [5.01, 'comfortable'],
  ] as const)('Web閲覧の下り %s Mbps を %s と評価する', (download, level) => {
    expect(evaluateUseCases(result(download, 20, 20))[0].level).toBe(level)
  })

  it.each([
    [4.99, 'difficult'], [5, 'available'], [5.01, 'available'],
    [24.99, 'available'], [25, 'comfortable'], [25.01, 'comfortable'],
  ] as const)('動画の下り %s Mbps を %s と評価する', (download, level) => {
    expect(evaluateUseCases(result(download, 20, 20))[1].level).toBe(level)
  })

  it('Web会議の送受信速度とPingの境界値を評価する', () => {
    expect(evaluateUseCases(result(10, 5, 80))[2].level).toBe('comfortable')
    expect(evaluateUseCases(result(9.99, 5, 80))[2].level).toBe('available')
    expect(evaluateUseCases(result(3, 3, 150))[2].level).toBe('available')
    expect(evaluateUseCases(result(3, 3, 150.01))[2].level).toBe('difficult')
  })

  it('ゲームの送受信速度とPingの境界値を評価する', () => {
    expect(evaluateUseCases(result(5, 1, 50))[3].level).toBe('comfortable')
    expect(evaluateUseCases(result(4.99, 1, 50))[3].level).toBe('available')
    expect(evaluateUseCases(result(3, 1, 100))[3].level).toBe('available')
    expect(evaluateUseCases(result(3, 1, 100.01))[3].level).toBe('difficult')
  })

  it.each([
    [4.99, 'difficult'], [5, 'available'], [5.01, 'available'],
    [19.99, 'available'], [20, 'comfortable'], [20.01, 'comfortable'],
  ] as const)('ファイル送信の上り %s Mbps を %s と評価する', (upload, level) => {
    expect(evaluateUseCases(result(100, upload, 20))[4].level).toBe(level)
  })

  it('Pingなしでは速度だけの参考評価にする', () => {
    const evaluations = evaluateUseCases(result(100, 100, null))
    expect(evaluations[3]).toMatchObject({ level: 'comfortable', detail: '速度のみの参考評価' })
  })

  it('必要な測定値がない場合は判定不可にする', () => {
    const evaluations = evaluateUseCases({ pingMs: null })
    expect(evaluations.every((evaluation) => evaluation.level === 'unknown')).toBe(true)
  })
})

describe('generateMeasurementComment', () => {
  it('十分な値では明確な不足がないと表示する', () => {
    const comment = generateMeasurementComment(result(25, 5, 80))
    expect(comment.status).toBe('good')
    expect(comment.message).toContain('明確な不足は見当たりません')
  })

  it.each([
    [result(4, 10, 30), 'ダウンロード速度が低め'],
    [result(50, 2, 30), 'アップロード速度が低め'],
    [result(50, 10, 81), '応答時間が長め'],
  ] as const)('単一の注意点を安全に説明する', (measurement, expected) => {
    expect(generateMeasurementComment(measurement).message).toContain(expected)
  })

  it('複数項目が低い場合も提案を2件以内にする', () => {
    const comment = generateMeasurementComment(result(1, 1, 200))
    expect(comment.status).toBe('limited')
    expect(comment.suggestions).toHaveLength(2)
  })

  it('不完全な測定を十分に評価しない', () => {
    expect(generateMeasurementComment({ downloadMbps: 10 }).status).toBe('unknown')
  })

  it.each(['故障', '原因は', '異常'])('コメントに禁止表現「%s」を含めない', (prohibited) => {
    const comments = [
      generateMeasurementComment(result(100, 100, 10)),
      generateMeasurementComment(result(1, 1, 200)),
      generateMeasurementComment({}),
    ]
    expect(comments.map((comment) => comment.message).join(' ')).not.toContain(prohibited)
  })
})
