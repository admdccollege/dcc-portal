package com.damdeichristiancollege.portal;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.Charset;

/**
 * Saves files the portal offers for download (PDF marksheets, receipts, CSV/Excel
 * exports) to the device's Downloads folder. Portal URLs are fetched by the system
 * DownloadManager with the user's session cookie; {@code data:} URLs (CSV templates
 * built in the page) are decoded and written directly.
 */
final class Downloader {
    static final int PERMISSION_REQUEST = 41;

    private final Activity activity;
    private final String portalOrigin;
    private Pending pending;

    private static final class Pending {
        final String url, userAgent, contentDisposition, mimeType;

        Pending(String url, String userAgent, String contentDisposition, String mimeType) {
            this.url = url;
            this.userAgent = userAgent;
            this.contentDisposition = contentDisposition;
            this.mimeType = mimeType;
        }
    }

    Downloader(Activity activity, String portalOrigin) {
        this.activity = activity;
        this.portalOrigin = portalOrigin;
    }

    void start(String url, String userAgent, String contentDisposition, String mimeType) {
        boolean isData = url.startsWith("data:");
        if (!isData && !PortalUrl.isSameOrigin(url, portalOrigin)) {
            // Never send the session cookie anywhere else; let the browser handle it.
            ExternalLinks.open(activity, url);
            return;
        }
        if (needsStoragePermission()) {
            pending = new Pending(url, userAgent, contentDisposition, mimeType);
            activity.requestPermissions(new String[] {Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERMISSION_REQUEST);
            return;
        }
        if (isData) saveDataUrl(url, contentDisposition, mimeType);
        else enqueue(url, userAgent, contentDisposition, mimeType);
    }

    void onPermissionResult(boolean granted) {
        Pending p = pending;
        pending = null;
        if (p == null) return;
        if (!granted) {
            toast(activity.getString(R.string.download_permission));
            return;
        }
        start(p.url, p.userAgent, p.contentDisposition, p.mimeType);
    }

    private boolean needsStoragePermission() {
        return Build.VERSION.SDK_INT < 29
                && activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED;
    }

    private void enqueue(String url, String userAgent, String contentDisposition, String mimeType) {
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            request.addRequestHeader("User-Agent", userAgent);
            if (mimeType != null) request.setMimeType(mimeType);
            request.setTitle(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            DownloadManager dm = (DownloadManager) activity.getSystemService(Activity.DOWNLOAD_SERVICE);
            dm.enqueue(request);
            toast(activity.getString(R.string.download_started, fileName));
        } catch (RuntimeException e) {
            toast(activity.getString(R.string.download_failed));
        }
    }

    private void saveDataUrl(final String url, String contentDisposition, String mimeType) {
        int comma = url.indexOf(',');
        if (comma < 0) {
            toast(activity.getString(R.string.download_failed));
            return;
        }
        String meta = url.substring(5, comma);
        final boolean base64 = meta.endsWith(";base64");
        String type = meta.split(";")[0];
        if (type.isEmpty()) type = mimeType != null && !mimeType.isEmpty() ? mimeType : "text/plain";
        final String finalType = type;
        final String fileName = URLUtil.guessFileName(url, contentDisposition, type);
        final String payload = url.substring(comma + 1);

        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok;
                try {
                    byte[] bytes = base64
                            ? Base64.decode(payload, Base64.DEFAULT)
                            : Uri.decode(payload).getBytes(Charset.forName("UTF-8"));
                    write(fileName, finalType, bytes);
                    ok = true;
                } catch (IOException | IllegalArgumentException e) {
                    ok = false;
                }
                final boolean saved = ok;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        toast(saved
                                ? activity.getString(R.string.download_saved, fileName)
                                : activity.getString(R.string.download_failed));
                    }
                });
            }
        }).start();
    }

    private void write(String fileName, String mimeType, byte[] bytes) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = activity.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (item == null) throw new IOException("insert failed");
            OutputStream out = resolver.openOutputStream(item);
            if (out == null) throw new IOException("open failed");
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(item, values, null, null);
        } else {
            @SuppressWarnings("deprecation")
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("no Downloads folder");
            File file = new File(dir, fileName);
            String base = fileName, ext = "";
            int dot = fileName.lastIndexOf('.');
            if (dot > 0) {
                base = fileName.substring(0, dot);
                ext = fileName.substring(dot);
            }
            for (int i = 1; file.exists(); i++) file = new File(dir, base + " (" + i + ")" + ext);
            FileOutputStream out = new FileOutputStream(file);
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
        }
    }

    private void toast(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
    }
}
