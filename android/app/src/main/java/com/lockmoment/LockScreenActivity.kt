package com.lockmoment

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.activity.OnBackPressedCallback

class LockScreenActivity : Activity() {

    private lateinit var timerText: TextView
    private val handler = Handler(Looper.getMainLooper())
    private val updateRunnable = object : Runnable {
        override fun run() {
            updateTimer()
            if (LockManager.isLocked) {
                handler.postDelayed(this, 1000)
            } else {
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock_screen)

        timerText = findViewById(R.id.timerText)

        // Disable back button
        // Note: In newer Android versions, onBackPressed() is deprecated but still works for Activities not using ComponentActivity or OnBackPressedDispatcher owner.
        // For standard Activity, overriding onBackPressed is still the simplest way in Java/Kotlin for this scope.
    }

    override fun onBackPressed() {
        // Do nothing - block back button
    }

    override fun onResume() {
        super.onResume()
        handler.post(updateRunnable)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(updateRunnable)
    }

    private fun updateTimer() {
        if (!LockManager.isLocked) {
            finish()
            return
        }

        val remaining = LockManager.endTime - System.currentTimeMillis()
        if (remaining <= 0) {
            LockManager.stopLock()
            finish()
            return
        }

        val seconds = (remaining / 1000) % 60
        val minutes = (remaining / 1000) / 60
        timerText.text = String.format("%02d:%02d", minutes, seconds)
    }
}
