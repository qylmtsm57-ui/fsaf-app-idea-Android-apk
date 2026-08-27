plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("androidx.room")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.arttgr.alarm"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.arttgr.alarm"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

room {
    schemaDirectory("$projectDir/schemas")
}

dependencies {
    val composeBom =
        platform("androidx.compose:compose-bom:2024.12.01")

    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")

    implementation("androidx.activity:activity-compose:1.10.0")

    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    implementation("androidx.compose.ui:ui")

    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation("androidx.compose.material3:material3")

    implementation("androidx.compose.material:material-icons-extended")

    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.room:room-runtime:2.6.1")

    implementation("androidx.room:room-ktx:2.6.1")

    ksp("androidx.room:room-compiler:2.6.1")
}
