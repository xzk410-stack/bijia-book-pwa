package com.bijiabu.app;

import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.KeyEvent;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.browser.auth.AuthTabIntent;

import java.io.File;
import java.io.FileOutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.Comparator;

import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends ComponentActivity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int CLOUD_SAVE_REQUEST = 1002;
    private static final String START_URL = "https://xzk410-stack.github.io/bijia-book-pwa/pricebook/";
    private static final String AUTH_REDIRECT_HOST = "save-radar-gold.vercel.app";
    private static final String AUTH_REDIRECT_PATH = "/login";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private GmsBarcodeScanner barcodeScanner;
    private String pendingCloudFilename;
    private String pendingCloudContent;
    private String pendingCloudMimeType;
    private final ActivityResultLauncher<Intent> authTabLauncher =
            AuthTabIntent.registerActivityResultLauncher(this, this::handleAuthResult);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#F8F4EC"));
        getWindow().setNavigationBarColor(Color.WHITE);

        webView = new WebView(this);
        setContentView(webView);

        GmsBarcodeScannerOptions scannerOptions = new GmsBarcodeScannerOptions.Builder()
                .enableAutoZoom()
                .build();
        barcodeScanner = GmsBarcodeScanning.getClient(this, scannerOptions);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " BijiaBook/1.6.5 (Android)");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if ("file".equalsIgnoreCase(scheme)
                        || "about".equalsIgnoreCase(scheme)
                        || AUTH_REDIRECT_HOST.equalsIgnoreCase(host)) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "無法開啟檔案選擇器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.loadUrl(START_URL);
        loadOAuthCallback(getIntent());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    this::handleAppBack
            );
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadOAuthCallback(intent);
    }

    private void loadOAuthCallback(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri != null
                && "bijiabu".equalsIgnoreCase(uri.getScheme())
                && "auth-callback".equalsIgnoreCase(uri.getHost())) {
            StringBuilder target = new StringBuilder(START_URL);
            if (uri.getEncodedQuery() != null) {
                target.append('?').append(uri.getEncodedQuery());
            }
            if (uri.getEncodedFragment() != null) {
                target.append('#').append(uri.getEncodedFragment());
            }
            webView.loadUrl(target.toString());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            return;
        }
        if (requestCode == CLOUD_SAVE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingCloudContent != null) {
                Uri uri = data.getData();
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("無法寫入選擇的位置");
                    out.write(pendingCloudContent.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "雲端備份已儲存 ✓", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(this, "雲端備份失敗：" + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingCloudFilename = null;
            pendingCloudContent = null;
            pendingCloudMimeType = null;
        }
    }

    private void launchGoogleAuthTab(String url) {
        try {
            Uri authUri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(authUri.getScheme())) {
                throw new IllegalArgumentException("只允許安全登入網址");
            }
            AuthTabIntent authTabIntent = new AuthTabIntent.Builder().build();
            authTabIntent.launch(authTabLauncher, authUri, AUTH_REDIRECT_HOST, AUTH_REDIRECT_PATH);
        } catch (Exception e) {
            Toast.makeText(this, "無法開啟 Google 登入", Toast.LENGTH_SHORT).show();
        }
    }

    private void handleAuthResult(AuthTabIntent.AuthResult result) {
        if (result.resultCode == AuthTabIntent.RESULT_OK && result.resultUri != null) {
            Uri callback = result.resultUri;
            if (!"https".equalsIgnoreCase(callback.getScheme())
                    || !AUTH_REDIRECT_HOST.equalsIgnoreCase(callback.getHost())) {
                Toast.makeText(this, "登入回傳網址不正確，請再試一次", Toast.LENGTH_LONG).show();
                return;
            }

            StringBuilder target = new StringBuilder(START_URL);
            if (callback.getEncodedQuery() != null) {
                target.append('?').append(callback.getEncodedQuery());
            }
            if (callback.getEncodedFragment() != null) {
                target.append('#').append(callback.getEncodedFragment());
            }
            webView.loadUrl(target.toString());
            return;
        }
        if (result.resultCode == AuthTabIntent.RESULT_CANCELED) return;
        Toast.makeText(this, "登入未完成，請再試一次", Toast.LENGTH_LONG).show();
    }

    private void handleAppBack() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return window.handleAndroidBack ? !!window.handleAndroidBack() : false;}catch(e){return false;}})();",
                value -> {
                    if (!"true".equals(value)) finish();
                }
        );
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // 所有 Android 版本都先交給網頁端處理：
        // 關閉彈窗 -> 回首頁 -> 二次返回才離開 App。
        handleAppBack();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // 部分 Samsung 三鍵導覽仍會送出 KEYCODE_BACK，
        // 在這裡攔截可避免 Activity 被系統直接 finish。
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK
                && event.getAction() == KeyEvent.ACTION_UP) {
            handleAppBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void openGoogleLogin(String url) {
            runOnUiThread(() -> launchGoogleAuthTab(url));
        }

        @JavascriptInterface
        public void saveFile(String filename, String content, String mimeType) {
            try {
                Uri uri = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE,
                            mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + File.separator + "比價簿");
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("無法建立下載檔案");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IllegalStateException("無法寫入檔案");
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) throw new IllegalStateException("無法存取下載資料夾");
                    File outFile = new File(dir, filename);
                    try (FileOutputStream out = new FileOutputStream(outFile)) {
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "已儲存到 Downloads/比價簿", Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "匯出失敗：" + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void saveToCloud(String filename, String content, String mimeType) {
            runOnUiThread(() -> {
                try {
                    pendingCloudFilename = (filename == null || filename.isEmpty()) ? "比價簿備份.json" : filename;
                    pendingCloudContent = content == null ? "" : content;
                    pendingCloudMimeType = (mimeType == null || mimeType.isEmpty()) ? "application/json" : mimeType;

                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingCloudMimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingCloudFilename);
                    startActivityForResult(intent, CLOUD_SAVE_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                            "無法開啟雲端儲存位置：" + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void lookupBarcode(String code) {
            final String clean = code == null ? "" : code.trim();
            if (clean.isEmpty()) return;

            new Thread(() -> {
                JSONObject result = new JSONObject();
                try {
                    result.put("code", clean);
                    String encoded = URLEncoder.encode(clean, "UTF-8");
                    String endpoint = "https://world.openfoodfacts.org/api/v3/product/" + encoded
                            + "?product_type=all&lc=zh&cc=tw&fields=code,product_name,product_name_zh,product_name_en,brands,quantity,product_type";

                    HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(6500);
                    conn.setReadTimeout(8500);
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("User-Agent", "BijiaBook/1.4.4 (Android)");

                    int status = conn.getResponseCode();
                    if (status >= 200 && status < 300) {
                        StringBuilder raw = new StringBuilder();
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) raw.append(line);
                        }

                        JSONObject payload = new JSONObject(raw.toString());
                        JSONObject product = payload.optJSONObject("product");
                        if (product != null) {
                            String name = product.optString("product_name", "");
                            if (name.isEmpty()) name = product.optString("product_name_zh", "");
                            if (name.isEmpty()) name = product.optString("product_name_en", "");
                            String brand = product.optString("brands", "");
                            String quantity = product.optString("quantity", "");
                            String productType = product.optString("product_type",
                                    payload.optString("product_type", ""));
                            boolean useful = !name.isEmpty() || !brand.isEmpty() || !quantity.isEmpty();
                            result.put("found", useful);
                            result.put("name", name);
                            result.put("brand", brand);
                            result.put("quantity", quantity);
                            result.put("productType", productType);
                        } else {
                            result.put("found", false);
                        }
                    } else {
                        result.put("found", false);
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    try {
                        result.put("found", false);
                        result.put("error", e.getClass().getSimpleName());
                    } catch (Exception ignored) { }
                }

                final String payloadString = result.toString();
                runOnUiThread(() -> {
                    String js = "window.onBarcodeLookupResult(" + JSONObject.quote(payloadString) + ");";
                    webView.evaluateJavascript(js, null);
                });
            }).start();
        }

        @JavascriptInterface
        public void saveAutoBackup(String label, String content) {
            try {
                File dir = new File(getFilesDir(), "price_backups");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("無法建立備份資料夾");

                File[] existing = dir.listFiles((d, name) -> name.endsWith(".json"));
                if (existing != null && existing.length > 0) {
                    Arrays.sort(existing, Comparator.comparingLong(File::lastModified).reversed());
                    try {
                        String newest = new String(Files.readAllBytes(existing[0].toPath()), StandardCharsets.UTF_8);
                        JSONObject newestObj = new JSONObject(newest);
                        if (content.equals(newestObj.optString("data"))) return;
                    } catch (Exception ignored) { }
                }

                long now = System.currentTimeMillis();
                JSONObject wrapper = new JSONObject();
                wrapper.put("time", now);
                wrapper.put("label", label == null || label.isEmpty() ? "自動備份" : label);
                wrapper.put("data", content);
                File file = new File(dir, now + "_" + Math.abs(content.hashCode()) + ".json");
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(wrapper.toString().getBytes(StandardCharsets.UTF_8));
                }

                File[] backups = dir.listFiles((d, name) -> name.endsWith(".json"));
                if (backups != null && backups.length > 30) {
                    Arrays.sort(backups, Comparator.comparingLong(File::lastModified).reversed());
                    for (int i = 30; i < backups.length; i++) backups[i].delete();
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "自動備份失敗：" + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public String listAutoBackups() {
            JSONArray arr = new JSONArray();
            try {
                File dir = new File(getFilesDir(), "price_backups");
                File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
                if (files == null) return arr.toString();
                Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
                for (File f : files) {
                    try {
                        String raw = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
                        JSONObject wrapper = new JSONObject(raw);
                        JSONObject item = new JSONObject();
                        item.put("id", f.getName());
                        item.put("timeMs", wrapper.optLong("time", f.lastModified()));
                        item.put("label", wrapper.optString("label", "自動備份"));
                        arr.put(item);
                    } catch (Exception ignored) { }
                }
            } catch (Exception ignored) { }
            return arr.toString();
        }

        @JavascriptInterface
        public String readAutoBackup(String id) {
            try {
                if (id == null || id.contains("/") || id.contains("\\")) return "";
                File file = new File(new File(getFilesDir(), "price_backups"), id);
                if (!file.exists()) return "";
                String raw = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
                return new JSONObject(raw).optString("data", "");
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void startBarcodeScan() {
            runOnUiThread(() -> {
                if (barcodeScanner == null) {
                    Toast.makeText(MainActivity.this, "條碼掃描器尚未就緒", Toast.LENGTH_SHORT).show();
                    return;
                }
                barcodeScanner.startScan()
                        .addOnSuccessListener(barcode -> {
                            String raw = barcode.getRawValue();
                            if (raw == null || raw.trim().isEmpty()) {
                                Toast.makeText(MainActivity.this, "沒有讀到條碼內容", Toast.LENGTH_SHORT).show();
                                return;
                            }
                            String js = "window.onBarcodeScanned(" + JSONObject.quote(raw.trim()) + ");";
                            webView.evaluateJavascript(js, null);
                        })
                        .addOnCanceledListener(() -> { })
                        .addOnFailureListener(e -> Toast.makeText(MainActivity.this,
                                "掃描失敗：" + (e.getMessage() == null ? "請再試一次" : e.getMessage()),
                                Toast.LENGTH_LONG).show());
            });
        }

        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> {
                try {
                    Uri uri = Uri.parse(url);
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "無法開啟網頁", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String getAppIcon() {
            return getSharedPreferences("bijia_settings", MODE_PRIVATE)
                    .getString("app_icon", "cat1");
        }

        @JavascriptInterface
        public void setAppIcon(String iconId) {
            runOnUiThread(() -> {
                String[] ids = {"cat1", "cat2", "rabbit1", "rabbit2", "bear1", "hamster", "bear2", "helper", "girl"};
                String[] aliases = {"IconCat1", "IconCat2", "IconRabbit1", "IconRabbit2", "IconBear1", "IconHamster", "IconBear2", "IconHelper", "IconGirl"};
                int selected = 0;
                for (int i = 0; i < ids.length; i++) if (ids[i].equals(iconId)) selected = i;
                try {
                    PackageManager pm = getPackageManager();
                    for (int i = 0; i < aliases.length; i++) {
                        ComponentName component = new ComponentName(MainActivity.this,
                                getPackageName() + "." + aliases[i]);
                        pm.setComponentEnabledSetting(component,
                                i == selected ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                                        : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                                PackageManager.DONT_KILL_APP);
                    }
                    getSharedPreferences("bijia_settings", MODE_PRIVATE).edit()
                            .putString("app_icon", ids[selected]).apply();
                    Toast.makeText(MainActivity.this, "App 圖示已更換 ✓", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "圖示切換失敗：" + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }
}
