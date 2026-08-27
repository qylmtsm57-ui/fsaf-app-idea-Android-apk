package com.arttgr.alarm

import android.app.KeyguardManager
import android.content.Context
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class RingingActivity : ComponentActivity() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var alarmId: Long = -1
    private var snoozeMinutes: Int = 10

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        (getSystemService(KEYGUARD_SERVICE) as KeyguardManager)
            .requestDismissKeyguard(this, null)

        alarmId = intent.getLongExtra("alarm_id", -1)
        snoozeMinutes = intent.getIntExtra("snooze", 10)

        startAlarmEffects()

        setContent {
            MaterialTheme {
                Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("⏰", style = MaterialTheme.typography.displayLarge)
                    Spacer(Modifier.height(20.dp))
                    Text("حان وقت المنبه", style = MaterialTheme.typography.headlineMedium)
                    Spacer(Modifier.height(12.dp))
                    Text(intent.getStringExtra("label").orEmpty().ifBlank { "منبه" })
                    Spacer(Modifier.height(40.dp))
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { stopAlarm() }
                    ) { Text("إيقاف") }
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { snoozeAlarm() }
                    ) { Text("غفوة $snoozeMinutes دقيقة") }
                }
            }
        }
    }

    private fun startAlarmEffects() {
        try {
            val uri = Settings.System.DEFAULT_ALARM_ALERT_URI
            player = MediaPlayer().apply {
                setDataSource(this@RingingActivity, uri)
                setAudioStreamType(AudioManager.STREAM_ALARM)
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
            // Notification still provides the alarm UI.
        }

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        vibrator?.vibrate(
            VibrationEffect.createWaveform(longArrayOf(0, 700, 500), 0)
        )
    }

    private fun stopAlarm() {
        stopAlarmNotification()
        stopEffects()
        finishAndRemoveTask()
    }

    private fun snoozeAlarm() {
        stopAlarmNotification()
        stopEffects()
        if (alarmId >= 0) AlarmScheduler(this).scheduleSnooze(alarmId, snoozeMinutes)
        finishAndRemoveTask()
    }

    private fun stopEffects() {
        player?.runCatching { stop(); release() }
        player = null
        vibrator?.cancel()
    }

    override fun onDestroy() {
        stopEffects()
        super.onDestroy()
    }
}

private fun RingingActivity.stopAlarmNotification() {
    androidx.core.app.NotificationManagerCompat.from(this)
        .cancel(AlarmNotifier.NOTIFICATION_ID)
}
