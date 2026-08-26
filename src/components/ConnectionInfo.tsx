import { useConnectionInfo } from '../hooks/useConnectionInfo'

export const ConnectionInfo = () => {
  const { state, retry } = useConnectionInfo()

  if (state.status === 'loading') {
    return (
      <section className="connection-info connection-info--loading" aria-labelledby="connection-title">
        <div>
          <span className="connection-info__eyebrow">NETWORK</span>
          <h2 id="connection-title">接続情報</h2>
        </div>
        <p className="connection-info__status" role="status" aria-live="polite">
          接続元ネットワークを確認しています…
        </p>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="connection-info" aria-labelledby="connection-title">
        <div>
          <span className="connection-info__eyebrow">NETWORK</span>
          <h2 id="connection-title">接続情報</h2>
        </div>
        <div className="connection-info__error" role="alert">
          <span>{state.message} 速度測定は通常どおり利用できます。</span>
          <button type="button" onClick={retry}>再取得</button>
        </div>
      </section>
    )
  }

  const { data } = state
  const location = [data.city || data.region, data.country].filter(Boolean).join(' / ')
  const provider = data.provider ?? '取得できませんでした'

  return (
    <section className="connection-info" aria-labelledby="connection-title">
      <div className="connection-info__heading">
        <span className="connection-info__eyebrow">NETWORK</span>
        <h2 id="connection-title">接続情報</h2>
      </div>
      <div className="connection-info__primary">
        <span>接続元ネットワーク</span>
        <strong>{provider}</strong>
      </div>
      <dl className="connection-info__details">
        {data.asn !== null && <div><dt>AS番号</dt><dd>AS{data.asn}</dd></div>}
        {location && <div><dt>地域</dt><dd>{location}</dd></div>}
        {data.cloudflareColo && <div><dt>Cloudflare拠点</dt><dd>Cloudflare {data.cloudflareColo}</dd></div>}
        {data.protocol && <div><dt>プロトコル</dt><dd>{data.protocol}</dd></div>}
        {data.edgeRttMs !== null && (
          <div className="connection-info__edge-rtt">
            <dt>Cloudflare Edge RTT</dt>
            <dd>
              {Math.round(data.edgeRttMs)} ms
              {data.edgeRttTransport && ` · ${data.edgeRttTransport}`}
            </dd>
            <small>Cloudflare観測値。速度測定のPingとは別です。</small>
          </div>
        )}
      </dl>
      <p className="connection-info__note">
        Cloudflareが接続元のASN情報から判定しています。VPN・プロキシ・法人回線では実際の契約プロバイダと異なる場合があります。
      </p>
      <button className="connection-info__retry" type="button" onClick={retry}>再取得</button>
    </section>
  )
}
