package com.bijiabu.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.common.moduleinstall.ModuleInstall;
import com.google.android.gms.common.moduleinstall.ModuleInstallClient;
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

import org.json.JSONObject;

public class OrderOcrBridge {
    private final WebView webView;
    private final TextRecognizer recognizer;

    public OrderOcrBridge(WebView webView) {
        this.webView = webView;
        this.recognizer = TextRecognition.getClient(
                new ChineseTextRecognizerOptions.Builder().build()
        );

        // 使用 Google Play services 的可下載 OCR 模組，避免把大型辨識模型包進 APK。
        // App 啟動後先在背景準備模型；若第一次還沒下載完，前端會提示稍後再試。
        try {
            ModuleInstallClient moduleInstallClient = ModuleInstall.getClient(webView.getContext());
            ModuleInstallRequest request = ModuleInstallRequest.newBuilder()
                    .addApi(recognizer)
                    .build();
            moduleInstallClient.installModules(request);
        } catch (Exception ignored) { }
    }

    @JavascriptInterface
    public void recognizeOrderImage(String dataUrl) {
        if (dataUrl == null || dataUrl.isEmpty()) {
            sendError("沒有收到截圖");
            return;
        }
        if (dataUrl.length() > 6_000_000) {
            sendError("截圖過大，請重新選擇");
            return;
        }

        try {
            int comma = dataUrl.indexOf(',');
            String base64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) {
                sendError("無法讀取截圖");
                return;
            }

            InputImage image = InputImage.fromBitmap(bitmap, 0);
            recognizer.process(image)
                    .addOnSuccessListener(result -> {
                        try {
                            JSONObject payload = new JSONObject();
                            payload.put("ok", true);
                            payload.put("text", result.getText() == null ? "" : result.getText());
                            sendPayload(payload.toString());
                        } catch (Exception e) {
                            sendError("辨識結果無法整理");
                        } finally {
                            bitmap.recycle();
                        }
                    })
                    .addOnFailureListener(e -> {
                        bitmap.recycle();
                        if (e instanceof MlKitException
                                && ((MlKitException) e).getErrorCode() == MlKitException.UNAVAILABLE) {
                            sendError("辨識模組正在準備，請保持網路連線，幾秒後再試一次");
                        } else {
                            sendError("訂單文字辨識失敗");
                        }
                    });
        } catch (Exception e) {
            sendError("截圖處理失敗");
        }
    }

    private void sendError(String message) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("ok", false);
            payload.put("error", message);
            sendPayload(payload.toString());
        } catch (Exception ignored) { }
    }

    private void sendPayload(String payload) {
        webView.post(() -> {
            String js = "window.onOrderOcrNativeResult(" + JSONObject.quote(payload) + ");";
            webView.evaluateJavascript(js, null);
        });
    }
}
