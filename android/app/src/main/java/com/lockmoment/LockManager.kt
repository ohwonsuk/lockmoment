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
        "com.android.server.telecom",
        "com.google.android.dialer",
        "com.samsung.android.dialer",
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms"
    )

    fun startLock(durationMs: Long, type: String = "app") {
        endTime = System.currentTimeMillis() + durationMs
        lockType = type
        isLocked = true
        
        // Save lock state
        saveLockState()
        Log.d("LockManager", "Lock started until ${java.util.Date(endTime)}")
    }

    fun stopLock() {
        isLocked = false
        endTime = 0
        
        // Clear saved state
        clearLockState()
        Log.d("LockManager", "Lock stopped")
    }

    fun isPackageAllowed(packageName: String): Boolean {
        if (allowedPackages.contains(packageName) || 
            packageName.contains("keyboard") || 
            packageName.contains("telephony") ||
            packageName.contains("contact")) {
            return true
        }

        if (packageName.contains("launcher")) {
            return lockType != "phone"
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
