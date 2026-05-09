package com.lingjianai.share

import android.content.ContentResolver
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

class IncomingShareModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val EVENT_NAME = "IncomingShareFiles"
        private var pendingFiles: List<Map<String, String>> = emptyList()

        fun handleIntent(context: ReactApplicationContext?, intent: Intent?) {
            if (intent == null) return

            val files = extractFiles(intent, context?.contentResolver)
            if (files.isEmpty()) return

            val safeFiles = context?.let { ctx ->
                files.mapNotNull { f ->
                    val uriString = f["uri"] ?: return@mapNotNull null
                    val name = f["name"] ?: "file"
                    val mimeType = f["mimeType"] ?: "application/octet-stream"
                    val copiedUri = copyToCache(ctx, Uri.parse(uriString), name) ?: return@mapNotNull null
                    mapOf(
                        "uri" to copiedUri.toString(),
                        "name" to name,
                        "mimeType" to mimeType,
                    )
                }
            } ?: files

            pendingFiles = safeFiles

            if (context != null && context.hasActiveCatalystInstance()) {
                val params = Arguments.createArray()
                for (f in safeFiles) {
                    val m = Arguments.createMap()
                    m.putString("uri", f["uri"])
                    m.putString("name", f["name"])
                    m.putString("mimeType", f["mimeType"])
                    params.pushMap(m)
                }

                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_NAME, params)
            }
        }

        private fun extractFiles(intent: Intent, resolver: ContentResolver?): List<Map<String, String>> {
            val action = intent.action
            val out = mutableListOf<Map<String, String>>()

            if (Intent.ACTION_SEND == action) {
                val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                if (uri != null) out.add(describeUri(uri, resolver))
            } else if (Intent.ACTION_SEND_MULTIPLE == action) {
                val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                if (uris != null) {
                    for (u in uris) out.add(describeUri(u, resolver))
                }
            } else if (Intent.ACTION_VIEW == action) {
                val uri = intent.data
                if (uri != null) out.add(describeUri(uri, resolver))
            }

            return out
        }

        private fun describeUri(uri: Uri, resolver: ContentResolver?): Map<String, String> {
            val mimeType = resolver?.getType(uri) ?: "application/octet-stream"
            val name = resolver?.let { getDisplayName(it, uri) } ?: (uri.lastPathSegment ?: "file")
            return mapOf(
                "uri" to uri.toString(),
                "name" to name,
                "mimeType" to mimeType,
            )
        }

        private fun getDisplayName(resolver: ContentResolver, uri: Uri): String? {
            var cursor: Cursor? = null
            return try {
                cursor = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                if (cursor != null && cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) cursor.getString(idx) else null
                } else null
            } catch (_: Exception) {
                null
            } finally {
                cursor?.close()
            }
        }

        private fun copyToCache(ctx: ReactApplicationContext, uri: Uri, fileName: String): Uri? {
            return try {
                val dir = File(ctx.cacheDir, "incoming_share")
                if (!dir.exists()) dir.mkdirs()

                val safeName = fileName.replace("/", "_")
                val dest = File(dir, "${System.currentTimeMillis()}_$safeName")

                ctx.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(dest).use { output ->
                        input.copyTo(output)
                    }
                } ?: return null

                Uri.fromFile(dest)
            } catch (_: Exception) {
                null
            }
        }
    }

    override fun getName(): String = "IncomingShare"

    @ReactMethod
    fun getInitialSharedFiles(promise: Promise) {
        val arr = Arguments.createArray()
        for (f in pendingFiles) {
            val m = Arguments.createMap()
            m.putString("uri", f["uri"])
            m.putString("name", f["name"])
            m.putString("mimeType", f["mimeType"])
            arr.pushMap(m)
        }
        pendingFiles = emptyList()
        promise.resolve(arr)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
