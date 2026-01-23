package com.lockmoment

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import android.content.Intent

class LockAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("LockAccessibility", "Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            Log.d("LockAccessibility", "App Opened: $packageName")

            if (LockManager.isLocked) {
                if (!LockManager.isPackageAllowed(packageName)) {
                    Log.d("LockAccessibility", "Unallowed app detected. Blocking: $packageName")
                    
                    val intent = Intent(this, LockScreenActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
                    startActivity(intent)
                    
                    // Optionally, perform global action back (less aggressive) or home
                    // performGlobalAction(GLOBAL_ACTION_HOME) 
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.d("LockAccessibility", "Service Interrupted")
    }
}
