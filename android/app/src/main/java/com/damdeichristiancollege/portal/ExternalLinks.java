package com.damdeichristiancollege.portal;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;

/** Opens links outside the portal (other websites, phone numbers, email) in other apps. */
final class ExternalLinks {
    private ExternalLinks() {}

    static void open(Activity activity, String url) {
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        // Only hand off well-known schemes; never javascript:, file:, content: or intent:.
        if (!(scheme.equals("https") || scheme.equals("http") || scheme.equals("mailto") || scheme.equals("tel"))) {
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            activity.startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(activity, R.string.no_app, Toast.LENGTH_SHORT).show();
        }
    }
}
