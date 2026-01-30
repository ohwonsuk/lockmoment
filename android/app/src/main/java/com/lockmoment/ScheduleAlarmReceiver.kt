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
        val lockName = intent.getStringExtra("lockName") ?: "예약 잠금"
        val durationMs = intent.getLongExtra("durationMs", 0)
        val allowedPackage = intent.getStringExtra("allowedPackage")
        val preventAppRemoval = intent.getBooleanExtra("preventAppRemoval", false)
        
        if (durationMs <= 0) {
            Log.e("ScheduleAlarmReceiver", "Invalid duration")
            return
        }
        
        try {
            // Start the lock
            LockManager.getInstance(context).startLock(durationMs, lockType, lockName, allowedPackage, preventAppRemoval)
            Log.d("ScheduleAlarmReceiver", "Lock started for schedule: $lockName ($scheduleId), Allowed: $allowedPackage, PreventRemoval: $preventAppRemoval")
            
            // Reschedule for next occurrence if it's a recurring schedule
            val days = intent.getStringArrayExtra("days")
            if (days != null && days.isNotEmpty()) {
                ScheduleAlarmManager.scheduleNextOccurrence(
                    context,
                    scheduleId,
                    intent.getStringExtra("startTime") ?: "",
                    intent.getStringExtra("endTime") ?: "",
                    days.toList(),
                    lockType,
                    lockName,
                    allowedPackage,
                    preventAppRemoval
                )
            }
        } catch (e: Exception) {
            Log.e("ScheduleAlarmReceiver", "Error starting lock", e)
        }
    }
}
