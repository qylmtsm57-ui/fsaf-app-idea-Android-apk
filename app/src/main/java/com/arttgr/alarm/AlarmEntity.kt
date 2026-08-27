package com.arttgr.alarm

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "alarms")
data class AlarmEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val hour: Int,
    val minute: Int,
    val label: String = "",
    val enabled: Boolean = true,
    val repeatDays: String = "",
    val snoozeMinutes: Int = 10,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true
)
