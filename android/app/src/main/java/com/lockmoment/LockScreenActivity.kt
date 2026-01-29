package com.lockmoment

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import android.widget.Button
import android.content.Intent
import androidx.activity.OnBackPressedCallback

class LockScreenActivity : Activity() {

    private lateinit var timerText: TextView
    private val handler = Handler(Looper.getMainLooper())
    private val updateRunnable = object : Runnable {
        override fun run() {
            updateTimer()
            if (LockManager.getInstance(this@LockScreenActivity).isLocked) {
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
        val backToAppButton: Button = findViewById(R.id.backToAppButton)

        backToAppButton.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(intent)
            finish()
        }

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
        val lockManager = LockManager.getInstance(this)
        if (!lockManager.isLocked) {
            finish()
            return
        }

        val remaining = lockManager.endTime - System.currentTimeMillis()
        if (remaining <= 0) {
            lockManager.stopLock()
            finish()
            return
        }

        val seconds = (remaining / 1000) % 60
        val minutes = (remaining / 1000) / 60
        timerText.text = String.format("%02d:%02d", minutes, seconds)
    }
}
