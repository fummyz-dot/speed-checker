
// Upper bound from useSpeedTest: about 97 MB down and 97 MB up.
const notices = [
  '測定中はこの画面を開いたままにしてください。',
  '1回の測定で最大200MBほど通信します。モバイル回線ではご注意ください。',
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
