package com.lockmoment

import android.content.Context
import android.provider.Settings
import android.text.TextUtils.SimpleStringSplitter
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LockControlModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "LockControl"
    }

    @ReactMethod
    fun checkAccessibilityPermission(promise: Promise) {
        val context = reactApplicationContext
        val expectedComponentName = "${context.packageName}/${LockAccessibilityService::class.java.canonicalName}"
        
        val enabledServicesSetting = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        
        val colonSplitter = SimpleStringSplitter(':')
        colonSplitter.setString(enabledServicesSetting)
        
        var isEnabled = false
        while (colonSplitter.hasNext()) {
            val componentName = colonSplitter.next()
            if (componentName.equals(expectedComponentName, ignoreCase = true)) {
                isEnabled = true
                break
            }
        }
        
        promise.resolve(isEnabled)
    }

    @ReactMethod
    fun startLock(durationMs: Double, promise: Promise) {
        try {
            LockManager.startLock(durationMs.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopLock(promise: Promise) {
        try {
            LockManager.stopLock()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNLOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isLocked(promise: Promise) {
        promise.resolve(LockManager.isLocked)
    }
}
