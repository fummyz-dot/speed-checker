const cloudflareNoticePrefix = 'このテストはCloudflareのネットワーク測定基盤を'
const cloudflareNoticeSuffix = '利用します。'
const cloudflareNotice = `${cloudflareNoticePrefix}${cloudflareNoticeSuffix}`

const notices = [
  '測定中はこの画面を開いたままにしてください。',
  '測定中は、速度に応じて一定量のデータ通信が発生します。',
  cloudflareNotice,
  'モバイル回線ではデータ通信量に十分ご注意ください。',
]

export const Notice = () => (
  <aside className="notice" aria-labelledby="notice-title">
    <div className="notice__icon" aria-hidden="true">
      i
    </div>
    <div>
      <h2 id="notice-title">測定前にご確認ください</h2>
      <ul>
        {notices.map((notice) => (
          <li key={notice}>
            {notice === cloudflareNotice ? (
              <>{cloudflareNoticePrefix}<span className="notice__cloudflare-suffix">{cloudflareNoticeSuffix}</span></>
            ) : notice}
          </li>
        ))}
      </ul>
    </div>
  </aside>
)
