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
        
        // Listen for window state changes, generic focus changes, or content changes
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || 
            event.eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            
            val packageName = event.packageName?.toString() ?: return
            
            // Avoid logic loops if it's our own lock screen
            if (packageName == "com.lockmoment") return

            val lockManager = LockManager.getInstance(this)
            if (lockManager.isLocked) {
                if (!lockManager.isPackageAllowed(packageName)) {
                    Log.d("LockAccessibility", "Blocking: $packageName (LockType: ${lockManager.lockType})")
                    
                    val intent = Intent(this, LockScreenActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                                  Intent.FLAG_ACTIVITY_SINGLE_TOP or 
                                  Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    startActivity(intent)
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.d("LockAccessibility", "Service Interrupted")
    }
}
