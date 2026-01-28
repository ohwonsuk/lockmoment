package com.lockmoment

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ScheduleAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("ScheduleAlarmReceiver", "Alarm triggered")
        
        val scheduleId = intent.getStringExtra("scheduleId") ?: return
        val lockType = intent.getStringExtra("lockType") ?: "app"
        val durationMs = intent.getLongExtra("durationMs", 0)
        
        if (durationMs <= 0) {
            Log.e("ScheduleAlarmReceiver", "Invalid duration")
            return
        }
        
        try {
            // Start the lock
            LockManager.getInstance(context).startLock(durationMs, lockType)
            Log.d("ScheduleAlarmReceiver", "Lock started for schedule: $scheduleId")
            
            // Reschedule for next occurrence if it's a recurring schedule
            val days = intent.getStringArrayExtra("days")
            if (days != null && days.isNotEmpty()) {
                ScheduleAlarmManager.scheduleNextOccurrence(
                    context,
                    scheduleId,
                    intent.getStringExtra("startTime") ?: "",
                    intent.getStringExtra("endTime") ?: "",
                    days.toList(),
                    lockType
                )
            }
        } catch (e: Exception) {
            Log.e("ScheduleAlarmReceiver", "Error starting lock", e)
        }
    }
}
