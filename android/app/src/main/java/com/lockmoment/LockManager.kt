package com.lockmoment

object LockManager {
    var isLocked: Boolean = false
    var endTime: Long = 0
    var lockType: String = "app"
    private val allowedPackages = mutableSetOf(
        "com.lockmoment",
        "com.android.systemui",
        "com.android.settings", 
        "com.google.android.inputmethod.latin", 
        "com.samsung.android.honeyboard",
        "com.android.phone",           // Dialer / Emergency
        "com.android.server.telecom",  // Telecom system
        "com.google.android.dialer",   // Google Dialer
        "com.samsung.android.dialer",  // Samsung Dialer
        "com.google.android.apps.messaging", // Google Messages
        "com.samsung.android.messaging",     // Samsung Messages
        "com.android.mms"              // Generic MMS/SMS
    )

    fun startLock(durationMs: Long, type: String = "app") {
        endTime = System.currentTimeMillis() + durationMs
        lockType = type
        isLocked = true
    }

    fun stopLock() {
        isLocked = false
        endTime = 0
    }

    fun isPackageAllowed(packageName: String): Boolean {
        // Base allowed packages (System UI, Keyboards, Dialer, SMS)
        if (allowedPackages.contains(packageName) || 
            packageName.contains("keyboard") || 
            packageName.contains("telephony") ||
            packageName.contains("contact")) {
            return true
        }

        // Launcher handling
        if (packageName.contains("launcher")) {
            // For "Phone Lock", we don't allow even the launcher to prevent app access
            return lockType != "phone"
        }

        return false
    }
}
