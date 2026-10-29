package com.damdeichristiancollege.portal;

import android.content.Context;
import android.content.SharedPreferences;

/** Stores the portal origin chosen on first launch (or the build-time default). */
final class PortalConfig {
    private static final String PREFS = "portal";
    private static final String KEY_URL = "portal_url";

    private PortalConfig() {}

    /** The configured portal origin, or null if the app has not been set up. */
    static String origin(Context context) {
        String saved = prefs(context).getString(KEY_URL, null);
        if (saved != null) {
            PortalUrl.Result r = PortalUrl.normalize(saved, BuildConfig.DEBUG);
            if (r.ok()) return r.url;
        }
        return defaultOrigin();
    }

    /** The address baked in at build time (PORTAL_URL), if valid. */
    static String defaultOrigin() {
        if (BuildConfig.DEFAULT_PORTAL_URL.isEmpty()) return null;
        PortalUrl.Result r = PortalUrl.normalize(BuildConfig.DEFAULT_PORTAL_URL, BuildConfig.DEBUG);
        return r.ok() ? r.url : null;
    }

    static void save(Context context, String origin) {
        prefs(context).edit().putString(KEY_URL, origin).apply();
    }

    static void clear(Context context) {
        prefs(context).edit().remove(KEY_URL).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
