package com.korvalune.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Korvalune : coquille Android autour du jeu en ligne (WebView plein écran). */
public class MainActivity extends Activity {
    // Adresse du jeu en ligne. Si l'adresse du site change, modifier cette ligne puis reconstruire l'APK.
    private static final String GAME_URL = "https://legends-of-aetheria-mxaq.onrender.com/";
    private static final String GAME_HOST = "legends-of-aetheria-mxaq.onrender.com";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(0xFF000000);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (GAME_HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (!r.isForMainFrame()) return;
                v.loadData("<html><body style='background:#0b0a1a;color:#f2d98b;font-family:sans-serif;"
                        + "text-align:center;padding-top:15vh'><h2>Korvalune</h2>"
                        + "<p>Impossible de joindre le jeu.<br>V&eacute;rifie ta connexion internet.</p>"
                        + "<p><a style='color:#fff' href='" + GAME_URL + "'>R&eacute;essayer</a></p></body></html>",
                        "text/html; charset=utf-8", "UTF-8");
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap f) { immersive(); }
        });

        if (b != null) web.restoreState(b); else web.loadUrl(GAME_URL);
        immersive();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override public void onBackPressed() {
        // Le retour ne quitte pas le jeu par accident : il est transmis à la page (Échap), puis ignoré.
        web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape'}))", null);
    }

    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
}
