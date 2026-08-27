package com.arttgr.alarm

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra("alarm_id", -1L)
        if (id < 0) return

        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = AppDatabase.get(context)
                val alarm = db.alarmDao().get(id) ?: return@launch

                AlarmNotifier.show(context, alarm)

                if (alarm.enabled && alarm.repeatDays.isNotBlank()) {
                    AlarmScheduler(context).schedule(alarm)
                }
            } finally {
                pending.finish()
            }
        }
    }
}

object AlarmNotifier {
    const val CHANNEL_ID = "scheduled_alarms"
    const val NOTIFICATION_ID = 7100

    fun show(context: Context, alarm: AlarmEntity) {
        NotificationChannels.ensure(context)
        val fullScreen = Intent(context, RingingActivity::class.java).apply {
            putExtra("alarm_id", alarm.id)
            putExtra("label", alarm.label)
            putExtra("snooze", alarm.snoozeMinutes)
        }

        val fullScreenPi = android.app.PendingIntent.getActivity(
            context, alarm.id.toInt(), fullScreen,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val builder = androidx.core.app.NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(alarm.label.ifBlank { "Alarm" })
            .setContentText(String.format("%02d:%02d", alarm.hour, alarm.minute))
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
            .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(false)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPi, true)

        androidx.core.app.NotificationManagerCompat.from(context)
            .notify(NOTIFICATION_ID, builder.build())
    }
}

object NotificationChannels {
    fun ensure(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(AlarmNotifier.CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                android.app.NotificationChannel(
                    AlarmNotifier.CHANNEL_ID,
                    context.getString(com.arttgr.alarm.R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = context.getString(com.arttgr.alarm.R.string.notification_channel_description)
                    setSound(null, null)
                    enableVibration(true)
                }
            )
        }
    }
}
