# 比價簿 Android

套件名稱固定為 `com.bijiabu.app`。版本更新時不可變更套件名稱，也必須使用既有的私人簽署金鑰，才會覆蓋舊版並保留 App 資料。

正式版簽署資訊只從環境變數讀取，請勿將金鑰或密碼提交到版本庫：

- `BIJIABU_KEYSTORE`
- `BIJIABU_STORE_PASSWORD`
- `BIJIABU_KEY_ALIAS`
- `BIJIABU_KEY_PASSWORD`

目前網頁入口為 `https://xzk410-stack.github.io/bijia-book-pwa/pricebook/`。Android 的 Google 登入會由安全瀏覽器開啟；HTTPS 回呼頁收到結果後，會用 `bijiabu://auth-callback` 深層連結自動喚回原本的 App，再把登入結果載入 WebView。
