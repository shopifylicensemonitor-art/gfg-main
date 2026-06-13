package com.peakx.sender;

import android.os.Bundle;
import android.view.View;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Force the status bar icons to be dark (for light mode) and transparent background
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.TRANSPARENT);
        
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat windowInsetsController = new WindowInsetsControllerCompat(window, decorView);
        
        // Set to true for dark icons (light mode), false for white icons (dark mode)
        windowInsetsController.setAppearanceLightStatusBars(true);
    }
}
