package com.xzk410.spendbook;

import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.browser.auth.AuthTabIntent;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends ComponentActivity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String START_URL = "https://xzk410-stack.github.io/bijia-book-pwa/spendbook/";
    private static final String APP_HOST = "xzk410-stack.github.io";
    private static final String APP_PATH_PREFIX = "/bijia-book-pwa/spendbook/";
    private static final String AUTH_REDIRECT_HOST = "save-radar-gold.vercel.app";
    private static final String AUTH_REDIRECT_PATH = "/login";
    private static final String AUTH_PREFS = "spendbook_auth_session";

    private WebView webView;
    private FrameLayout root;
    private ValueCallback<Uri[]> filePathCallback;
    private volatile String currentPageUrl = START_URL;
    private final ActivityResultLauncher<Intent> authTabLauncher =
            AuthTabIntent.registerActivityResultLauncher(this, this::handleAuthResult);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#F7F7FB"));
        getWindow().setNavigationBarColor(Color.WHITE);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F7F7FB"));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int topInset = Math.max(insets.getSystemWindowInsetTop(), 0);
            int bottomInset = Math.max(insets.getSystemWindowInsetBottom(), 0);
            view.setPadding(0, topInset, 0, bottomInset);
            return insets;
        });
        root.requestApplyInsets();

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
        settings.setUserAgentString(settings.getUserAgentString() + " Spendbook/1.0.0 (Android)");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                currentPageUrl = url == null ? "" : url;
                super.onPageFinished(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if ("about".equalsIgnoreCase(scheme)
                        || "file".equalsIgnoreCase(scheme)
                        || APP_HOST.equalsIgnoreCase(host)
                        || AUTH_REDIRECT_HOST.equalsIgnoreCase(host)) {
                    return false;
                }
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (Exception ignored) { }
                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
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
                    this::handleAppBack);
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
                && "spendbook".equalsIgnoreCase(uri.getScheme())
                && "auth-callback".equalsIgnoreCase(uri.getHost())) {
            StringBuilder target = new StringBuilder(START_URL);
            if (uri.getEncodedQuery() != null) target.append('?').append(uri.getEncodedQuery());
            if (uri.getEncodedFragment() != null) target.append('#').append(uri.getEncodedFragment());
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
        }
    }

    private void launchGoogleAuthTab(String url) {
        try {
            Uri authUri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(authUri.getScheme())) throw new IllegalArgumentException();
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
            if (callback.getEncodedQuery() != null) target.append('?').append(callback.getEncodedQuery());
            if (callback.getEncodedFragment() != null) target.append('#').append(callback.getEncodedFragment());
            webView.loadUrl(target.toString());
            return;
        }
        if (result.resultCode == AuthTabIntent.RESULT_CANCELED) return;
        Toast.makeText(this, "登入未完成，請再試一次", Toast.LENGTH_LONG).show();
    }

    private void handleAppBack() {
        if (webView == null) { finish(); return; }
        webView.evaluateJavascript(
                "(function(){try{return window.handleAndroidBack ? !!window.handleAndroidBack() : false;}catch(e){return false;}})();",
                value -> { if (!"true".equals(value)) finish(); });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { handleAppBack(); }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            handleAppBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private boolean isTrustedSpendbookPage() {
        try {
            Uri uri = Uri.parse(currentPageUrl == null ? "" : currentPageUrl);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && APP_HOST.equalsIgnoreCase(uri.getHost())
                    && uri.getPath() != null
                    && uri.getPath().startsWith(APP_PATH_PREFIX);
        } catch (Exception e) { return false; }
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void saveAuthSession(String accessToken, String refreshToken) {
            if (!isTrustedSpendbookPage()) return;
            if (accessToken == null || accessToken.isEmpty() || refreshToken == null || refreshToken.isEmpty()) return;
            getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).edit()
                    .putString("access_token", accessToken)
                    .putString("refresh_token", refreshToken)
                    .apply();
        }

        @JavascriptInterface
        public String loadAuthSession() {
            if (!isTrustedSpendbookPage()) return "{}";
            try {
                SharedPreferences prefs = getSharedPreferences(AUTH_PREFS, MODE_PRIVATE);
                JSONObject out = new JSONObject();
                out.put("access_token", prefs.getString("access_token", ""));
                out.put("refresh_token", prefs.getString("refresh_token", ""));
                return out.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void clearAuthSession() {
            if (!isTrustedSpendbookPage()) return;
            getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).edit().clear().apply();
        }

        @JavascriptInterface
        public void openGoogleLogin(String url) {
            runOnUiThread(() -> launchGoogleAuthTab(url));
        }

        @JavascriptInterface
        public void saveFile(String filename, String content, String mimeType) {
            try {
                if (!isTrustedSpendbookPage()) return;
                if (filename == null || filename.trim().isEmpty()) filename = "我的消費簿備份.json";
                if (content == null) content = "";
                if (mimeType == null || mimeType.isEmpty()) mimeType = "application/json";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + File.separator + "我的消費簿");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
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
                        "已儲存到 Downloads/我的消費簿", Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "匯出失敗：" + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
