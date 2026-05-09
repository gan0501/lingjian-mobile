package com.lingjianai.location

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import com.amap.api.location.AMapLocation
import com.amap.api.location.AMapLocationClient
import com.amap.api.location.AMapLocationClientOption
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AMapLocationModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AMapLocationModule"
    }

    private var locationClient: AMapLocationClient? = null

    override fun getName(): String = "AMapLocationModule"

    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        try {
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "定位权限未授权")
                return
            }

            if (locationClient == null) {
                locationClient = AMapLocationClient(reactContext.applicationContext)
            }

            val client = locationClient!!
            val option = AMapLocationClientOption().apply {
                locationMode = AMapLocationClientOption.AMapLocationMode.Hight_Accuracy
                isOnceLocation = true
                interval = 2000
                isNeedAddress = true
                isLocationCacheEnable = true
            }
            client.setLocationOption(option)
            client.setLocationListener { location: AMapLocation? ->
                if (location != null && location.errorCode == 0) {
                    val result = Arguments.createMap().apply {
                        putDouble("latitude", location.latitude)
                        putDouble("longitude", location.longitude)
                        putDouble("altitude", location.altitude.toDouble())
                        putDouble("accuracy", location.accuracy.toDouble())
                        putString("address", location.address ?: "")
                        putString("street", location.street ?: "")
                        putString("city", location.city ?: "")
                        putString("district", location.district ?: "")
                        putString("province", location.province ?: "")
                        putString("aoiName", location.aoiName ?: "")
                        putInt("locationType", location.locationType)
                    }
                    promise.resolve(result)
                } else {
                    promise.reject("LOCATION_ERROR", location?.errorInfo ?: "未知错误")
                }
                client.stopLocation()
            }
            client.startLocation()
        } catch (e: Exception) {
            promise.reject("LOCATION_EXCEPTION", e.message ?: "定位异常")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}