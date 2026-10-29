package com.damdeichristiancollege.portal;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.print.PrintManager;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * Hosts the DCC portal in a locked-down WebView. Only the configured portal origin
 * is loaded inside the app; every other link opens in the browser. Sign-in,
 * permissions and all data access stay on the server exactly as on the web.
 */
public class MainActivity extends Activity {
    static final String EXTRA_PREVIOUS_ORIGIN = "previous_origin";
    static final String ACTION_CHANGE_ADDRESS = "com.damdeichristiancollege.portal.CHANGE_ADDRESS";
    private static final int FILE_CHOOSER_REQUEST = 42;

    private String portalOrigin;
    private WebView webView;
    private ProgressBar progress;
    private View errorView;
    private TextView errorMessage;
    private Downloader downloader;
    private ValueCallback<Uri[]> fileCallback;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        portalOrigin = PortalConfig.origin(this);
        if (portalOrigin == null || ACTION_CHANGE_ADDRESS.equals(getIntent().getAction())) {
            openSetup();
            finish();
            return;
        }

        setContentView(R.layout.activity_main);
        Insets.apply(this, findViewById(R.id.root));
        webView = findViewById(R.id.web);
        progress = findViewById(R.id.progress);
        errorView = findViewById(R.id.error);
        errorMessage = findViewById(R.id.error_message);
        downloader = new Downloader(this, portalOrigin);

        Button retry = findViewById(R.id.retry);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                reload();
            }
        });
        Button change = findViewById(R.id.change_address);
        change.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openSetup();
            }
        });

        configureWebView();
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(portalOrigin + "/");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (ACTION_CHANGE_ADDRESS.equals(intent.getAction())) openSetup();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSafeBrowsingEnabled(true);
        s.setGeolocationEnabled(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        // Wide tables (marks grids, registers) can be pinch-zoomed.
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " DCCPortalApp/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        // Lets the portal's Print buttons (window.print) use Android printing / Save as PDF.
        webView.addJavascriptInterface(new PrintBridge(), "DccAndroid");

        webView.setWebViewClient(new PortalClient());
        webView.setWebChromeClient(new PortalChrome());
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                downloader.start(url, userAgent, contentDisposition, mimeType);
            }
        });
    }

    private final class PortalClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (PortalUrl.isSameOrigin(url, portalOrigin)) return false;
            // Includes server redirects to other hosts (e.g. short-lived signed file links).
            ExternalLinks.open(MainActivity.this, url);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            mainFrameFailed = false;
            progress.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            if (!mainFrameFailed) errorView.setVisibility(View.GONE);
            if (PortalUrl.isSameOrigin(url, portalOrigin)) {
                view.evaluateJavascript(
                        "window.print=function(){window.DccAndroid&&window.DccAndroid.print(document.title)};", null);
            }
            CookieManager.getInstance().flush();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            showError(isOnline()
                    ? getString(R.string.error_generic, String.valueOf(error.getDescription()))
                    : getString(R.string.error_offline));
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            // Never proceed past certificate errors.
            handler.cancel();
            showError(getString(R.string.error_ssl));
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The web content process crashed or was killed: rebuild the screen.
            recreate();
            return true;
        }
    }

    private final class PortalChrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progress.setProgress(newProgress);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                return true;
            } catch (RuntimeException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    /** Exposed to portal pages as window.DccAndroid. */
    public final class PrintBridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (webView == null || !PortalUrl.isSameOrigin(webView.getUrl(), portalOrigin)) return;
                    String job = title == null || title.trim().isEmpty() ? getString(R.string.print_job) : title.trim();
                    PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                    pm.print(job, webView.createPrintDocumentAdapter(job), null);
                }
            });
        }
    }

    private void showError(String message) {
        mainFrameFailed = true;
        errorMessage.setText(message);
        errorView.setVisibility(View.VISIBLE);
        progress.setVisibility(View.GONE);
    }

    private void reload() {
        errorView.setVisibility(View.GONE);
        String url = webView.getUrl();
        if (url == null || !PortalUrl.isSameOrigin(url, portalOrigin)) webView.loadUrl(portalOrigin + "/");
        else webView.reload();
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        Network network = cm == null ? null : cm.getActiveNetwork();
        NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void openSetup() {
        Intent intent = new Intent(this, SetupActivity.class);
        intent.putExtra(EXTRA_PREVIOUS_ORIGIN, PortalConfig.origin(this));
        startActivity(intent);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == Downloader.PERMISSION_REQUEST) {
            downloader.onPermissionResult(grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED);
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && errorView.getVisibility() != View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
