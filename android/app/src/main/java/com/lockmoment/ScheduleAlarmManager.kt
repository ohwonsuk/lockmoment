package com.lockmoment

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.*

object ScheduleAlarmManager {
    private const val PREFS_NAME = "schedule_alarms"
    private const val KEY_SCHEDULES = "schedules"
    
    fun scheduleAlarm(
        context: Context,
        scheduleId: String,
        startTime: String, // HH:mm format
        endTime: String,   // HH:mm format
        days: List<String>,
        lockType: String,
        name: String = "예약 잠금",
        allowedPackage: String? = null,
        preventAppRemoval: Boolean = false,
        preLockMinutes: Int = 0
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        // Calculate duration in milliseconds
        val duration = calculateDuration(startTime, endTime)
        
        // Schedule for each day
        days.forEach { day ->
            val triggerTime = getNextTriggerTime(startTime, day)
            
            val intent = Intent(context, ScheduleAlarmReceiver::class.java).apply {
                putExtra("scheduleId", scheduleId)
                putExtra("lockType", lockType)
                putExtra("lockName", name)
                putExtra("durationMs", duration)
                putExtra("startTime", startTime)
                putExtra("endTime", endTime)
                putExtra("days", days.toTypedArray())
                putExtra("allowedPackage", allowedPackage)
                putExtra("preventAppRemoval", preventAppRemoval)
            }
            
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                "${scheduleId}_$day".hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            // Use exact alarm for precise timing
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            }
            
            Log.d("ScheduleAlarmManager", "Scheduled alarm for $name ($scheduleId) on $day at ${Date(triggerTime)}")

            // Schedule pre-lock notification if enabled
            if (preLockMinutes > 0) {
                val preLockTriggerTime = triggerTime - (preLockMinutes * 60 * 1000L)
                if (preLockTriggerTime > System.currentTimeMillis()) {
                    val preIntent = Intent(context, PreLockNotificationReceiver::class.java).apply {
                        putExtra("scheduleId", scheduleId)
                        putExtra("lockName", name)
                        putExtra("minutesBefore", preLockMinutes)
                        putExtra("startTime", startTime)
                    }
                    
                    val prePendingIntent = PendingIntent.getBroadcast(
                        context,
                        "${scheduleId}_${day}_pre".hashCode(),
                        preIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            preLockTriggerTime,
                            prePendingIntent
                        )
                    } else {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            preLockTriggerTime,
                            prePendingIntent
                        )
                    }
                    Log.d("ScheduleAlarmManager", "Scheduled pre-lock notification for $name on $day at ${Date(preLockTriggerTime)}")
                }
            }
        }
        
        // Save schedule info for rescheduling after reboot
        saveScheduleInfo(context, scheduleId, startTime, endTime, days, lockType, name, allowedPackage, preventAppRemoval, preLockMinutes)
    }
    
    fun cancelAlarm(context: Context, scheduleId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        // Load schedule info to get days
        val scheduleInfo = loadScheduleInfo(context, scheduleId)
        val days = scheduleInfo?.optJSONArray("days")?.let { jsonArray ->
            List(jsonArray.length()) { jsonArray.getString(it) }
        } ?: emptyList()
        
        days.forEach { day ->
            val intent = Intent(context, ScheduleAlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                "${scheduleId}_$day".hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)

            // Cancel pre-lock notification
            val preIntent = Intent(context, PreLockNotificationReceiver::class.java)
            val prePendingIntent = PendingIntent.getBroadcast(
                context,
                "${scheduleId}_${day}_pre".hashCode(),
                preIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(prePendingIntent)
        }
        
        // Remove from saved schedules
        removeScheduleInfo(context, scheduleId)
        Log.d("ScheduleAlarmManager", "Cancelled alarm for $scheduleId")
    }
    
    fun scheduleNextOccurrence(
        context: Context,
        scheduleId: String,
        startTime: String,
        endTime: String,
        days: List<String>,
        lockType: String,
        name: String,
        allowedPackage: String?,
        preventAppRemoval: Boolean
    ) {
        val preLockMinutes = (loadScheduleInfo(context, scheduleId))?.optInt("preLockMinutes", 0) ?: 0
        // Reschedule for next week
        scheduleAlarm(context, scheduleId, startTime, endTime, days, lockType, name, allowedPackage, preventAppRemoval, preLockMinutes)
    }
    
    fun rescheduleAllAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val schedulesJson = prefs.getString(KEY_SCHEDULES, "{}") ?: "{}"
        val schedules = JSONObject(schedulesJson)
        
        schedules.keys().forEach { scheduleId ->
            val schedule = schedules.getJSONObject(scheduleId)
            val startTime = schedule.getString("startTime")
            val endTime = schedule.getString("endTime")
            val lockType = schedule.getString("lockType")
            val name = schedule.optString("name", "예약 잠금")
            val allowedPackage = if (schedule.has("allowedPackage") && !schedule.isNull("allowedPackage")) {
                schedule.getString("allowedPackage")
            } else {
                null
            }
            val daysArray = schedule.getJSONArray("days")
            val days = List(daysArray.length()) { daysArray.getString(it) }
            val preventAppRemoval = schedule.optBoolean("preventAppRemoval", false)
            val preLockMinutes = schedule.optInt("preLockMinutes", 0)
            
            scheduleAlarm(context, scheduleId, startTime, endTime, days, lockType, name, allowedPackage, preventAppRemoval, preLockMinutes)
        }
    }
    
    private fun calculateDuration(startTime: String, endTime: String): Long {
        val start = parseTime(startTime)
        val end = parseTime(endTime)
        
        var duration = end - start
        if (duration < 0) {
            duration += 24 * 60 * 60 * 1000 // Add 24 hours if end is next day
        }
        
        return duration
    }
    
    private fun parseTime(time: String): Long {
        val parts = time.split(":")
        val hours = parts[0].toInt()
        val minutes = parts[1].toInt()
        return (hours * 60 + minutes) * 60 * 1000L
    }
    
    private fun getNextTriggerTime(time: String, day: String): Long {
        val calendar = Calendar.getInstance()
        val parts = time.split(":")
        val hours = parts[0].toInt()
        val minutes = parts[1].toInt()
        
        // Map Korean day names or English abbreviations to Calendar constants
        val dayOfWeek = when (day.uppercase()) {
            "월", "MON" -> Calendar.MONDAY
            "화", "TUE" -> Calendar.TUESDAY
            "수", "WED" -> Calendar.WEDNESDAY
            "목", "THU" -> Calendar.THURSDAY
            "금", "FRI" -> Calendar.FRIDAY
            "토", "SAT" -> Calendar.SATURDAY
            "일", "SUN" -> Calendar.SUNDAY
            else -> {
                Log.e("ScheduleAlarmManager", "Invalid day string: $day")
                // Return current day of week as fallback? Probably safer to use Monday but warn.
                Calendar.MONDAY
            }
        }
        
        calendar.set(Calendar.HOUR_OF_DAY, hours)
        calendar.set(Calendar.MINUTE, minutes)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        
        // Find next occurrence of this day
        while (calendar.get(Calendar.DAY_OF_WEEK) != dayOfWeek || calendar.timeInMillis <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1)
        }
        
        return calendar.timeInMillis
    }
    
    private fun saveScheduleInfo(
        context: Context,
        scheduleId: String,
        startTime: String,
        endTime: String,
        days: List<String>,
        lockType: String,
        name: String,
        allowedPackage: String?,
        preventAppRemoval: Boolean,
        preLockMinutes: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val schedulesJson = prefs.getString(KEY_SCHEDULES, "{}") ?: "{}"
        val schedules = JSONObject(schedulesJson)
        
        val scheduleInfo = JSONObject().apply {
            put("startTime", startTime)
            put("endTime", endTime)
            put("lockType", lockType)
            put("name", name)
            put("days", JSONArray(days))
            put("allowedPackage", allowedPackage)
            put("preventAppRemoval", preventAppRemoval)
            put("preLockMinutes", preLockMinutes)
        }
        
        schedules.put(scheduleId, scheduleInfo)
        prefs.edit().putString(KEY_SCHEDULES, schedules.toString()).apply()
    }
    
    private fun loadScheduleInfo(context: Context, scheduleId: String): JSONObject? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val schedulesJson = prefs.getString(KEY_SCHEDULES, "{}") ?: "{}"
        val schedules = JSONObject(schedulesJson)
        return schedules.optJSONObject(scheduleId)
    }
    
    private fun removeScheduleInfo(context: Context, scheduleId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val schedulesJson = prefs.getString(KEY_SCHEDULES, "{}") ?: "{}"
        val schedules = JSONObject(schedulesJson)
        schedules.remove(scheduleId)
        prefs.edit().putString(KEY_SCHEDULES, schedules.toString()).apply()
    }
}
