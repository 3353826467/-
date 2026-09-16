package com.quizmaster.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * MainActivity - WebView 容器
 * 加载 assets 中的 Web 应用，提供完整的刷题背题功能
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "QuizMaster";
    private static final String ASSET_URL = "file:///android_asset/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    String dataString = result.getData().getDataString();
                    if (dataString != null) {
                        results = new Uri[]{ Uri.parse(dataString) };
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        setupWebView();

        // 返回键处理 - 优先 WebView 后退
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // 先让 JS 处理返回（关闭模态框等）
                webView.evaluateJavascript(
                    "if(typeof App !== 'undefined' && App.handleBackPress && App.handleBackPress()) { true; } else { false; }",
                    value -> {
                        boolean handled = "true".equals(value);
                        if (!handled) {
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                            }
                        }
                    }
                );
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(ASSET_URL);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // JavaScript 接口 - 提供文件保存功能
        webView.addJavascriptInterface(new AndroidInterface(), "AndroidApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && !url.startsWith("file://") && !url.startsWith("about:")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent());
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // 下载监听
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            // blob: / data: 下载由 JS 接口处理，这里只处理 http 下载
            if (!url.startsWith("blob:") && !url.startsWith("data:")) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        });
    }

    /**
     * JavaScript 接口 - 供 Web 端调用的原生功能
     */
    public class AndroidInterface {

        /**
         * 保存文件到下载目录
         * @param fileName 文件名
         * @param base64Data Base64 编码的文件内容
         * @param toast 提示消息
         */
        @JavascriptInterface
        public void saveFile(String fileName, String base64Data, String toast) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String savedPath = saveToDownloads(fileName, bytes);

                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        toast != null && !toast.isEmpty() ? toast : "已保存: " + savedPath,
                        Toast.LENGTH_LONG).show());

                Log.i(TAG, "File saved: " + savedPath);
            } catch (Exception e) {
                Log.e(TAG, "Save file error", e);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "保存失败: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }

        /**
         * 保存文件到下载目录，兼容 Android 10+
         */
        private String saveToDownloads(String fileName, byte[] data) throws Exception {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ 使用 MediaStore
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QuizMaster");

                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception("无法创建下载文件");

                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new Exception("无法打开输出流");
                    os.write(data);
                    os.flush();
                }
                return Environment.DIRECTORY_DOWNLOADS + "/QuizMaster/" + fileName;
            } else {
                // Android 9 及以下使用传统方式
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), "QuizMaster");
                if (!dir.exists()) dir.mkdirs();

                File file = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(data);
                fos.close();
                return file.getAbsolutePath();
            }
        }

        /**
         * 判断是否在 Android WebView 中运行
         */
        @JavascriptInterface
        public boolean isAndroid() {
            return true;
        }

        /**
         * 显示原生 Toast
         */
        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
