比價簿 Android App

目前版本：1.4.0

重點：
1. GitHub repository 的程式碼會持續保留，除非你自己刪除 repository / 帳號。
2. GitHub Actions 產出的 artifact 有保存期限；本專案已改成每個版本自動建立 GitHub Release，APK 會放在 Release 裡做長期版本留存。
3. App 內價格資料主要存在手機本機；刪除 App 可能會一併刪除資料。
4. App 內會自動保留最近 30 份本機版本備份。
5. 設定頁的「備份到雲端」可叫出 Android 系統檔案儲存器，可自行選 Google Drive、OneDrive 等雲端位置。
6. 同一商品可以綁多個條碼。掃到新條碼時可：
   - 直接綁到既有商品
   - 自己建立新商品
   - 先查公開商品資料庫，自動帶入可取得的名稱、品牌、規格
7. 公開條碼資料可能不完整，因此自動查不到時仍可手動建立一次；之後 App 會用自己的條碼資料辨識。

更新方式：
把本專案內容上傳覆蓋 GitHub bijia-book repository。
推送到 main 後，GitHub Actions 會自動建置 APK。
成功後，除了 Actions artifact，也會在 Releases 建立/更新 v1.4.0 的 APK。
