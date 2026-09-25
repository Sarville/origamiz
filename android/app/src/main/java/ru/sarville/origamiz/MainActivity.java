package ru.sarville.origamiz;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

import ru.rustore.sdk.pay.RuStorePayClient;
import ru.rustore.sdk.pay.model.SdkTheme;

public class MainActivity extends BridgeActivity {
    // The game's own "back" key binding is Escape (closes dialogs, opens/closes the pause menu; a no-op in the main
    // menu). Forward the hardware/gesture back press to it, so back never minimizes/closes the app by accident.
    private static final String SEND_ESCAPE_JS =
        "['keydown','keyup'].forEach(function(t){window.dispatchEvent(new KeyboardEvent(t,{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}))})";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RuStorePayPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(SEND_ESCAPE_JS, null);
            }
        });
        if (savedInstanceState == null) {
            proceedPayIntent(getIntent());
        }
    }

    // Returning from a banking app (SBP/SberPay) arrives as a deeplink intent for the scheme declared in the manifest.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        proceedPayIntent(intent);
    }

    private void proceedPayIntent(Intent intent) {
        RuStorePayClient.Companion.getInstance().getIntentInteractor().proceedIntent(intent, SdkTheme.LIGHT);
    }
}
