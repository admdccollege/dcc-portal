package com.damdeichristiancollege.portal;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;

/** Draws edge to edge (enforced on Android 15+) and pads the root view clear of system bars and the keyboard. */
final class Insets {
    private Insets() {}

    @SuppressWarnings("deprecation")
    static void apply(Activity activity, View root) {
        Window window = activity.getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            root.setSystemUiVisibility(root.getSystemUiVisibility()
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 30) {
                    android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                            | WindowInsets.Type.ime()
                            | WindowInsets.Type.displayCutout());
                    v.setPadding(i.left, i.top, i.right, i.bottom);
                    return WindowInsets.CONSUMED;
                }
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            }
        });
        root.requestApplyInsets();
    }
}
