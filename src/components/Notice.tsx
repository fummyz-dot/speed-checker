const notices = [
  '測定中は、速度に応じて一定量のデータ通信が発生します。',
  'このテストはCloudflareのネットワーク測定基盤を利用します。',
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
          <li key={notice}>{notice}</li>
        ))}
      </ul>
    </div>
  </aside>
)
