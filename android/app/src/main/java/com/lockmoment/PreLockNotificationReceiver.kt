package com.lockmoment

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class PreLockNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val scheduleId = intent.getStringExtra("scheduleId") ?: return
        val lockName = intent.getStringExtra("lockName") ?: "예약 잠금"
        val minutesBefore = intent.getIntExtra("minutesBefore", 0)
        
        Log.d("PreLockNotificationReceiver", "Received pre-lock alert for $lockName ($scheduleId)")
        
        if (minutesBefore > 0) {
            NotificationHelper.sendNotification(
                context,
                "잠금 시작 예고",
                "${minutesBefore}분 뒤에 '$lockName'이 시작됩니다."
            )
        }
    }
}
