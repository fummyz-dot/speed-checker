(() => {
  'use strict'

  const live = document.getElementById('ranking-live')
  const status = document.getElementById('ranking-status')
  const day = document.getElementById('ranking-day')
  const scoreVersion = document.getElementById('ranking-score-version')
  const totalRuns = document.getElementById('ranking-total-runs')
  const medianScore = document.getElementById('ranking-median-score')
  const top10Score = document.getElementById('ranking-top10-score')
  const top3 = document.getElementById('ranking-top3')
  const championSource = document.getElementById('ranking-champion-source')
  const championScore = document.getElementById('ranking-champion-score')
  const championDownload = document.getElementById('ranking-champion-download')
  const championUpload = document.getElementById('ranking-champion-upload')
  const championRuns = document.getElementById('ranking-champion-runs')
  const championDescription = document.getElementById('ranking-champion-description')
  const recentDays = document.getElementById('ranking-recent-days')
  const retry = document.getElementById('ranking-retry')
  let isLoading = false

  const isNonNegativeSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0
  const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0
  const isRankingDay = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, date] = value.split('-').map(Number)
    if (month < 1 || month > 12 || date < 1) return false
    const monthDays = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date <= monthDays[month - 1]
  }
  const isNullableNonNegativeSafeInteger = (value) => value === null || isNonNegativeSafeInteger(value)
  const isChampion = (value) => value !== null
    && typeof value === 'object'
    && (value.source === 'previous_day_winner' || value.source === 'fallback')
    && (value.sourceDay === null || isRankingDay(value.sourceDay))
    && isNullableNonNegativeSafeInteger(value.scoreTenths)
    && isNonNegativeSafeInteger(value.downloadTenths)
    && isNonNegativeSafeInteger(value.uploadTenths)
    && isNonNegativeSafeInteger(value.qualifyingRuns)
  const isOverview = (value) => value !== null
    && typeof value === 'object'
    && value.ok === true
    && isRankingDay(value.rankingDay)
    && isPositiveSafeInteger(value.scoreVersion)
    && isNonNegativeSafeInteger(value.totalRuns)
    && isNullableNonNegativeSafeInteger(value.medianScoreTenths)
    && isNullableNonNegativeSafeInteger(value.top10ThresholdTenths)
    && Array.isArray(value.top3)
    && value.top3.length <= 3
    && value.top3.every((entry) => entry !== null
      && typeof entry === 'object'
      && isPositiveSafeInteger(entry.rank)
      && isNonNegativeSafeInteger(entry.scoreTenths))
    && Array.isArray(value.recentDays)
    && value.recentDays.length === 7
    && value.recentDays.every((entry) => entry !== null
      && typeof entry === 'object'
      && isRankingDay(entry.rankingDay)
      && isNonNegativeSafeInteger(entry.totalRuns))
    && isChampion(value.champion)
  const formatScore = (tenths) => (tenths / 10).toFixed(1)
  const formatMbps = (tenths) => `${(tenths / 10).toFixed(1)} Mbps`
  const formatRuns = (count) => `${count.toLocaleString('ja-JP')}出走`
  const formatRankingDay = (value) => {
    const [year, month, date] = value.split('-')
    return `${year}年${Number(month)}月${Number(date)}日`
  }
  const formatRecentDay = (value) => {
    const [, month, date] = value.split('-')
    return `${Number(month)}/${Number(date)}`
  }
  const setLoading = () => {
    live.setAttribute('aria-busy', 'true')
    status.textContent = '集計データを読み込んでいます…'
    retry.hidden = true
  }
  const setError = () => {
    live.setAttribute('aria-busy', 'false')
    status.textContent = 'ランキングデータを取得できませんでした。時間をおいて再度お試しください。'
    retry.hidden = false
  }
  const renderTop3 = (entries) => {
    const items = entries.map((entry) => {
      const item = document.createElement('li')
      const rank = document.createElement('span')
      const score = document.createElement('span')
      rank.textContent = `${entry.rank}位`
      score.textContent = formatScore(entry.scoreTenths)
      item.append(rank, score)
      return item
    })
    if (items.length === 0) {
      const item = document.createElement('li')
      item.textContent = 'まだ出走がありません。'
      items.push(item)
    }
    top3.replaceChildren(...items)
  }
  const renderRecentDays = (entries) => {
    const orderedEntries = [...entries].sort((left, right) => left.rankingDay.localeCompare(right.rankingDay))
    const maxRuns = Math.max(1, ...orderedEntries.map((entry) => entry.totalRuns))
    const rows = orderedEntries.map((entry) => {
      const row = document.createElement('div')
      const label = document.createElement('time')
      const progress = document.createElement('progress')
      const count = document.createElement('span')
      row.className = 'ranking-recent__row'
      label.dateTime = entry.rankingDay
      label.textContent = formatRecentDay(entry.rankingDay)
      progress.max = maxRuns
      progress.value = entry.totalRuns
      count.textContent = formatRuns(entry.totalRuns)
      row.append(label, progress, count)
      return row
    })
    recentDays.replaceChildren(...rows)
  }
  const renderChampion = (champion) => {
    championDownload.textContent = formatMbps(champion.downloadTenths)
    championUpload.textContent = formatMbps(champion.uploadTenths)
    if (champion.source === 'previous_day_winner') {
      championSource.textContent = '昨日の全国1位'
      championScore.textContent = formatScore(champion.scoreTenths)
      championRuns.textContent = formatRuns(champion.qualifyingRuns)
      championDescription.textContent = '昨日の全国1位を、本日の回線速度レースの比較基準として使用しています。'
      return
    }
    championSource.textContent = '固定基準'
    championScore.textContent = '—'
    championRuns.textContent = '—'
    championDescription.textContent = '前日の有効出走が基準に満たない場合は、固定基準を回線速度レースの比較対象として使用します。'
  }
  const render = (overview) => {
    day.dateTime = overview.rankingDay
    day.textContent = formatRankingDay(overview.rankingDay)
    scoreVersion.textContent = `Score version: ${overview.scoreVersion}`
    totalRuns.textContent = formatRuns(overview.totalRuns)
    medianScore.textContent = overview.medianScoreTenths === null ? '—' : formatScore(overview.medianScoreTenths)
    top10Score.textContent = overview.top10ThresholdTenths === null ? '—' : formatScore(overview.top10ThresholdTenths)
    renderTop3(overview.top3)
    renderChampion(overview.champion)
    renderRecentDays(overview.recentDays)
    live.setAttribute('aria-busy', 'false')
    status.textContent = `${formatRankingDay(overview.rankingDay)}の集計を表示しています。`
  }
  const load = async () => {
    if (isLoading) return
    isLoading = true
    setLoading()
    try {
      const response = await fetch('/api/ranking/overview', {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      })
      const overview = await response.json()
      if (!response.ok || !isOverview(overview)) throw new Error('Invalid ranking overview')
      render(overview)
    } catch {
      setError()
    } finally {
      isLoading = false
    }
  }

  retry.addEventListener('click', load)
  void load()
})()
