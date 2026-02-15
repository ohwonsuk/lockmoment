package com.lockmoment

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.provider.Settings
import android.text.TextUtils.SimpleStringSplitter
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import androidx.core.app.ActivityCompat
import android.app.Activity

class LockControlModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    init {
        NotificationHelper.createNotificationChannel(reactContext)
    }

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
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                val activity = getCurrentActivity()
                if (activity != null) {
                    val permissions = arrayOf(android.Manifest.permission.POST_NOTIFICATIONS)
                    ActivityCompat.requestPermissions(activity, permissions, 1001)
                    promise.resolve(true)
                } else {
                    // If activity is null, we can't request via dialog, but user can still go to settings
                    promise.resolve(false)
                }
            } else {
                promise.resolve(true) // Not needed below Android 13
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startLock(durationMs: Double, type: String, name: String, packagesJson: String?, preventAppRemoval: Boolean, promise: Promise) {
        try {
            val context = reactApplicationContext
            val lockManager = LockManager.getInstance(context)
            lockManager.startLock(durationMs.toLong(), type, name, packagesJson, preventAppRemoval)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOCK_ERROR", e.message)
        }
    }


    @ReactMethod
    fun stopLock(promise: Promise) {
        try {
            LockManager.getInstance(reactApplicationContext).stopLock("중단")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNLOCK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkDeviceAdminActive(promise: Promise) {
        val context = reactApplicationContext
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        val adminComponent = android.content.ComponentName(context, LockDeviceAdminReceiver::class.java)
        promise.resolve(dpm.isAdminActive(adminComponent))
    }

    @ReactMethod
    fun requestDeviceAdmin(promise: Promise) {
        try {
            val context = reactApplicationContext
            val adminComponent = android.content.ComponentName(context, LockDeviceAdminReceiver::class.java)
            val intent = android.content.Intent(android.app.admin.DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            intent.putExtra(android.app.admin.DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            intent.putExtra(android.app.admin.DevicePolicyManager.EXTRA_ADD_EXPLANATION, "잠금 상태에서 앱 삭제를 방지하기 위해 권한이 필요합니다.")
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DEVICE_ADMIN_ERROR", e.message)
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
            val myPackageName = reactApplicationContext.packageName
            
            for (packageInfo in packages) {
                val packageName = packageInfo.packageName
                if (packageName == myPackageName) continue

                val appInfo = packageInfo.applicationInfo ?: continue
                
                // Detailed filtering for system apps
                val isSystemApp = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                val isUpdatedSystemApp = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                
                if (isSystemApp && !isUpdatedSystemApp) {
                    // List of essential system apps we want to ALLOW if they have a launcher
                    val whitelist = listOf("calendar", "camera", "contacts", "gallery", "clock", "calculator", "notes")
                    val lowerPackage = packageName.lowercase()
                    
                    val isEssential = whitelist.any { lowerPackage.contains(it) }
                    
                    if (!isEssential) {
                        // Filter out internal system components by common keywords
                        if (lowerPackage.contains("provider") || 
                            lowerPackage.contains("service") || 
                            lowerPackage.contains("overlay") ||
                            lowerPackage.contains("systemui") ||
                            lowerPackage.contains("bluetooth") ||
                            lowerPackage.contains("certinstaller") ||
                            lowerPackage.contains("ims") ||
                            lowerPackage.contains("keychain") ||
                            lowerPackage.contains("stk") ||
                            lowerPackage.contains("backupconfirm") ||
                            lowerPackage.contains("captiveportallogin") ||
                            lowerPackage.startsWith("com.android.") ||
                            lowerPackage.startsWith("android.") ||
                            packageName == "android") {
                            continue
                        }
                    }
                }

                // Only show apps that can be launched (user apps)
                val launchIntent = pm.getLaunchIntentForPackage(packageName)
                if (launchIntent == null) continue

                val label = appInfo.loadLabel(pm).toString()
                val appMap = com.facebook.react.bridge.Arguments.createMap()
                appMap.putString("label", label)
                appMap.putString("packageName", packageName)

                try {
                    val icon = appInfo.loadIcon(pm)
                    val iconBase64 = drawableToBase64(icon)
                    appMap.putString("icon", iconBase64)
                } catch (e: Exception) {
                    appMap.putString("icon", "")
                }

                appList.pushMap(appMap)
            }
            promise.resolve(appList)
        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", e.message)
        }
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = if (drawable is BitmapDrawable) {
            drawable.bitmap
        } else {
            val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 100
            val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 100
            val b = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(b)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            b
        }

        val byteArrayOutputStream = ByteArrayOutputStream()
        val scaledBitmap = if (bitmap.width > 128) {
            Bitmap.createScaledBitmap(bitmap, 128, 128, true)
        } else {
            bitmap
        }
        scaledBitmap.compress(Bitmap.CompressFormat.PNG, 100, byteArrayOutputStream)
        val byteArray = byteArrayOutputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    @ReactMethod
    fun checkAuthorization(promise: Promise) {
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
        name: String,
        allowedPackage: String?,
        preventAppRemoval: Boolean,
        preLockMinutes: Double,
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
                lockType,
                name,
                allowedPackage,
                preventAppRemoval,
                preLockMinutes.toInt()
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
            val lockManager = LockManager.getInstance(reactApplicationContext)
            lockManager.updateDefaultApps() // Refresh just in case
            
            val intent = if (lockManager.defaultDialerPkg != null) {
                reactApplicationContext.packageManager.getLaunchIntentForPackage(lockManager.defaultDialerPkg!!)
            } else {
                android.content.Intent(android.content.Intent.ACTION_DIAL)
            }
            
            if (intent == null) {
                // Fallback to generic action
                val fallbackIntent = android.content.Intent(android.content.Intent.ACTION_DIAL)
                fallbackIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallbackIntent)
            } else {
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DIALER_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openDefaultMessages(promise: Promise) {
        try {
            val lockManager = LockManager.getInstance(reactApplicationContext)
            lockManager.updateDefaultApps()
            
            val intent = if (lockManager.defaultSmsPkg != null) {
                reactApplicationContext.packageManager.getLaunchIntentForPackage(lockManager.defaultSmsPkg!!)
            } else {
                val smsIntent = android.content.Intent(android.content.Intent.ACTION_SENDTO)
                smsIntent.data = android.net.Uri.parse("smsto:")
                smsIntent
            }

            if (intent == null) {
                val fallbackIntent = android.content.Intent(android.content.Intent.ACTION_SENDTO)
                fallbackIntent.data = android.net.Uri.parse("smsto:")
                fallbackIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallbackIntent)
            } else {
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("MESSAGES_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = android.content.Intent()
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                intent.action = android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS
                intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
            } else {
                intent.action = "android.settings.APP_NOTIFICATION_SETTINGS"
                intent.putExtra("app_package", reactApplicationContext.packageName)
                intent.putExtra("app_uid", reactApplicationContext.applicationInfo.uid)
            }
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIFICATION_SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getNativeHistory(promise: Promise) {
        try {
            val history = LockManager.getInstance(reactApplicationContext).getHistory()
            promise.resolve(history)
        } catch (e: Exception) {
            promise.reject("HISTORY_ERROR", e.message)
        }
    }
    @ReactMethod
    fun setPreventAppRemoval(enabled: Boolean, promise: Promise) {
        try {
            val context = reactApplicationContext
            val lockManager = LockManager.getInstance(context)
            lockManager.setUninstallBlocked(enabled)
            
            // Save as global preference
            val prefs = context.getSharedPreferences("lock_state", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("globalPreventAppRemoval", enabled).apply()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_REMOVAL_ERROR", e.message)
        }
    }
}
