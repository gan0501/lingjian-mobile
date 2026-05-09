package com.lingjianai

import android.content.Intent
import android.content.res.Configuration
import com.facebook.react.ReactActivity
import com.facebook.react.ReactApplication
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.lingjianai.share.IncomingShareModule

class MainActivity : ReactActivity() {

    private var pendingShareIntent: Intent? = null
    private var reactListener: ReactInstanceManager.ReactInstanceEventListener? = null

    override fun getMainComponentName(): String = "Lingjian"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
        }
        handleIncomingIntent(intent)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val intent = Intent("onConfigurationChanged")
        intent.putExtra("newConfig", newConfig)
        this.sendBroadcast(intent)
    }

    private fun handleIncomingIntent(inIntent: Intent?) {
        if (inIntent == null) return

        val action = inIntent.action
        val isShare = action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE || action == Intent.ACTION_VIEW
        if (!isShare) return

        val reactHost = (application as ReactApplication).reactNativeHost
        val instanceManager = reactHost.reactInstanceManager
        val current: ReactContext? = instanceManager.currentReactContext

        if (current is ReactApplicationContext && current.hasActiveCatalystInstance()) {
            IncomingShareModule.handleIntent(current, inIntent)
            pendingShareIntent = null
            return
        }

        pendingShareIntent = inIntent

        if (reactListener != null) return
        reactListener = ReactInstanceManager.ReactInstanceEventListener { context ->
            val p = pendingShareIntent
            if (p != null && context is ReactApplicationContext) {
                IncomingShareModule.handleIntent(context, p)
                pendingShareIntent = null
            }
            reactListener?.let { instanceManager.removeReactInstanceEventListener(it) }
            reactListener = null
        }
        reactListener?.let { instanceManager.addReactInstanceEventListener(it) }
    }
}
