package com.xzk410.spendbook;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.Locale;

public class SpendbookWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "spendbook_widget_cache";
    static final String WORK_NAME = "spendbook-widget-refresh";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) render(context, manager, id);
        enqueueRefresh(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        render(context, manager, appWidgetId);
        enqueueRefresh(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        enqueueRefresh(context);
    }

    static void enqueueRefresh(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(SpendbookWidgetWorker.class)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request);
    }

    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, SpendbookWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80);

        final int layout;
        if (minHeight >= 170) layout = R.layout.widget_spendbook_large;
        else if (minWidth >= 245 && minHeight >= 95) layout = R.layout.widget_spendbook_medium;
        else layout = R.layout.widget_spendbook_small;

        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setTextViewText(R.id.widget_month_amount, money(p.getLong("month_total", 0)));
        views.setTextViewText(R.id.widget_today_amount, money(p.getLong("today_total", 0)));

        if (layout != R.layout.widget_spendbook_small) {
            views.setTextViewText(R.id.widget_pickup_count, String.valueOf(p.getInt("pickup_count", 0)));
            views.setTextViewText(R.id.widget_payment_count, String.valueOf(p.getInt("payment_count", 0)));
        }
        if (layout == R.layout.widget_spendbook_large) {
            views.setTextViewText(R.id.widget_shipping_count, String.valueOf(p.getInt("shipping_count", 0)));
            String reminder = p.getString("reminder_text", "目前沒有提醒");
            if (reminder == null || reminder.trim().isEmpty()) reminder = "目前沒有提醒";
            views.setTextViewText(R.id.widget_reminder_text, reminder);
        }

        views.setOnClickPendingIntent(R.id.widget_month_block, open(context, "month", 11));
        views.setOnClickPendingIntent(R.id.widget_today_block, open(context, "today", 12));
        views.setOnClickPendingIntent(R.id.widget_add, open(context, "add", 13));
        if (layout != R.layout.widget_spendbook_small) {
            views.setOnClickPendingIntent(R.id.widget_pickup_block, open(context, "pickup", 14));
            views.setOnClickPendingIntent(R.id.widget_payment_block, open(context, "payment", 15));
        }
        if (layout == R.layout.widget_spendbook_large) {
            views.setOnClickPendingIntent(R.id.widget_shipping_block, open(context, "shipping", 16));
            views.setOnClickPendingIntent(R.id.widget_reminder_block, open(context, "reminder", 17));
        }
        views.setOnClickPendingIntent(R.id.widget_title, open(context, "records", 18));
        manager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent open(Context context, String action, int requestCode) {
        Uri data = Uri.parse("spendbook://auth-callback?widget_action=" + Uri.encode(action));
        Intent intent = new Intent(context, WidgetAwareMainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(data)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String money(long amount) {
        return "$" + String.format(Locale.TAIWAN, "%,d", amount);
    }
}
