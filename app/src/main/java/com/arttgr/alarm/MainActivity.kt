package com.arttgr.alarm

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {

    private val notificationPermission =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        NotificationChannels.ensure(this)

        if (Build.VERSION.SDK_INT >= 33) {
            notificationPermission.launch(
                Manifest.permission.POST_NOTIFICATIONS
            )
        }

        setContent {
            MaterialTheme {
                AlarmApp()
            }
        }
    }

    @Composable
    private fun AlarmApp() {
        val dao = remember {
            AppDatabase.get(this).alarmDao()
        }

        val alarms by dao
            .observeAll()
            .collectAsStateWithLifecycle(emptyList())

        val scope = rememberCoroutineScope()

        var showAdd by remember {
            mutableStateOf(false)
        }

        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text("FreshStock Alarm")
                    },
                    actions = {
                        IconButton(
                            onClick = {
                                if (Build.VERSION.SDK_INT >= 31) {
                                    startActivity(
                                        Intent(
                                            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
                                        )
                                    )
                                }
                            }
                        ) {
                            Icon(
                                Icons.Default.Alarm,
                                contentDescription = "Exact alarm"
                            )
                        }
                    }
                )
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = {
                        showAdd = true
                    }
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Add alarm"
                    )
                }
            }
        ) { padding ->

            LazyColumn(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {

                items(
                    alarms,
                    key = { it.id }
                ) { alarm ->

                    AlarmCard(
                        alarm = alarm,

                        onToggle = { enabled ->
                            scope.launch {
                                val updated =
                                    alarm.copy(enabled = enabled)

                                dao.update(updated)

                                if (enabled) {
                                    AlarmScheduler(this@MainActivity)
                                        .schedule(updated)
                                } else {
                                    AlarmScheduler(this@MainActivity)
                                        .cancel(alarm.id)
                                }
                            }
                        },

                        onDelete = {
                            scope.launch {
                                AlarmScheduler(this@MainActivity)
                                    .cancel(alarm.id)

                                dao.delete(alarm)
                            }
                        }
                    )
                }

                if (alarms.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(48.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "لا توجد منبهات. اضغط + لإضافة منبه."
                            )
                        }
                    }
                }
            }
        }

        if (showAdd) {
            AddAlarmDialog(
                onDismiss = {
                    showAdd = false
                },

                onSave = { hour, minute, label, repeatDays, snooze ->
                    scope.launch {

                        val id = dao.insert(
                            AlarmEntity(
                                hour = hour,
                                minute = minute,
                                label = label,
                                repeatDays = repeatDays,
                                snoozeMinutes = snooze
                            )
                        )

                        dao.get(id)?.let {
                            AlarmScheduler(this@MainActivity)
                                .schedule(it)
                        }

                        showAdd = false
                    }
                }
            )
        }
    }

    @Composable
    private fun AlarmCard(
        alarm: AlarmEntity,
        onToggle: (Boolean) -> Unit,
        onDelete: () -> Unit
    ) {
        Card {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {

                Column(
                    modifier = Modifier.weight(1f)
                ) {

                    Text(
                        text = String.format(
                            "%02d:%02d",
                            alarm.hour,
                            alarm.minute
                        ),
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Text(
                        alarm.label.ifBlank {
                            "منبه"
                        }
                    )

                    if (alarm.repeatDays.isNotBlank()) {
                        Text("متكرر أسبوعيًا")
                    }
                }

                Switch(
                    checked = alarm.enabled,
                    onCheckedChange = onToggle
                )

                IconButton(
                    onClick = onDelete
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete"
                    )
                }
            }
        }
    }

    @Composable
    private fun AddAlarmDialog(
        onDismiss: () -> Unit,
        onSave: (
            Int,
            Int,
            String,
            String,
            Int
        ) -> Unit
    ) {

        val now = Calendar.getInstance()

        var hour by remember {
            mutableIntStateOf(
                now.get(Calendar.HOUR_OF_DAY)
            )
        }

        var minute by remember {
            mutableIntStateOf(
                now.get(Calendar.MINUTE)
            )
        }

        var label by remember {
            mutableStateOf("")
        }

        var repeat by remember {
            mutableStateOf("")
        }

        var snooze by remember {
            mutableIntStateOf(10)
        }

        AlertDialog(
            onDismissRequest = onDismiss,

            title = {
                Text("إضافة منبه")
            },

            text = {
                Column(
                    verticalArrangement =
                        Arrangement.spacedBy(12.dp)
                ) {

                    Row(
                        verticalAlignment =
                            Alignment.CenterVertically
                    ) {

                        Text("الساعة: ")

                        OutlinedTextField(
                            value = hour.toString(),

                            onValueChange = {
                                it.toIntOrNull()?.let { value ->
                                    hour = value.coerceIn(0, 23)
                                }
                            },

                            modifier = Modifier.width(90.dp)
                        )

                        Text(" : ")

                        OutlinedTextField(
                            value = minute
                                .toString()
                                .padStart(2, '0'),

                            onValueChange = {
                                it.toIntOrNull()?.let { value ->
                                    minute = value.coerceIn(0, 59)
                                }
                            },

                            modifier = Modifier.width(90.dp)
                        )
                    }

                    OutlinedTextField(
                        value = label,

                        onValueChange = {
                            label = it
                        },

                        label = {
                            Text("اسم المنبه")
                        },

                        singleLine = true
                    )

                    OutlinedTextField(
                        value = repeat,

                        onValueChange = {
                            repeat =
                                it.filter { character ->
                                    character.isDigit() ||
                                        character == ','
                                }
                        },

                        label = {
                            Text(
                                "أيام التكرار 1..7 مفصولة بفاصلة (اختياري)"
                            )
                        },

                        supportingText = {
                            Text(
                                "1=الأحد، 7=السبت"
                            )
                        }
                    )

                    OutlinedTextField(
                        value = snooze.toString(),

                        onValueChange = {
                            it.toIntOrNull()?.let { value ->
                                snooze =
                                    value.coerceIn(1, 60)
                            }
                        },

                        label = {
                            Text("الغفوة بالدقائق")
                        },

                        singleLine = true
                    )
                }
            },

            confirmButton = {
                Button(
                    onClick = {
                        onSave(
                            hour,
                            minute,
                            label,
                            repeat,
                            snooze
                        )
                    }
                ) {
                    Text("حفظ")
                }
            },

            dismissButton = {
                TextButton(
                    onClick = onDismiss
                ) {
                    Text("إلغاء")
                }
            }
        )
    }
}
