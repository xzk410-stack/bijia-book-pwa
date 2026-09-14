package com.xzk410.spendbook;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.Locale;

public class ReminderWorker extends Worker {
    private static final String SUPABASE_URL = "https://izvrvlufxajezukyvgue.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_5BCOeBUUn-U5c8_i3LUqmQ_MZF5eIx_";
    private static final String AUTH_PREFS = "spendbook_auth_session";
    private static final String SENT_PREFS = "spendbook_native_reminder_sent";
    private static final String CHANNEL_ID = "spendbook_deadline_reminders";
    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");

    public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            SharedPreferences auth = getApplicationContext().getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
            String refreshToken = auth.getString("refresh_token", "");
            if (refreshToken == null || refreshToken.isEmpty()) return Result.success();

            JSONObject refreshed = refreshSession(refreshToken);
            String accessToken = refreshed.optString("access_token", "");
            String newRefreshToken = refreshed.optString("refresh_token", refreshToken);
            if (accessToken.isEmpty()) return Result.retry();
            auth.edit().putString("access_token", accessToken).putString("refresh_token", newRefreshToken).apply();

            JSONObject settings = fetchFirst(accessToken,
                    "/rest/v1/spend_notification_settings?select=*&limit=1");
            if (settings != null && !settings.optBoolean("enabled", true)) return Result.success();

            int reminderHour = settings == null ? 9 : settings.optInt("reminder_hour", 9);
            int nowHour = ZonedDateTime.now(TAIPEI).getHour();
            if (nowHour < reminderHour) return Result.success();

            boolean paymentBefore = settings == null || settings.optBoolean("payment_day_before", true);
            boolean paymentDue = settings == null || settings.optBoolean("payment_due_day", true);
            boolean shippingDue = settings == null || settings.optBoolean("shipping_due_day", true);
            boolean shippingOverdue = settings == null || settings.optBoolean("shipping_overdue", true);
            boolean pickup = settings == null || settings.optBoolean("pickup", true);

            JSONArray records = fetchArray(accessToken,
                    "/rest/v1/spend_records?select=id,name,total_amount,paid_amount,logistics_status,ship_date,payment_due_date&deleted_at=is.null");
            LocalDate today = LocalDate.now(TAIPEI);
            LocalDate tomorrow = today.plusDays(1);
            SharedPreferences sent = getApplicationContext().getSharedPreferences(SENT_PREFS, Context.MODE_PRIVATE);

            for (int i = 0; i < records.length(); i++) {
                JSONObject r = records.getJSONObject(i);
                String id = r.optString("id", "");
                String name = r.optString("name", "未命名商品");
                String status = r.optString("logistics_status", "尚未出貨");
                double total = r.optDouble("total_amount", 0);
                double paid = r.optDouble("paid_amount", 0);
                double unpaid = Math.max(total - paid, 0);
                String paymentDate = nullableString(r, "payment_due_date");
                String shipDate = nullableString(r, "ship_date");

                if (unpaid > 0 && !paymentDate.isEmpty()) {
                    LocalDate due = parseDate(paymentDate);
                    if (due != null && paymentBefore && due.equals(tomorrow)) {
                        notifyOnce(sent, id + ":payment_before:" + paymentDate,
                                "明天要付尾款", name + " 尚待 " + money(unpaid));
                    }
                    if (due != null && paymentDue && due.equals(today)) {
                        notifyOnce(sent, id + ":payment_due:" + paymentDate,
                                "今天要付尾款", name + " 尚待 " + money(unpaid));
                    }
                }

                if ("尚未出貨".equals(status) && !shipDate.isEmpty()) {
                    LocalDate ship = parseDate(shipDate);
                    if (ship != null && shippingDue && ship.equals(today)) {
                        notifyOnce(sent, id + ":shipping_due:" + shipDate,
                                "預計今天出貨", name + " 目前仍是「尚未出貨」");
                    }
                    if (ship != null && shippingOverdue && ship.isBefore(today)) {
                        notifyOnce(sent, id + ":shipping_overdue:" + shipDate,
                                "出貨進度提醒", name + " 已超過預計出貨日");
                    }
                }

                if (pickup && "待取貨".equals(status)) {
                    notifyOnce(sent, id + ":pickup", "記得取貨", name + " 已標記為待取貨");
                }
            }
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private JSONObject refreshSession(String refreshToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);
        String raw = request("POST", SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
                null, body.toString());
        return new JSONObject(raw);
    }

    private JSONObject fetchFirst(String accessToken, String path) throws Exception {
        JSONArray arr = fetchArray(accessToken, path);
        return arr.length() > 0 ? arr.getJSONObject(0) : null;
    }

    private JSONArray fetchArray(String accessToken, String path) throws Exception {
        String raw = request("GET", SUPABASE_URL + path, accessToken, null);
        return new JSONArray(raw);
    }

    private String request(String method, String urlText, String accessToken, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlText).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setRequestProperty("Content-Type", "application/json");
        if (accessToken != null && !accessToken.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
        }
        if (body != null) {
            conn.setDoOutput(true);
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = conn.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder sb = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
            }
        }
        conn.disconnect();
        if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status + ": " + sb);
        return sb.toString();
    }

    private void notifyOnce(SharedPreferences sent, String noticeKey, String title, String body) {
        if (sent.getBoolean(noticeKey, false)) return;
        if (!canNotify(getApplicationContext())) return;
        showSystemNotification(getApplicationContext(), title, body, Math.abs(noticeKey.hashCode()));
        sent.edit().putBoolean(noticeKey, true).apply();
    }

    public static boolean canNotify(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public static void showSystemNotification(Context context, String title, String body, int id) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "期限提醒", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("我的消費簿尾款、出貨與取貨提醒");
            manager.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build();
        manager.notify(id, notification);
    }

    private static LocalDate parseDate(String value) {
        try { return LocalDate.parse(value); } catch (Exception ignored) { return null; }
    }

    private static String nullableString(JSONObject obj, String key) {
        return obj.isNull(key) ? "" : obj.optString(key, "");
    }

    private static String money(double amount) {
        long rounded = Math.round(amount);
        return "NT$" + String.format(Locale.TAIWAN, "%,d", rounded);
    }
}
