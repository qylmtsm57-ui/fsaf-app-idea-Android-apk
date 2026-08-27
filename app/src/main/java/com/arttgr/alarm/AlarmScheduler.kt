package com.arttgr.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

class AlarmScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    fun canScheduleExact(): Boolean =
        Build.VERSION.SDK_INT < 31 || alarmManager.canScheduleExactAlarms()

    fun schedule(alarm: AlarmEntity) {
        if (!alarm.enabled || !canScheduleExact()) return
        val triggerAt = nextTrigger(alarm)
        val pi = pendingIntent(alarm.id)
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            pi
        )
    }

    fun cancel(alarmId: Long) {
        alarmManager.cancel(pendingIntent(alarmId))
    }

    fun scheduleSnooze(alarmId: Long, minutes: Int) {
        val pi = pendingIntent(alarmId)
        val trigger = System.currentTimeMillis() + minutes.coerceAtLeast(1) * 60_000L
        if (canScheduleExact()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
        }
    }

    private fun pendingIntent(id: Long): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            id.toInt(),
            Intent(context, AlarmReceiver::class.java).putExtra("alarm_id", id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    private fun nextTrigger(alarm: AlarmEntity): Long {
        val days = alarm.repeatDays.split(",").mapNotNull { it.toIntOrNull() }.toSet()
        val now = Calendar.getInstance()
        val candidate = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, alarm.hour)
            set(Calendar.MINUTE, alarm.minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        if (days.isEmpty()) {
            if (!candidate.after(now)) candidate.add(Calendar.DAY_OF_YEAR, 1)
            return candidate.timeInMillis
        }

        for (i in 0..7) {
            val c = (candidate.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, i) }
            if (c.after(now) && days.contains(c.get(Calendar.DAY_OF_WEEK))) {
                return c.timeInMillis
            }
        }
        return candidate.apply { add(Calendar.DAY_OF_YEAR, 1) }.timeInMillis
    }
}
