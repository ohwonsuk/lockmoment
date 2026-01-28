package com.lockmoment

import android.content.Context
import android.util.Log

class LockManager private constructor(private val context: Context) {
    var isLocked: Boolean = false
    var endTime: Long = 0
    var lockType: String = "app"
    
    private val prefs = context.getSharedPreferences("lock_state", Context.MODE_PRIVATE)
    
    private val allowedPackages = mutableSetOf(
        "com.lockmoment",
        "com.android.systemui",
        "com.android.settings", 
        "com.google.android.inputmethod.latin", 
        "com.samsung.android.honeyboard",
        "com.android.phone",
        "com.android.server.telecom"
    )

    private fun updateDefaultApps() {
        try {
            val pm = context.packageManager
            
            // Default Dialer
            val dialIntent = android.content.Intent(android.content.Intent.ACTION_DIAL)
            val dialerInfo = pm.resolveActivity(dialIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            dialerInfo?.activityInfo?.packageName?.let { 
                allowedPackages.add(it)
                Log.d("LockManager", "Allowed default dialer: $it")
            }

            // Default SMS
            val smsIntent = android.content.Intent(android.content.Intent.ACTION_SENDTO)
            smsIntent.data = android.net.Uri.parse("smsto:")
            val smsInfo = pm.resolveActivity(smsIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            smsInfo?.activityInfo?.packageName?.let { 
                allowedPackages.add(it)
                Log.d("LockManager", "Allowed default SMS: $it")
            }
            
            // Current Launcher (to be blocked in phone mode, but we need to know what it is)
            val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
            homeIntent.addCategory(android.content.Intent.CATEGORY_HOME)
            val homeInfo = pm.resolveActivity(homeIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            homeInfo?.activityInfo?.packageName?.let {
                // We'll handle this in isPackageAllowed
            }
        } catch (e: Exception) {
            Log.e("LockManager", "Failed to update default apps", e)
        }
    }

    fun startLock(durationMs: Long, type: String = "app") {
        endTime = System.currentTimeMillis() + durationMs
        lockType = type
        isLocked = true
        
        updateDefaultApps()
        // Save lock state
        saveLockState()
        Log.d("LockManager", "Lock started until ${java.util.Date(endTime)} (Type: $type)")
    }

    fun stopLock() {
        isLocked = false
        endTime = 0
        
        // Clear saved state
        clearLockState()
        Log.d("LockManager", "Lock stopped")
    }

    fun isPackageAllowed(packageName: String): Boolean {
        // Essential system components
        if (packageName == "com.android.systemui" || 
            packageName == "com.android.settings" ||
            packageName == "com.android.phone" ||
            packageName == "com.android.server.telecom") {
            return true
        }

        if (packageName == "com.lockmoment") return true

        // Keyboard and telephony always allowed
        if (packageName.contains("keyboard") || 
            packageName.contains("telephony") ||
            packageName.contains("inputmethod")) {
            return true
        }

        // Phone lock is extremely restrictive
        if (lockType == "phone") {
            // Check if it's the default dialer or SMS (already in allowedPackages if updateDefaultApps worked)
            if (allowedPackages.contains(packageName)) return true
            
            // Block everything else including launchers
            return false
        }

        // App lock mode
        if (allowedPackages.contains(packageName)) {
            return true
        }

        if (packageName.contains("launcher") || packageName.contains("home")) {
            return true
        }

        // Contact provider etc.
        if (packageName.contains("contact")) {
            return true
        }

        return false
    }
    
    fun saveLockState() {
        prefs.edit().apply {
            putBoolean("isLocked", isLocked)
            putLong("endTime", endTime)
            putString("lockType", lockType)
            apply()
        }
    }
    
    fun restoreLockState() {
        val savedEndTime = prefs.getLong("endTime", 0)
        val savedLockType = prefs.getString("lockType", "app") ?: "app"
        
        if (savedEndTime > System.currentTimeMillis()) {
            // Lock is still valid
            endTime = savedEndTime
            lockType = savedLockType
            isLocked = true
            Log.d("LockManager", "Lock state restored, active until ${java.util.Date(endTime)}")
        } else {
            // Lock has expired
            clearLockState()
            Log.d("LockManager", "Lock state expired, cleared")
        }
    }
    
    private fun clearLockState() {
        prefs.edit().clear().apply()
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
