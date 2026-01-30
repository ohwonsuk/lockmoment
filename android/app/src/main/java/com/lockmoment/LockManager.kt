package com.lockmoment

import android.content.Context
import android.telecom.TelecomManager
import android.provider.Telephony
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class LockManager private constructor(private val context: Context) {
    var isLocked: Boolean = false
    var endTime: Long = 0
    var lockType: String = "app"
    var currentLockName: String = "바로 잠금"
    var currentLockStartTime: Long = 0
    
    var defaultDialerPkg: String? = null
    var defaultSmsPkg: String? = null
    var dynamicAllowedPackage: String? = null
    
    // New: Blocked packages for 'app' mode (Blacklist)
    private val blockedPackages = mutableSetOf<String>()
    
    private val prefs = context.getSharedPreferences("lock_state", Context.MODE_PRIVATE)
    private val historyPrefs = context.getSharedPreferences("lock_history", Context.MODE_PRIVATE)
    
    private val allowedPackages = mutableSetOf(
        "com.lockmoment",
        "com.android.systemui",
        "com.android.settings", 
        "com.google.android.inputmethod.latin", 
        "com.samsung.android.honeyboard",
        "com.android.phone",
        "com.android.server.telecom",
        "com.android.incallui",
        "com.google.android.dialer",
        "com.samsung.android.dialer",
        "com.samsung.android.incallui"
    )

    fun updateDefaultApps() {
        try {
            val pm = context.packageManager
            
            // 1. Default Dialer
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                defaultDialerPkg = telecomManager.defaultDialerPackage
                defaultDialerPkg?.let { 
                    allowedPackages.add(it)
                }
            }

            if (defaultDialerPkg == null) {
                val dialIntent = android.content.Intent(android.content.Intent.ACTION_DIAL)
                pm.resolveActivity(dialIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName?.let {
                    defaultDialerPkg = it
                    allowedPackages.add(it)
                }
            }

            // 2. Default SMS
            defaultSmsPkg = Telephony.Sms.getDefaultSmsPackage(context)
            defaultSmsPkg?.let {
                allowedPackages.add(it)
            }

            if (defaultSmsPkg == null) {
                val smsIntent = android.content.Intent(android.content.Intent.ACTION_SENDTO)
                smsIntent.data = android.net.Uri.parse("smsto:")
                pm.resolveActivity(smsIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName?.let { 
                    defaultSmsPkg = it
                    allowedPackages.add(it)
                }
            }
            
            allowedPackages.add("com.google.android.apps.messaging")
            allowedPackages.add("com.samsung.android.messaging")
            allowedPackages.add("com.android.mms")
            
        } catch (e: Exception) {
            Log.e("LockManager", "Failed to update default apps", e)
        }
    }

    // Updated signature: packagesJson contains either allowed package (legacy) or list of blocked packages
    fun startLock(durationMs: Long, type: String = "app", name: String = "바로 잠금", packagesJson: String? = null) {
        currentLockStartTime = System.currentTimeMillis()
        endTime = currentLockStartTime + durationMs
        lockType = type
        currentLockName = name
        isLocked = true
        
        // Reset lists
        blockedPackages.clear()
        dynamicAllowedPackage = null

        if (type == "app") {
            // Blacklist mode: parse blocked packages
            if (packagesJson != null) {
                try {
                    // Try parsing as JSON Array
                    if (packagesJson.startsWith("[")) {
                        val jsonArray = JSONArray(packagesJson)
                        for (i in 0 until jsonArray.length()) {
                            blockedPackages.add(jsonArray.getString(i))
                        }
                    } else {
                        // Legacy single package blacklist? Or maybe treat as single item
                        blockedPackages.add(packagesJson)
                    }
                } catch (e: Exception) {
                    Log.e("LockManager", "Failed to parse blocked packages", e)
                }
            }
        } else {
            // Phone mode (Whitelist): treat packagesJson as single allowed package (dynamicAllowedPackage) if needed
            // Currently phone mode is strict, maybe we allow one extra app?
            // Legacy behavior used allowedPackage string.
            if (packagesJson != null && !packagesJson.startsWith("[")) {
                dynamicAllowedPackage = packagesJson
            }
        }
        
        updateDefaultApps()
        saveLockState()
        
        NotificationHelper.sendNotification(context, "잠금 시작", "'$name'이 시작되었습니다.")
    }

    fun stopLock(status: String = "완료") {
        if (!isLocked) return

        addHistoryEntry(currentLockName, currentLockStartTime, System.currentTimeMillis(), status)

        isLocked = false
        endTime = 0
        
        clearLockState()
        
        NotificationHelper.sendNotification(context, "잠금 종료", "'$currentLockName'이 종료되었습니다.")
    }

    private fun addHistoryEntry(name: String, startMs: Long, endMs: Long, status: String) {
        try {
            val historyJson = historyPrefs.getString("history", "[]") ?: "[]"
            val historyArray = JSONArray(historyJson)
            val dateFormat = SimpleDateFormat("yyyy.MM.dd", Locale.KOREAN)
            
            val durationSeconds = (endMs - startMs) / 1000
            val h = durationSeconds / 3600
            val m = (durationSeconds % 3600) / 60
            val s = durationSeconds % 60
            val durationStr = if (h > 0) "${h}시간 ${m}분" else if (m > 0) "${m}분 ${s}초" else "${s}초"

            val entry = JSONObject().apply {
                put("id", UUID.randomUUID().toString())
                put("date", dateFormat.format(Date(startMs)))
                put("name", name)
                put("duration", durationStr)
                put("status", status)
                put("timestamp", startMs)
            }
            
            val newArray = JSONArray()
            newArray.put(entry)
            for (i in 0 until Math.min(historyArray.length(), 49)) {
                newArray.put(historyArray.get(i))
            }
            historyPrefs.edit().putString("history", newArray.toString()).apply()
        } catch (e: Exception) {
            Log.e("LockManager", "Failed to record history", e)
        }
    }

    fun getHistory(): String {
        return historyPrefs.getString("history", "[]") ?: "[]"
    }

    fun isPackageAllowed(packageName: String): Boolean {
        // Always allow LockMoment and critical components
        if (packageName == "com.lockmoment") return true
        if (packageName == "com.android.systemui") return true
        
        if (lockType == "app") {
            // Blacklist mode: Block if in blockedPackages
            if (blockedPackages.contains(packageName)) return false
            return true
        } else {
            // Phone mode (Whitelist)
            if (packageName == "com.android.settings" ||
                packageName == "com.android.phone" ||
                packageName == "com.android.server.telecom" ||
                packageName.contains("incallui")) {
                return true
            }
            
            if (dynamicAllowedPackage != null && packageName == dynamicAllowedPackage) return true

            if (packageName.contains("keyboard") || 
                packageName.contains("telephony") ||
                packageName.contains("inputmethod")) {
                return true
            }
            
            if (allowedPackages.contains(packageName)) {
                return true
            }

            if (packageName.contains("launcher") || packageName.contains("home")) {
                return true
            }

            if (packageName.contains("contact")) {
                return true
            }
            
            return false
        }
    }
    
    fun saveLockState() {
        prefs.edit().apply {
            putBoolean("isLocked", isLocked)
            putLong("endTime", endTime)
            putString("lockType", lockType)
            putString("lockName", currentLockName)
            putLong("startTime", currentLockStartTime)
            putString("allowedPackage", dynamicAllowedPackage)
            putString("blockedPackages", JSONArray(blockedPackages).toString())
            apply()
        }
    }
    
    fun restoreLockState() {
        val savedEndTime = prefs.getLong("endTime", 0)
        if (savedEndTime > System.currentTimeMillis()) {
            endTime = savedEndTime
            lockType = prefs.getString("lockType", "app") ?: "app"
            currentLockName = prefs.getString("lockName", "바로 잠금") ?: "바로 잠금"
            currentLockStartTime = prefs.getLong("startTime", System.currentTimeMillis())
            dynamicAllowedPackage = prefs.getString("allowedPackage", null)
            
            val blockedJson = prefs.getString("blockedPackages", "[]")
            blockedPackages.clear()
            if (blockedJson != null) {
                try {
                    val arr = JSONArray(blockedJson)
                    for (i in 0 until arr.length()) {
                        blockedPackages.add(arr.getString(i))
                    }
                } catch (e: Exception) {
                    Log.e("LockManager", "Failed to restore blocked packages", e)
                }
            }
            
            isLocked = true
            updateDefaultApps()
        } else {
            val wasLocked = prefs.getBoolean("isLocked", false)
            if (wasLocked) {
                val name = prefs.getString("lockName", "바로 잠금") ?: "바로 잠금"
                val start = prefs.getLong("startTime", 0)
                if (start > 0) addHistoryEntry(name, start, savedEndTime, "완료")
            }
            clearLockState()
        }
    }
    
    fun clearLockState() {
        prefs.edit().clear().apply()
        isLocked = false
        endTime = 0
        dynamicAllowedPackage = null
        blockedPackages.clear()
    }
    
    companion object {
        @Volatile
        private var instance: LockManager? = null
        fun getInstance(context: Context): LockManager {
            return instance ?: synchronized(this) {
                instance ?: LockManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
