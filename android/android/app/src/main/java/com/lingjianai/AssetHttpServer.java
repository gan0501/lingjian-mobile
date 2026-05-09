package com.lingjianai;

import android.content.res.AssetManager;
import fi.iki.elonen.NanoHTTPD;
import java.io.InputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Lightweight HTTP server that serves files from Android assets.
 * Allows WebView to load via http://localhost:port instead of file://,
 * which enables WASM loading, Web Workers, and XHR.
 */
public class AssetHttpServer extends NanoHTTPD {
    private final AssetManager assetManager;

    private static final Map<String, String> MIME_MAP = new HashMap<>();
    static {
        MIME_MAP.put("html", "text/html");
        MIME_MAP.put("htm", "text/html");
        MIME_MAP.put("js", "application/javascript");
        MIME_MAP.put("cjs", "application/javascript");
        MIME_MAP.put("mjs", "application/javascript");
        MIME_MAP.put("css", "text/css");
        MIME_MAP.put("json", "application/json");
        MIME_MAP.put("wasm", "application/wasm");
        MIME_MAP.put("png", "image/png");
        MIME_MAP.put("jpg", "image/jpeg");
        MIME_MAP.put("svg", "image/svg+xml");
    }

    public AssetHttpServer(int port, AssetManager assetManager) {
        super(port);
        this.assetManager = assetManager;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        // Remove leading slash
        if (uri.startsWith("/")) {
            uri = uri.substring(1);
        }
        // Default to index.html
        if (uri.isEmpty()) {
            uri = "index.html";
        }

        try {
            InputStream is = assetManager.open(uri);
            String mimeType = getMimeType(uri);
            
            // For large files, we need to get the size
            // AssetManager can tell us the available bytes
            Response response = newChunkedResponse(Response.Status.OK, mimeType, is);
            // Allow CORS
            response.addHeader("Access-Control-Allow-Origin", "*");
            response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.addHeader("Access-Control-Allow-Headers", "*");
            return response;
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", 
                "File not found: " + uri);
        }
    }

    private String getMimeType(String path) {
        int dot = path.lastIndexOf('.');
        if (dot >= 0) {
            String ext = path.substring(dot + 1).toLowerCase();
            String mime = MIME_MAP.get(ext);
            if (mime != null) return mime;
        }
        return "application/octet-stream";
    }
}
