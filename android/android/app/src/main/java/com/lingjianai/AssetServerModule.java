package com.lingjianai;

import android.content.res.AssetManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class AssetServerModule extends ReactContextBaseJavaModule {
    private AssetHttpServer server;
    private static final int PORT = 38080;

    AssetServerModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "AssetServer";
    }

    @ReactMethod
    public void start(Promise promise) {
        try {
            if (server != null) {
                // Already running
                promise.resolve("http://localhost:" + PORT);
                return;
            }
            AssetManager am = getReactApplicationContext().getAssets();
            server = new AssetHttpServer(PORT, am);
            server.start();
            promise.resolve("http://localhost:" + PORT);
        } catch (Exception e) {
            promise.reject("ERR_SERVER", e.getMessage());
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        try {
            if (server != null) {
                server.stop();
                server = null;
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERR_SERVER", e.getMessage());
        }
    }
}
