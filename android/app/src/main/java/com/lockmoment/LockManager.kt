package com.lockmoment

object LockManager {
    var isLocked: Boolean = false
    var endTime: Long = 0
    private val allowedPackages = setOf(
        "com.lockmoment",
        "com.android.systemui",
        "com.android.settings", // Allow settings for now to avoid complete lockout during dev
        "com.google.android.inputmethod.latin", // Keyboards
        "com.samsung.android.honeyboard" // Samsung Keyboard
    )

    fun startLock(durationMs: Long) {
        endTime = System.currentTimeMillis() + durationMs
        isLocked = true
    }

    fun stopLock() {
        isLocked = false
        endTime = 0
    }

    fun isPackageAllowed(packageName: String): Boolean {
        // Simple whitelist check
        // In B2B version, this will check against a dynamic list
        return allowedPackages.contains(packageName) || packageName.contains("keyboard") || packageName.contains("launcher")
    }
}
