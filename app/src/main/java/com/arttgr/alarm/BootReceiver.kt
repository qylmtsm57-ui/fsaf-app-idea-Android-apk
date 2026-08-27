package com.arttgr.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val alarms = AppDatabase.get(context).alarmDao().observeAll().first()
                val scheduler = AlarmScheduler(context)
                alarms.filter { it.enabled }.forEach { scheduler.schedule(it) }
            } finally {
                pending.finish()
            }
        }
    }
}
