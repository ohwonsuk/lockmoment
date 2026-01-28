package com.lockmoment

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("BootReceiver", "Device booted, rescheduling alarms")
            
            try {
                // Reschedule all active alarms
                ScheduleAlarmManager.rescheduleAllAlarms(context)
                
                // Restore any active lock state
                LockManager.getInstance(context).restoreLockState()
                
                Log.d("BootReceiver", "Alarms rescheduled and lock state restored")
            } catch (e: Exception) {
                Log.e("BootReceiver", "Error during boot recovery", e)
            }
        }
    }
}
