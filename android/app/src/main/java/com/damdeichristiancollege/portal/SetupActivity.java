package com.damdeichristiancollege.portal;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

/** First-run screen where the user enters the portal address issued by the college. */
public class SetupActivity extends Activity {
    private EditText urlInput;
    private TextView urlError;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_setup);
        Insets.apply(this, findViewById(R.id.root));

        urlInput = findViewById(R.id.url);
        urlError = findViewById(R.id.url_error);
        Button save = findViewById(R.id.save);
        Button reset = findViewById(R.id.reset);

        String current = PortalConfig.origin(this);
        if (savedInstanceState == null && current != null) urlInput.setText(current);

        final String fallback = PortalConfig.defaultOrigin();
        if (fallback != null && !fallback.equals(current)) {
            reset.setVisibility(View.VISIBLE);
            reset.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    PortalConfig.clear(SetupActivity.this);
                    openPortal(fallback);
                }
            });
        }

        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                submit();
            }
        });
        urlInput.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                    submit();
                    return true;
                }
                return false;
            }
        });
    }

    private void submit() {
        PortalUrl.Result result = PortalUrl.normalize(urlInput.getText().toString(), BuildConfig.DEBUG);
        if (!result.ok()) {
            urlError.setText(result.error);
            urlError.setVisibility(View.VISIBLE);
            return;
        }
        urlError.setVisibility(View.GONE);
        PortalConfig.save(this, result.url);
        openPortal(result.url);
    }

    private void openPortal(String origin) {
        String previous = getIntent().getStringExtra(MainActivity.EXTRA_PREVIOUS_ORIGIN);
        if (previous != null && !previous.equals(origin)) {
            // A different portal: drop the old session and cached data.
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            WebStorage.getInstance().deleteAllData();
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
