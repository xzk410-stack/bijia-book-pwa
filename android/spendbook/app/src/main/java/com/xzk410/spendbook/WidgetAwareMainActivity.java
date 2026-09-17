package com.xzk410.spendbook;

import android.os.Bundle;

public class WidgetAwareMainActivity extends MainActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SpendbookWidgetProvider.enqueueRefresh(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        SpendbookWidgetProvider.enqueueRefresh(this);
    }

    @Override
    protected void onStop() {
        SpendbookWidgetProvider.enqueueRefresh(this);
        super.onStop();
    }
}
