package com.xzk410.spendbook;

import android.content.Context;
import android.content.SharedPreferences;

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
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class SpendbookWidgetWorker extends Worker {
    private static final String SUPABASE_URL = "https://izvrvlufxajezukyvgue.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_5BCOeBUUn-U5c8_i3LUqmQ_MZF5eIx_";
    private static final String AUTH_PREFS = "spendbook_auth_session";
    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");

    public SpendbookWidgetWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context context = getApplicationContext();
            SharedPreferences auth = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE);
            String refreshToken = auth.getString("refresh_token", "");
            if (refreshToken == null || refreshToken.isEmpty()) {
                cacheEmpty(context);
                SpendbookWidgetProvider.renderAll(context);
                return Result.success();
            }

            JSONObject refreshed = refreshSession(refreshToken);
            String accessToken = refreshed.optString("access_token", "");
            String newRefreshToken = refreshed.optString("refresh_token", refreshToken);
            if (accessToken.isEmpty()) return Result.retry();
            auth.edit().putString("access_token", accessToken).putString("refresh_token", newRefreshToken).apply();

            JSONArray records = fetchArray(accessToken,
                    "/rest/v1/spend_records?select=id,name,total_amount,paid_amount,logistics_status,ship_date,payment_due_date,buy_date,created_at&deleted_at=is.null");

            LocalDate today = LocalDate.now(TAIPEI);
            long monthTotal = 0;
            long todayTotal = 0;
            int pickup = 0;
            int payment = 0;
            int shipping = 0;
            ReminderCandidate nearestFuture = null;
            ReminderCandidate latestOverdue = null;

            for (int i = 0; i < records.length(); i++) {
                JSONObject r = records.getJSONObject(i);
                String name = clean(r.optString("name", "未命名商品"));
                if (name.isEmpty()) name = "未命名商品";
                double total = r.optDouble("total_amount", 0);
                double paid = r.optDouble("paid_amount", 0);
                String status = clean(r.optString("logistics_status", ""));
                LocalDate buyDate = recordDate(r);

                if (buyDate != null && buyDate.getYear() == today.getYear() && buyDate.getMonthValue() == today.getMonthValue()) {
                    monthTotal += Math.round(total);
                }
                if (today.equals(buyDate)) todayTotal += Math.round(total);

                if ("待取貨".equals(status)) pickup++;
                if ("尚未出貨".equals(status)) shipping++;
                double unpaid = Math.max(total - paid, 0);
                if (unpaid > 0.009) payment++;

                if (unpaid > 0.009) {
                    LocalDate due = parseDate(nullableString(r, "payment_due_date"));
                    if (due != null) {
                        ReminderCandidate c = new ReminderCandidate(due, name, "待付款");
                        if (!due.isBefore(today)) {
                            if (nearestFuture == null || due.isBefore(nearestFuture.date)) nearestFuture = c;
                        } else if (latestOverdue == null || due.isAfter(latestOverdue.date)) latestOverdue = c;
                    }
                }
                if ("尚未出貨".equals(status)) {
                    LocalDate due = parseDate(nullableString(r, "ship_date"));
                    if (due != null) {
                        ReminderCandidate c = new ReminderCandidate(due, name, "待出貨");
                        if (!due.isBefore(today)) {
                            if (nearestFuture == null || due.isBefore(nearestFuture.date)) nearestFuture = c;
                        } else if (latestOverdue == null || due.isAfter(latestOverdue.date)) latestOverdue = c;
                    }
                }
            }

            String reminder = "目前沒有提醒";
            ReminderCandidate best = nearestFuture != null ? nearestFuture : latestOverdue;
            if (best != null) {
                String prefix = best.date.isBefore(today) ? "逾期 " : (best.date.getMonthValue() + "/" + best.date.getDayOfMonth() + " ");
                reminder = prefix + truncate(best.name, 13) + "｜" + best.kind;
            } else if (pickup > 0) {
                reminder = "📦 有 " + pickup + " 筆待取貨";
            }

            context.getSharedPreferences(SpendbookWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
                    .putLong("month_total", monthTotal)
                    .putLong("today_total", todayTotal)
                    .putInt("pickup_count", pickup)
                    .putInt("payment_count", payment)
                    .putInt("shipping_count", shipping)
                    .putString("reminder_text", reminder)
                    .putLong("updated_at", System.currentTimeMillis())
                    .apply();
            SpendbookWidgetProvider.renderAll(context);
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private void cacheEmpty(Context context) {
        context.getSharedPreferences(SpendbookWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
                .putLong("month_total", 0)
                .putLong("today_total", 0)
                .putInt("pickup_count", 0)
                .putInt("payment_count", 0)
                .putInt("shipping_count", 0)
                .putString("reminder_text", "登入後顯示提醒")
                .apply();
    }

    private JSONObject refreshSession(String refreshToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);
        return new JSONObject(request("POST", SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", null, body.toString()));
    }

    private JSONArray fetchArray(String accessToken, String path) throws Exception {
        return new JSONArray(request("GET", SUPABASE_URL + path, accessToken, null));
    }

    private String request(String method, String urlText, String accessToken, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlText).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setRequestProperty("Content-Type", "application/json");
        if (accessToken != null && !accessToken.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + accessToken);
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

    private static LocalDate recordDate(JSONObject r) {
        LocalDate direct = parseDate(nullableString(r, "buy_date"));
        if (direct != null) return direct;
        String created = nullableString(r, "created_at");
        if (created.isEmpty()) return null;
        try { return OffsetDateTime.parse(created).atZoneSameInstant(TAIPEI).toLocalDate(); }
        catch (Exception ignored) { return null; }
    }

    private static LocalDate parseDate(String value) {
        try { return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE); }
        catch (Exception ignored) { return null; }
    }

    private static String nullableString(JSONObject obj, String key) {
        return obj.isNull(key) ? "" : clean(obj.optString(key, ""));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String truncate(String value, int max) {
        String v = clean(value);
        return v.length() <= max ? v : v.substring(0, max) + "…";
    }

    private static class ReminderCandidate {
        final LocalDate date;
        final String name;
        final String kind;
        ReminderCandidate(LocalDate date, String name, String kind) {
            this.date = date;
            this.name = name;
            this.kind = kind;
        }
    }
}
