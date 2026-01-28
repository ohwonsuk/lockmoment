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
    fun startLock(durationMs: Double, type: String, promise: Promise) {
        try {
            LockManager.getInstance(reactApplicationContext).startLock(durationMs.toLong(), type)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopLock(promise: Promise) {
        try {
            LockManager.getInstance(reactApplicationContext).stopLock()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNLOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isLocked(promise: Promise) {
        promise.resolve(LockManager.getInstance(reactApplicationContext).isLocked)
    }

    @ReactMethod
    fun getRemainingTime(promise: Promise) {
        val lockManager = LockManager.getInstance(reactApplicationContext)
        if (!lockManager.isLocked) {
            promise.resolve(0)
            return
        }
        val remaining = lockManager.endTime - System.currentTimeMillis()
        promise.resolve(Math.max(0, remaining).toDouble())
    }

    @ReactMethod
    fun requestAuthorization(promise: Promise) {
        try {
            val intent = android.content.Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PERM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledPackages(0)
            val appList = com.facebook.react.bridge.Arguments.createArray()
            
            for (packageInfo in packages) {
                // Filter out system apps if necessary, but for now we list all for selection
                // Often we might want only apps with a launcher intent
                val intent = pm.getLaunchIntentForPackage(packageInfo.packageName)
                if (intent != null) {
                    val appMap = com.facebook.react.bridge.Arguments.createMap()
                    val label = packageInfo.applicationInfo?.loadLabel(pm)?.toString() ?: "Unknown App"
                    appMap.putString("label", label)
                    appMap.putString("packageName", packageInfo.packageName)
                    appList.pushMap(appMap)
                }
            }
            promise.resolve(appList)
        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkAuthorization(promise: Promise) {
        // Map accessibility permission to a status number similar to iOS
        // 2 = Authorized (matched in JS)
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
        
        promise.resolve(if (isEnabled) 2 else 0)
    }
    
    @ReactMethod
    fun scheduleAlarm(
        scheduleId: String,
        startTime: String,
        endTime: String,
        days: com.facebook.react.bridge.ReadableArray,
        lockType: String,
        promise: Promise
    ) {
        try {
            val daysList = mutableListOf<String>()
            for (i in 0 until days.size()) {
                days.getString(i)?.let { daysList.add(it) }
            }
            
            ScheduleAlarmManager.scheduleAlarm(
                reactApplicationContext,
                scheduleId,
                startTime,
                endTime,
                daysList,
                lockType
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun cancelAlarm(scheduleId: String, promise: Promise) {
        try {
            ScheduleAlarmManager.cancelAlarm(reactApplicationContext, scheduleId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun restoreLockState(promise: Promise) {
        try {
            LockManager.getInstance(reactApplicationContext).restoreLockState()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESTORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openDefaultDialer(promise: Promise) {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_DIAL)
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DIALER_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openDefaultMessages(promise: Promise) {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_SENDTO)
            intent.data = android.net.Uri.parse("smsto:")
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("MESSAGES_ERROR", e.message)
        }
    }
}
