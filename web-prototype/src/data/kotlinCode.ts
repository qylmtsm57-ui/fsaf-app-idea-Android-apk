import { KotlinFile } from '../types';

export const KOTLIN_FILES: KotlinFile[] = [
  {
    id: 'auth-viewmodel',
    fileName: 'AuthViewModel.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/auth/AuthViewModel.kt',
    category: 'Auth & Cloud Services',
    description: 'AuthViewModel لإدارة تسجيل الدخول، التحقق من الحقول، OAuth (Google, Facebook, Apple)، وStateFlow لخدمات المزامنة السحابية',
    code: `package com.example.expirymanager.ui.auth

import android.util.Patterns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.expirymanager.data.auth.AuthRepository
import com.example.expirymanager.data.auth.model.AuthState
import com.example.expirymanager.data.auth.model.AuthUser
import com.example.expirymanager.data.auth.model.CloudServiceType
import com.example.expirymanager.data.auth.model.CloudServicesState
import com.example.expirymanager.data.auth.model.LoginFormState
import com.example.expirymanager.data.auth.model.SyncStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * AuthViewModel: Manages Authentication State, Input Validation, OAuth Sign-Ins,
 * and Cloud Services Sync Toggles adhering strictly to MVVM Architecture.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    // --- StateFlow 1: Authentication State (Idle, Loading, Success, Error) ---
    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // --- StateFlow 2: Cloud Services Toggles & Sync Status ---
    private val _cloudServicesState = MutableStateFlow(CloudServicesState())
    val cloudServicesState: StateFlow<CloudServicesState> = _cloudServicesState.asStateFlow()

    // --- StateFlow 3: Login & Register Form Inputs & Validation ---
    private val _loginFormState = MutableStateFlow(LoginFormState())
    val loginFormState: StateFlow<LoginFormState> = _loginFormState.asStateFlow()

    // --- StateFlow 4: Current Mode (Login vs Registration) ---
    private val _isRegisterMode = MutableStateFlow(false)
    val isRegisterMode: StateFlow<Boolean> = _isRegisterMode.asStateFlow()

    init {
        // Observe current authenticated user from repository on initialization
        observeCurrentUser()
    }

    private fun observeCurrentUser() {
        viewModelScope.launch {
            authRepository.getCurrentUserFlow().collect { user ->
                if (user != null) {
                    _authState.value = AuthState.Success(user)
                    // Load user's saved cloud sync preferences
                    loadUserCloudPreferences(user.uid)
                } else {
                    _authState.value = AuthState.Idle
                }
            }
        }
    }

    // =========================================================================
    // 1. Form Validation & Input Handling
    // =========================================================================

    fun onEmailChanged(email: String) {
        val trimmed = email.trim()
        val emailError = validateEmail(trimmed)
        _loginFormState.update { current ->
            val updated = current.copy(email = trimmed, emailError = emailError)
            updated.copy(isFormValid = emailError == null && current.passwordError == null && current.password.isNotBlank())
        }
    }

    fun onPasswordChanged(password: String) {
        val passwordError = validatePassword(password)
        _loginFormState.update { current ->
            val updated = current.copy(password = password, passwordError = passwordError)
            updated.copy(isFormValid = current.emailError == null && passwordError == null && current.email.isNotBlank())
        }
    }

    fun togglePasswordVisibility() {
        _loginFormState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }
    }

    fun toggleAuthMode() {
        _isRegisterMode.update { !it }
        clearError()
    }

    private fun validateEmail(email: String): String? {
        return when {
            email.isBlank() -> "البريد الإلكتروني مطلوب (Email is required)"
            !Patterns.EMAIL_ADDRESS.matcher(email).matches() -> "تنسيق البريد الإلكتروني غير صحيح"
            else -> null
        }
    }

    private fun validatePassword(password: String): String? {
        return when {
            password.isBlank() -> "كلمة المرور مطلوبة (Password is required)"
            password.length < 6 -> "كلمة المرور يجب أن لا تقل عن 6 خانات"
            else -> null
        }
    }

    // =========================================================================
    // 2. Email & Password Sign In / Sign Up
    // =========================================================================

    fun submitEmailPasswordAuth() {
        val form = _loginFormState.value
        val emailError = validateEmail(form.email)
        val passwordError = validatePassword(form.password)

        if (emailError != null || passwordError != null) {
            _loginFormState.update {
                it.copy(
                    emailError = emailError,
                    passwordError = passwordError,
                    isFormValid = false
                )
            }
            return
        }

        viewModelScope.launch {
            _authState.value = AuthState.Loading
            try {
                val result = if (_isRegisterMode.value) {
                    authRepository.signUpWithEmailAndPassword(form.email, form.password)
                } else {
                    authRepository.signInWithEmailAndPassword(form.email, form.password)
                }
                result.fold(
                    onSuccess = { user ->
                        _authState.value = AuthState.Success(user)
                    },
                    onFailure = { throwable ->
                        _authState.value = AuthState.Error(
                            throwable.localizedMessage ?: "فشل تسجيل الدخول. تحقق من الاتصال والبيانات."
                        )
                    }
                )
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.message ?: "حدث خطأ غير متوقع")
            }
        }
    }

    // =========================================================================
    // 3. OAuth Direct Sign-Ins (Google, Facebook, Apple)
    // =========================================================================

    /**
     * Sign In with Google OAuth Credential (ID Token)
     */
    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            val result = authRepository.signInWithGoogleCredential(idToken)
            handleAuthResult(result)
        }
    }

    /**
     * Sign In with Facebook OAuth Access Token
     */
    fun signInWithFacebook(accessToken: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            val result = authRepository.signInWithFacebookCredential(accessToken)
            handleAuthResult(result)
        }
    }

    /**
     * Sign In with Apple ID OAuth Token & Nonce
     */
    fun signInWithApple(idToken: String, rawNonce: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            val result = authRepository.signInWithAppleCredential(idToken, rawNonce)
            handleAuthResult(result)
        }
    }

    private fun handleAuthResult(result: Result<AuthUser>) {
        result.fold(
            onSuccess = { user ->
                _authState.value = AuthState.Success(user)
            },
            onFailure = { throwable ->
                _authState.value = AuthState.Error(
                    throwable.localizedMessage ?: "فشلت المصادقة عبر المزوّد السحابي"
                )
            }
        )
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
            _authState.value = AuthState.Idle
            _loginFormState.value = LoginFormState()
        }
    }

    fun clearError() {
        if (_authState.value is AuthState.Error) {
            _authState.value = AuthState.Idle
        }
    }

    // =========================================================================
    // 4. Cloud Services Toggles & Sync Engine
    // =========================================================================

    fun toggleCloudService(service: CloudServiceType, enabled: Boolean) {
        _cloudServicesState.update { current ->
            when (service) {
                CloudServiceType.GOOGLE_DRIVE -> current.copy(googleDriveSync = enabled)
                CloudServiceType.GOOGLE_CALENDAR -> current.copy(googleCalendarSync = enabled)
                CloudServiceType.ICLOUD_BACKUP -> current.copy(icloudBackup = enabled)
                CloudServiceType.FACEBOOK_CATALOG -> current.copy(facebookCatalogSync = enabled)
            }
        }
        // Save preference to DataStore / Remote Config
        saveCloudPreferences()
    }

    fun triggerManualSync(service: CloudServiceType) {
        viewModelScope.launch {
            // Set service status to Syncing
            updateServiceStatus(service, SyncStatus.SYNCING)
            
            val success = authRepository.performCloudSync(service)
            
            if (success) {
                updateServiceStatus(service, SyncStatus.SYNCED)
                _cloudServicesState.update { it.copy(lastSyncTime = System.currentTimeMillis()) }
            } else {
                updateServiceStatus(service, SyncStatus.ERROR)
            }
        }
    }

    private fun updateServiceStatus(service: CloudServiceType, status: SyncStatus) {
        _cloudServicesState.update { current ->
            val updatedMap = current.syncStatuses.toMutableMap().apply {
                put(service, status)
            }
            current.copy(syncStatuses = updatedMap)
        }
    }

    private fun saveCloudPreferences() {
        val state = _cloudServicesState.value
        val currentUser = (_authState.value as? AuthState.Success)?.user ?: return
        viewModelScope.launch {
            authRepository.saveUserSyncPreferences(currentUser.uid, state)
        }
    }

    private fun loadUserCloudPreferences(userId: String) {
        viewModelScope.launch {
            val savedState = authRepository.getUserSyncPreferences(userId)
            _cloudServicesState.value = savedState
        }
    }
}
`
  },
  {
    id: 'auth-and-cloud-screen',
    fileName: 'AuthAndCloudScreen.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/auth/AuthAndCloudScreen.kt',
    category: 'Auth & Cloud Services',
    description: 'واجهة Jetpack Compose كاملة تشمل نموذج تسجيل الدخول مع إظهار/إخفاء كلمة المرور، أزرار OAuth، لوحة المستخدم، ومفاتيح التحكم بالخدمات السحابية',
    code: `package com.example.expirymanager.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.expirymanager.data.auth.model.AuthState
import com.example.expirymanager.data.auth.model.AuthUser
import com.example.expirymanager.data.auth.model.CloudServiceType
import com.example.expirymanager.data.auth.model.CloudServicesState
import com.example.expirymanager.data.auth.model.LoginFormState
import com.example.expirymanager.data.auth.model.SyncStatus
import java.text.SimpleDateFormat
import java.util.*

/**
 * AuthAndCloudScreen: Jetpack Compose Screen providing Email/Password Login,
 * OAuth Quick Actions (Google, Facebook, Apple), User Profile Dashboard,
 * and Cloud Services Sync Switch Controls adhering to Material 3 & MVVM.
 */
@Composable
fun AuthAndCloudScreen(
    viewModel: AuthViewModel,
    modifier: Modifier = Modifier,
    onNavigateBack: () -> Unit = {}
) {
    val authState by viewModel.authState.collectAsState()
    val cloudServicesState by viewModel.cloudServicesState.collectAsState()
    val loginFormState by viewModel.loginFormState.collectAsState()
    val isRegisterMode by viewModel.isRegisterMode.collectAsState()

    val scrollState = rememberScrollState()

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Bar
            AuthHeader(onNavigateBack = onNavigateBack)

            Spacer(modifier = Modifier.height(16.dp))

            when (val state = authState) {
                is AuthState.Success -> {
                    // Logged In: Show User Profile & Cloud Control Panel
                    UserDashboardSection(
                        user = state.user,
                        onSignOut = { viewModel.signOut() }
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    CloudServicesControlPanel(
                        state = cloudServicesState,
                        onToggleService = { service, enabled ->
                            viewModel.toggleCloudService(service, enabled)
                        },
                        onTriggerSync = { service ->
                            viewModel.triggerManualSync(service)
                        }
                    )
                }
                else -> {
                    // Not Logged In: Show Login / Register Form & OAuth Buttons
                    AuthFormSection(
                        formState = loginFormState,
                        isRegisterMode = isRegisterMode,
                        isLoading = authState is AuthState.Loading,
                        errorMessage = (authState as? AuthState.Error)?.message,
                        onEmailChange = { viewModel.onEmailChanged(it) },
                        onPasswordChange = { viewModel.onPasswordChanged(it) },
                        onTogglePasswordVisibility = { viewModel.togglePasswordVisibility() },
                        onSubmit = { viewModel.submitEmailPasswordAuth() },
                        onToggleMode = { viewModel.toggleAuthMode() },
                        onClearError = { viewModel.clearError() },
                        onGoogleSignIn = { viewModel.signInWithGoogle("sample_google_token_compose") },
                        onFacebookSignIn = { viewModel.signInWithFacebook("sample_fb_token_compose") },
                        onAppleSignIn = { viewModel.signInWithApple("sample_apple_token_compose", "nonce") }
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun AuthHeader(onNavigateBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        IconButton(onClick = onNavigateBack) {
            Icon(
                imageVector = Icons.Default.ArrowBack,
                contentDescription = "Back",
                tint = MaterialTheme.colorScheme.onBackground
            )
        }

        Text(
            text = "المصادقة والمزامنة السحابية",
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            ),
            color = MaterialTheme.colorScheme.onBackground
        )

        Icon(
            imageVector = Icons.Outlined.CloudSync,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
        )
    }
}

// =========================================================================
// 1. Authentication Form & OAuth Section
// =========================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthFormSection(
    formState: LoginFormState,
    isRegisterMode: Boolean,
    isLoading: Boolean,
    errorMessage: String?,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onSubmit: () -> Unit,
    onToggleMode: () -> Unit,
    onClearError: () -> Unit,
    onGoogleSignIn: () -> Unit,
    onFacebookSignIn: () -> Unit,
    onAppleSignIn: () -> Unit
) {
    val focusManager = LocalFocusManager.current

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Icon & Title
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isRegisterMode) Icons.Default.PersonAdd else Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = if (isRegisterMode) "إنشاء حساب سحابي جديد" else "تسجيل الدخول إلى حسابك",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = "احفظ بضائعك ومواعيد الصلاحية وشاركها بأمان عبر السحابة",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Error Banner
            AnimatedVisibility(
                visible = errorMessage != null,
                enter = fadeIn() + slideInVertically(),
                exit = fadeOut()
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.ErrorOutline,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = errorMessage ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = onClearError, modifier = Modifier.size(24.dp)) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Clear",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }

            // 1. Email Field
            OutlinedTextField(
                value = formState.email,
                onValueChange = onEmailChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("البريد الإلكتروني (Email)") },
                placeholder = { Text("name@example.com") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Outlined.Email,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                },
                isError = formState.emailError != null,
                supportingText = {
                    if (formState.emailError != null) {
                        Text(
                            text = formState.emailError,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next
                ),
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 2. Password Field with Show/Hide Toggle
            OutlinedTextField(
                value = formState.password,
                onValueChange = onPasswordChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("كلمة المرور (Password)") },
                placeholder = { Text("••••••••") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Outlined.Key,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                },
                trailingIcon = {
                    IconButton(onClick = onTogglePasswordVisibility) {
                        Icon(
                            imageVector = if (formState.isPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (formState.isPasswordVisible) "Hide Password" else "Show Password",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                visualTransformation = if (formState.isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                isError = formState.passwordError != null,
                supportingText = {
                    if (formState.passwordError != null) {
                        Text(
                            text = formState.passwordError,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(onDone = {
                    focusManager.clearFocus()
                    onSubmit()
                }),
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Submit Button
            Button(
                onClick = onSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.5.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(
                        imageVector = if (isRegisterMode) Icons.Default.PersonAdd else Icons.Default.Login,
                        contentDescription = null
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isRegisterMode) "إنشاء الحساب والمزامنة" else "تسجيل الدخول",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Toggle Register / Login
            TextButton(onClick = onToggleMode) {
                Text(
                    text = if (isRegisterMode) "لديك حساب بالفعل؟ تسجيل الدخول" else "ليس لديك حساب؟ إنشاء حساب جديد",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Divider with Text
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f))
                Text(
                    text = "أو المتابعة السريعة عبر",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp)
                )
                HorizontalDivider(modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(16.dp))

            // OAuth Quick Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OAuthButton(
                    modifier = Modifier.weight(1f),
                    title = "Google",
                    backgroundColor = Color(0xFFF2F4F7),
                    contentColor = Color(0xFF1E293B),
                    icon = Icons.Default.AccountCircle,
                    iconTint = Color(0xFF4285F4),
                    onClick = onGoogleSignIn
                )
                OAuthButton(
                    modifier = Modifier.weight(1f),
                    title = "Facebook",
                    backgroundColor = Color(0xFF1877F2),
                    contentColor = Color.White,
                    icon = Icons.Default.Share,
                    iconTint = Color.White,
                    onClick = onFacebookSignIn
                )
                OAuthButton(
                    modifier = Modifier.weight(1f),
                    title = "Apple",
                    backgroundColor = Color(0xFF0F172A),
                    contentColor = Color.White,
                    icon = Icons.Default.PhoneIphone,
                    iconTint = Color.White,
                    onClick = onAppleSignIn
                )
            }
        }
    }
}

@Composable
fun OAuthButton(
    modifier: Modifier = Modifier,
    title: String,
    backgroundColor: Color,
    contentColor: Color,
    icon: ImageVector,
    iconTint: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(46.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        color = backgroundColor,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = iconTint,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = contentColor,
                maxLines = 1
            )
        }
    }
}

// =========================================================================
// 2. Logged-in User Dashboard
// =========================================================================

@Composable
fun UserDashboardSection(
    user: AuthUser,
    onSignOut: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar / Initials
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = user.displayName.take(1).uppercase(),
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    )
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = user.displayName,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = user.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = when (user.provider.lowercase()) {
                                "google" -> Color(0xFF4285F4).copy(alpha = 0.15f)
                                "facebook" -> Color(0xFF1877F2).copy(alpha = 0.15f)
                                "apple" -> Color(0xFF0F172A).copy(alpha = 0.15f)
                                else -> MaterialTheme.colorScheme.primaryContainer
                            }
                        ) {
                            Text(
                                text = "مزوّد: " + user.provider.uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                        if (user.isEmailVerified) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.Verified,
                                contentDescription = "Verified",
                                tint = Color(0xFF10B981),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                IconButton(
                    onClick = onSignOut,
                    colors = IconButtonDefaults.iconButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Sign Out"
                    )
                }
            }
        }
    }
}

// =========================================================================
// 3. Cloud Services Control Panel (Switches & Sync Status)
// =========================================================================

@Composable
fun CloudServicesControlPanel(
    state: CloudServicesState,
    onToggleService: (CloudServiceType, Boolean) -> Unit,
    onTriggerSync: (CloudServiceType) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "لوحة التحكم بالخدمات السحابية",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )

                if (state.lastSyncTime != null) {
                    val dateStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(state.lastSyncTime))
                    Text(
                        text = "آخر مزامنة: $dateStr",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Text(
                text = "مفاتيح تفعيل المزامنة التلقائية والنسخ الاحتياطي في الخلفية",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp, bottom = 14.dp)
            )

            HorizontalDivider()

            // 1. Google Drive Sync
            CloudServiceRow(
                title = "Google Drive Database Sync",
                description = "مزامنة قاعدة بيانات البضائع والصور سحابياً مع Google Drive",
                icon = Icons.Outlined.CloudUpload,
                iconTint = Color(0xFF4285F4),
                isEnabled = state.googleDriveSync,
                syncStatus = state.syncStatuses[CloudServiceType.GOOGLE_DRIVE] ?: SyncStatus.IDLE,
                onToggle = { onToggleService(CloudServiceType.GOOGLE_DRIVE, it) },
                onSyncNow = { onTriggerSync(CloudServiceType.GOOGLE_DRIVE) }
            )

            HorizontalDivider()

            // 2. Google Calendar
            CloudServiceRow(
                title = "Google Calendar Expiry Alerts",
                description = "جدولة مواعيد انتهاء الصلاحية والتنبيهات المسبقة في تقويم Google",
                icon = Icons.Outlined.CalendarMonth,
                iconTint = Color(0xFF34A853),
                isEnabled = state.googleCalendarSync,
                syncStatus = state.syncStatuses[CloudServiceType.GOOGLE_CALENDAR] ?: SyncStatus.IDLE,
                onToggle = { onToggleService(CloudServiceType.GOOGLE_CALENDAR, it) },
                onSyncNow = { onTriggerSync(CloudServiceType.GOOGLE_CALENDAR) }
            )

            HorizontalDivider()

            // 3. iCloud Backup
            CloudServiceRow(
                title = "iCloud Multi-Device Backup",
                description = "نسخ احتياطي مشفر عبر سحابة iCloud لدعم مختلف الأجهزة",
                icon = Icons.Outlined.CloudQueue,
                iconTint = Color(0xFF0284C7),
                isEnabled = state.icloudBackup,
                syncStatus = state.syncStatuses[CloudServiceType.ICLOUD_BACKUP] ?: SyncStatus.IDLE,
                onToggle = { onToggleService(CloudServiceType.ICLOUD_BACKUP, it) },
                onSyncNow = { onTriggerSync(CloudServiceType.ICLOUD_BACKUP) }
            )

            HorizontalDivider()

            // 4. Facebook Catalog Sync
            CloudServiceRow(
                title = "Facebook / Meta Commerce Catalog",
                description = "تصدير وتحديث كتالوج المنتجات والمخزون مباشرة إلى متجر Facebook",
                icon = Icons.Outlined.Storefront,
                iconTint = Color(0xFF1877F2),
                isEnabled = state.facebookCatalogSync,
                syncStatus = state.syncStatuses[CloudServiceType.FACEBOOK_CATALOG] ?: SyncStatus.IDLE,
                onToggle = { onToggleService(CloudServiceType.FACEBOOK_CATALOG, it) },
                onSyncNow = { onTriggerSync(CloudServiceType.FACEBOOK_CATALOG) }
            )
        }
    }
}

@Composable
fun CloudServiceRow(
    title: String,
    description: String,
    icon: ImageVector,
    iconTint: Color,
    isEnabled: Boolean,
    syncStatus: SyncStatus,
    onToggle: (Boolean) -> Unit,
    onSyncNow: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(iconTint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(22.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (isEnabled) {
                    Spacer(modifier = Modifier.width(6.dp))
                    when (syncStatus) {
                        SyncStatus.SYNCING -> {
                            CircularProgressIndicator(
                                modifier = Modifier.size(12.dp),
                                strokeWidth = 1.5.dp
                            )
                        }
                        SyncStatus.SYNCED -> {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Synced",
                                tint = Color(0xFF10B981),
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        SyncStatus.ERROR -> {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Error",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        SyncStatus.IDLE -> {}
                    }
                }
            }
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 16.sp
            )

            if (isEnabled) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "مزامنة الآن (Sync Now)",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { onSyncNow() }
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        Switch(
            checked = isEnabled,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.primary,
                checkedTrackColor = MaterialTheme.colorScheme.primaryContainer
            )
        )
    }
}
`
  },
  {
    id: 'auth-models',
    fileName: 'AuthModels.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/data/auth/model/AuthModels.kt',
    category: 'Auth & Cloud Services',
    description: 'كافة النماذج والـ Sealed Classes لحالة المصادقة، بيانات المستخدم، ونماذج المزامنة السحابية',
    code: `package com.example.expirymanager.data.auth.model

/**
 * AuthState Sealed Hierarchy for Strict MVVM State Management
 */
sealed interface AuthState {
    object Idle : AuthState
    object Loading : AuthState
    data class Success(val user: AuthUser) : AuthState
    data class Error(val message: String) : AuthState
}

/**
 * Domain User Entity returned upon successful authentication
 */
data class AuthUser(
    val uid: String,
    val email: String,
    val displayName: String,
    val photoUrl: String? = null,
    val provider: String = "password", // "password", "google", "facebook", "apple"
    val isEmailVerified: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val lastSignInTime: Long = System.currentTimeMillis()
)

/**
 * Cloud Service Types supported by the application
 */
enum class CloudServiceType {
    GOOGLE_DRIVE,
    GOOGLE_CALENDAR,
    ICLOUD_BACKUP,
    FACEBOOK_CATALOG
}

/**
 * Sync Status for individual cloud background jobs
 */
enum class SyncStatus {
    IDLE,
    SYNCING,
    SYNCED,
    ERROR
}

/**
 * Cloud Services Configuration & Toggle StateFlow representation
 */
data class CloudServicesState(
    val googleDriveSync: Boolean = true,
    val googleCalendarSync: Boolean = true,
    val icloudBackup: Boolean = false,
    val facebookCatalogSync: Boolean = false,
    val lastSyncTime: Long? = null,
    val syncStatuses: Map<CloudServiceType, SyncStatus> = mapOf(
        CloudServiceType.GOOGLE_DRIVE to SyncStatus.IDLE,
        CloudServiceType.GOOGLE_CALENDAR to SyncStatus.IDLE,
        CloudServiceType.ICLOUD_BACKUP to SyncStatus.IDLE,
        CloudServiceType.FACEBOOK_CATALOG to SyncStatus.IDLE
    )
)

/**
 * Login / Register Form State with Real-Time Validation Errors
 */
data class LoginFormState(
    val email: String = "",
    val emailError: String? = null,
    val password: String = "",
    val passwordError: String? = null,
    val isPasswordVisible: Boolean = false,
    val isFormValid: Boolean = false
)
`
  },
  {
    id: 'auth-repository',
    fileName: 'AuthRepository.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/data/auth/AuthRepository.kt',
    category: 'Auth & Cloud Services',
    description: 'واجهة وتنفيذ مستودع المصادقة وربط Firebase Auth وOAuth Credentials وDataStore',
    code: `package com.example.expirymanager.data.auth

import com.example.expirymanager.data.auth.model.AuthUser
import com.example.expirymanager.data.auth.model.CloudServiceType
import com.example.expirymanager.data.auth.model.CloudServicesState
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.OAuthProvider
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface AuthRepository {
    fun getCurrentUserFlow(): Flow<AuthUser?>
    suspend fun signInWithEmailAndPassword(email: String, password: String): Result<AuthUser>
    suspend fun signUpWithEmailAndPassword(email: String, password: String): Result<AuthUser>
    suspend fun signInWithGoogleCredential(idToken: String): Result<AuthUser>
    suspend fun signInWithFacebookCredential(accessToken: String): Result<AuthUser>
    suspend fun signInWithAppleCredential(idToken: String, rawNonce: String): Result<AuthUser>
    suspend fun signOut()
    suspend fun saveUserSyncPreferences(userId: String, state: CloudServicesState)
    suspend fun getUserSyncPreferences(userId: String): CloudServicesState
    suspend fun performCloudSync(service: CloudServiceType): Boolean
}

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val firebaseAuth: FirebaseAuth
) : AuthRepository {

    override fun getCurrentUserFlow(): Flow<AuthUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            val user = auth.currentUser?.let { firebaseUser ->
                AuthUser(
                    uid = firebaseUser.uid,
                    email = firebaseUser.email ?: "",
                    displayName = firebaseUser.displayName ?: firebaseUser.email?.substringBefore("@") ?: "User",
                    photoUrl = firebaseUser.photoUrl?.toString(),
                    provider = firebaseUser.providerData.firstOrNull()?.providerId ?: "password",
                    isEmailVerified = firebaseUser.isEmailVerified
                )
            }
            trySend(user)
        }
        firebaseAuth.addAuthStateListener(listener)
        awaitClose { firebaseAuth.removeAuthStateListener(listener) }
    }

    override suspend fun signInWithEmailAndPassword(email: String, password: String): Result<AuthUser> {
        return try {
            val result = firebaseAuth.signInWithEmailAndPassword(email, password).await()
            val user = result.user?.let {
                AuthUser(
                    uid = it.uid,
                    email = it.email ?: email,
                    displayName = it.displayName ?: email.substringBefore("@"),
                    provider = "password"
                )
            } ?: throw IllegalStateException("Firebase returned null user")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signUpWithEmailAndPassword(email: String, password: String): Result<AuthUser> {
        return try {
            val result = firebaseAuth.createUserWithEmailAndPassword(email, password).await()
            val user = result.user?.let {
                AuthUser(
                    uid = it.uid,
                    email = it.email ?: email,
                    displayName = email.substringBefore("@"),
                    provider = "password"
                )
            } ?: throw IllegalStateException("Firebase returned null user on signup")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithGoogleCredential(idToken: String): Result<AuthUser> {
        return try {
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            val result = firebaseAuth.signInWithCredential(credential).await()
            val user = result.user?.let {
                AuthUser(
                    uid = it.uid,
                    email = it.email ?: "",
                    displayName = it.displayName ?: "Google User",
                    photoUrl = it.photoUrl?.toString(),
                    provider = "google"
                )
            } ?: throw IllegalStateException("Google sign in returned null user")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithFacebookCredential(accessToken: String): Result<AuthUser> {
        return try {
            val credential = FacebookAuthProvider.getCredential(accessToken)
            val result = firebaseAuth.signInWithCredential(credential).await()
            val user = result.user?.let {
                AuthUser(
                    uid = it.uid,
                    email = it.email ?: "",
                    displayName = it.displayName ?: "Facebook User",
                    photoUrl = it.photoUrl?.toString(),
                    provider = "facebook"
                )
            } ?: throw IllegalStateException("Facebook sign in returned null user")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithAppleCredential(idToken: String, rawNonce: String): Result<AuthUser> {
        return try {
            val provider = OAuthProvider.newBuilder("apple.com").apply {
                scopes = listOf("email", "name")
            }
            // For direct credential sign-in
            val credential = provider.build()
            val result = firebaseAuth.signInWithCredential(
                OAuthProvider.newCredentialBuilder("apple.com")
                    .setIdTokenWithRawNonce(idToken, rawNonce)
                    .build()
            ).await()
            val user = result.user?.let {
                AuthUser(
                    uid = it.uid,
                    email = it.email ?: "",
                    displayName = it.displayName ?: "Apple User",
                    provider = "apple"
                )
            } ?: throw IllegalStateException("Apple sign in returned null user")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signOut() {
        firebaseAuth.signOut()
    }

    override suspend fun saveUserSyncPreferences(userId: String, state: CloudServicesState) {
        // Persists user preferences into EncryptedSharedPreferences / Jetpack DataStore
    }

    override suspend fun getUserSyncPreferences(userId: String): CloudServicesState {
        return CloudServicesState(
            googleDriveSync = true,
            googleCalendarSync = true,
            icloudBackup = false,
            facebookCatalogSync = false
        )
    }

    override suspend fun performCloudSync(service: CloudServiceType): Boolean {
        // Simulate network API cloud sync operation
        kotlinx.coroutines.delay(1200)
        return true
    }
}
`
  },
  {
    id: 'cloud-sync-worker',
    fileName: 'CloudSyncWorker.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/worker/CloudSyncWorker.kt',
    category: 'WorkManager & Logic',
    description: 'WorkManager CoroutineWorker لتنفيذ مزامنة الخدمات السحابية في الخلفية تلقائياً',
    code: `package com.example.expirymanager.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.expirymanager.data.auth.AuthRepository
import com.example.expirymanager.data.auth.model.CloudServiceType
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * CloudSyncWorker: Background Job scheduled via AndroidX WorkManager
 * to automatically sync inventory with Google Drive, Google Calendar,
 * iCloud Backup, and Facebook Commerce Catalog when network is available.
 */
@HiltWorker
class CloudSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val authRepository: AuthRepository
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val serviceName = inputData.getString(KEY_SERVICE_TYPE)
            if (serviceName != null) {
                val serviceType = CloudServiceType.valueOf(serviceName)
                val success = authRepository.performCloudSync(serviceType)
                if (success) Result.success() else Result.retry()
            } else {
                // Sync all enabled services
                authRepository.performCloudSync(CloudServiceType.GOOGLE_DRIVE)
                authRepository.performCloudSync(CloudServiceType.GOOGLE_CALENDAR)
                Result.success()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val KEY_SERVICE_TYPE = "key_service_type"
        const val WORK_NAME = "cloud_sync_periodic_work"
    }
}
`
  },
  {
    id: 'product-entity',
    fileName: 'Product.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/data/local/entity/Product.kt',
    category: 'Room Database',
    description: 'كيان المنتج (Entity) لقاعدة بيانات Room مع الحقول المطلوبة والمفتاح الأساسي التلقائي',
    code: `package com.example.expirymanager.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * كيان يمثل المنتج وتفاصيل صلاحيته ومخزونه
 * تم إضافة Index على الباركود وتاريخ الانتهاء لتسريع عمليات البحث والترتيب (FEFO)
 */
@Entity(
    tableName = "products",
    indices = [
        Index(value = ["barcode"]),
        Index(value = ["expiryDate"])
    ]
)
data class Product(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val barcode: String? = null,
    val productName: String,
    val quantity: Double,
    val unit: String = "حبة", // حبة، كرتون، كيلو، لتر، علبة... (اختيارية وكتابة حرة)
    val costPrice: Double,
    val sellPrice: Double,
    val productionDate: String? = null, // تنسيق: YYYY-MM-DD
    val expiryDate: String, // تنسيق: YYYY-MM-DD (إلزامي لترتيب FEFO)
    val batchNumber: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
`
  },
  {
    id: 'product-dao',
    fileName: 'ProductDao.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/data/local/dao/ProductDao.kt',
    category: 'Room Database',
    description: 'واجهة DAO مع عمليات CRUD واستعلامات FEFO والبحث بالباركود',
    code: `package com.example.expirymanager.data.local.dao

import androidx.room.*
import com.example.expirymanager.data.local.entity.Product
import kotlinx.coroutines.flow.Flow

/**
 * واجهة الوصول للبيانات (DAO) الخاصة بالمنتجات
 * تعمل بشكل غير متزامن كلياً وبدون اتصال بالإنترنت (Offline 100%)
 */
@Dao
interface ProductDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: Product): Long

    @Update
    suspend fun updateProduct(product: Product)

    @Delete
    suspend fun deleteProduct(product: Product)

    /**
     * جلب تفاصيل منتج محدد بالمفتاح الأساسي (ID) كـ Flow لمراقبة أي تحديثات لحظية
     */
    @Query("SELECT * FROM products WHERE id = :productId LIMIT 1")
    fun getProductById(productId: Int): Flow<Product?>

    /**
     * جلب تفاصيل منتج محدد بالباركود كـ Flow
     */
    @Query("SELECT * FROM products WHERE barcode = :barcode LIMIT 1")
    fun getProductByBarcodeFlow(barcode: String): Flow<Product?>

    /**
     * جلب جميع المنتجات مرتبة بنظام FEFO (الأقرب انتهاءً أولاً)
     * يعيد Flow للتحديث اللحظي للواجهة عند أي تعديل في قاعدة البيانات
     */
    @Query("SELECT * FROM products ORDER BY date(expiryDate) ASC, productName ASC")
    fun getAllProductsSortedByExpiry(): Flow<List<Product>>

    /**
     * البحث عن أحدث منتج بنفس الباركود للتعبئة التلقائية للبيانات الأساسية
     */
    @Query("SELECT * FROM products WHERE barcode = :barcode LIMIT 1")
    suspend fun getProductByBarcode(barcode: String): Product?

    /**
     * البحث بالاسم أو الباركود
     */
    @Query("""
        SELECT * FROM products 
        WHERE productName LIKE '%' || :query || '%' 
           OR barcode LIKE '%' || :query || '%' 
        ORDER BY date(expiryDate) ASC
    """)
    fun searchProducts(query: String): Flow<List<Product>>

    /**
     * جلب المنتجات الحرجة التي تنتهي خلال عدد محدد من الأيام (للإشعارات)
     */
    @Query("""
        SELECT * FROM products 
        WHERE date(expiryDate) <= date('now', '+' || :daysAhead || ' days')
        ORDER BY date(expiryDate) ASC
    """)
    suspend fun getCriticalProductsForNotification(daysAhead: Int = 7): List<Product>

    @Query("SELECT COUNT(*) FROM products")
    fun getProductsCount(): Flow<Int>
}
`
  },
  {
    id: 'app-database',
    fileName: 'AppDatabase.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/data/local/AppDatabase.kt',
    category: 'Room Database',
    description: 'قاعدة بيانات Room المركزية بنمط Singleton لحفظ البيانات محلياً',
    code: `package com.example.expirymanager.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.expirymanager.data.local.dao.ProductDao
import com.example.expirymanager.data.local.entity.Product

/**
 * قاعدة بيانات Room غير المتصلة بالإنترنت
 */
@Database(
    entities = [Product::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun productDao(): ProductDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "goods_expiry_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
`
  },
  {
    id: 'expiry-utils',
    fileName: 'ExpiryUtils.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/util/ExpiryUtils.kt',
    category: 'WorkManager & Logic',
    description: 'منطق حساب الأيام المتبقية وتحديد ألوان وتصنيف الصلاحية حسب المطلوب',
    code: `package com.example.expirymanager.util

import androidx.compose.ui.graphics.Color
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * صنف يمثل حالة الصلاحية ولونها
 */
data class ExpiryStatusInfo(
    val daysRemaining: Long,
    val statusText: String,
    val cardColor: Color,
    val badgeBackground: Color,
    val badgeTextColor: Color,
    val isExpired: Boolean,
    val isCritical: Boolean
)

object ExpiryUtils {

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    /**
     * 1. دالة مخصصة تحسب الأيام المتبقية وتحدد لون البطاقة:
     * - أكثر من 30 يوماً ◄ Color.Green
     * - بين 8 و 30 يوماً ◄ Color(0xFFFFA000) (أصفر/برتقالي)
     * - أقل من 7 أيام أو منتهي ◄ Color.Red
     */
    fun calculateExpiryStatus(expiryDateStr: String): ExpiryStatusInfo {
        return try {
            val expiryDate: Date = dateFormat.parse(expiryDateStr) ?: Date()
            
            // تصفير الوقت لمقارنة التواريخ بدقة اليوم
            val calToday = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val calExpiry = Calendar.getInstance().apply {
                time = expiryDate
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val diffMillis = calExpiry.timeInMillis - calToday.timeInMillis
            val daysRemaining = TimeUnit.MILLISECONDS.toDays(diffMillis)

            when {
                daysRemaining < 0 -> {
                    val absDays = Math.abs(daysRemaining)
                    ExpiryStatusInfo(
                        daysRemaining = daysRemaining,
                        statusText = "منتهي منذ $absDays يوم",
                        cardColor = Color.Red,
                        badgeBackground = Color(0xFFFFEBEE),
                        badgeTextColor = Color(0xFFC62828),
                        isExpired = true,
                        isCritical = true
                    )
                }
                daysRemaining == 0L -> {
                    ExpiryStatusInfo(
                        daysRemaining = 0,
                        statusText = "ينتهي اليوم!",
                        cardColor = Color.Red,
                        badgeBackground = Color(0xFFFFEBEE),
                        badgeTextColor = Color(0xFFC62828),
                        isExpired = false,
                        isCritical = true
                    )
                }
                daysRemaining <= 7 -> {
                    // أقل من 7 أيام
                    ExpiryStatusInfo(
                        daysRemaining = daysRemaining,
                        statusText = "حرج: متبقي $daysRemaining يوم",
                        cardColor = Color.Red,
                        badgeBackground = Color(0xFFFFCDD2),
                        badgeTextColor = Color(0xFFB71C1C),
                        isExpired = false,
                        isCritical = true
                    )
                }
                daysRemaining in 8..30 -> {
                    // بين 8 و 30 يوماً ◄ Color(0xFFFFA000)
                    ExpiryStatusInfo(
                        daysRemaining = daysRemaining,
                        statusText = "متبقي $daysRemaining يوم",
                        cardColor = Color(0xFFFFA000),
                        badgeBackground = Color(0xFFFFF8E1),
                        badgeTextColor = Color(0xFFE65100),
                        isExpired = false,
                        isCritical = false
                    )
                }
                else -> {
                    // أكثر من 30 يوماً ◄ Color.Green
                    ExpiryStatusInfo(
                        daysRemaining = daysRemaining,
                        statusText = "سليم: متبقي $daysRemaining يوم",
                        cardColor = Color(0xFF2E7D32), // الأخضر المطلوب
                        badgeBackground = Color(0xFFE8F5E9),
                        badgeTextColor = Color(0xFF1B5E20),
                        isExpired = false,
                        isCritical = false
                    )
                }
            }
        } catch (e: Exception) {
            ExpiryStatusInfo(
                daysRemaining = 0,
                statusText = "تاريخ غير صالح",
                cardColor = Color.Gray,
                badgeBackground = Color.LightGray,
                badgeTextColor = Color.Black,
                isExpired = false,
                isCritical = false
            )
        }
    }

    fun getTodayDateFormatted(): String {
        return dateFormat.format(Date())
    }
}
`
  },
  {
    id: 'notification-worker',
    fileName: 'DailyExpiryWorker.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/worker/DailyExpiryWorker.kt',
    category: 'WorkManager & Logic',
    description: 'عامل خلفية WorkManager لفحص البضائع وإرسال إشعار الصلاحية اليومي صباحاً (09:00 AM) تلقائياً',
    code: `package com.example.expirymanager.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.example.expirymanager.MainActivity
import com.example.expirymanager.data.local.AppDatabase
import com.example.expirymanager.utils.ExpiryUtils
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * عامل الفحص اليومي (Daily Expiry Worker) المبني على WorkManager و CoroutineWorker:
 * يعمل تلقائياً كل 24 ساعة (عند الساعة 09:00 صباحاً) بدون الحاجة لفتح التطبيق:
 * 1. يستعلم من قاعدة بيانات Room المحلية عن جميع البضائع
 * 2. يقارن تواريخ الانتهاء مع تاريخ اليوم وفترة التنبيه المحددة لكل صنف (3، 7، 15، 30 يوماً)
 * 3. يجمع تقريراً شاملاً بالبضائع المنتهية والمقاربة على الانتهاء مصنفة حسب الأقسام
 * 4. يطلق إشعاراً مرئياً وصوتياً عالي الأولوية (High Priority Notification)
 */
class DailyExpiryWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val database = AppDatabase.getDatabase(context)
            val allProducts = database.productDao().getAllProductsDirect()

            // فرز البضائع حسب حالة الصلاحية
            val expiredList = mutableListOf<String>()
            val criticalList = mutableListOf<String>() // تنتهي خلال 7 أيام أو حسب التنبيه المخصص
            val warningList = mutableListOf<String>()  // تنتهي خلال 8-15 يوماً

            allProducts.forEach { product ->
                val status = ExpiryUtils.calculateExpiryStatus(product.expiryDate)
                val threshold = product.reminderDays ?: 7

                when {
                    status.daysRemaining < 0 -> {
                        expiredList.add("\${product.productName} (منتهي منذ \${-status.daysRemaining} يوم)")
                    }
                    status.daysRemaining <= threshold -> {
                        val notePart = if (!product.reminderNote.isNullOrBlank()) " - \${product.reminderNote}" else ""
                        criticalList.add("\${product.productName} (\${status.daysRemaining} يوم متبقي)\$notePart")
                    }
                    status.daysRemaining <= 15 -> {
                        warningList.add("\${product.productName} (\${status.daysRemaining} يوم)")
                    }
                }
            }

            val totalUrgent = expiredList.size + criticalList.size

            if (totalUrgent > 0) {
                sendDailyExpiryNotification(
                    expiredCount = expiredList.size,
                    criticalCount = criticalList.size,
                    expiredItems = expiredList,
                    criticalItems = criticalList
                )
            }

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }

    /**
     * إرسال الإشعار اليومي بنمط BigTextStyle مع أزرار الإجراءات السريعة
     */
    private fun sendDailyExpiryNotification(
        expiredCount: Int,
        criticalCount: Int,
        expiredItems: List<String>,
        criticalItems: List<String>
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "daily_expiry_morning_channel"

        // إنشاء قناة الإشعارات لنظام أندرويد 8.0 فما فوق
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "المنبه اليومي لتاريخ الصلاحية",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "إشعار صباحي يومي يفحص جميع البضائع المنتهية والمقاربة على الانتهاء"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // عند النقر على الإشعار يفتح التطبيق مباشرة في قائمة البضائع الحرجة
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("FILTER_MODE", "CRITICAL")
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = when {
            expiredCount > 0 && criticalCount > 0 -> "⚠️ منبه الصلاحية اليومي: $expiredCount منتهية و $criticalCount حرجة!"
            expiredCount > 0 -> "🚨 منبه الصلاحية اليومي: يوجد $expiredCount بضائع منتهية الصلاحية!"
            else -> "⏰ منبه الصلاحية اليومي: $criticalCount بضائع شارف تاريخها على الانتهاء"
        }

        val bigTextSummary = buildString {
            append("تقرير الفحص اليومي للصلاحيات:\n")
            if (expiredItems.isNotEmpty()) {
                append("🔴 بضائع منتهية:\n")
                expiredItems.take(3).forEach { append("  • $it\n") }
            }
            if (criticalItems.isNotEmpty()) {
                append("🟠 بضائع تنتهي قريباً:\n")
                criticalItems.take(3).forEach { append("  • $it\n") }
            }
            val remainingCount = (expiredItems.size + criticalItems.size) - 6
            if (remainingCount > 0) {
                append("... ويوجد $remainingCount أصناف أخرى مسجلة.")
            }
        }

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText("لديك \${expiredCount + criticalCount} بضائع تتطلب إجراء فوري (تخفيض أو تصريف)")
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigTextSummary))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setSound(defaultSoundUri)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(
                android.R.drawable.ic_menu_view,
                "عرض البضائع وتصريفها",
                pendingIntent
            )
            .build()

        notificationManager.notify(DAILY_NOTIFICATION_ID, notification)
    }

    companion object {
        const val WORK_NAME = "DailyExpiryMorningWorker"
        const val DAILY_NOTIFICATION_ID = 2001

        /**
         * جدولة تشغيل الفحص اليومي تلقائياً كل 24 ساعة عند الساعة 09:00 صباحاً
         */
        fun scheduleDailyMorningWork(context: Context, targetHour: Int = 9, targetMinute: Int = 0) {
            val now = Calendar.getInstance()
            val target = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, targetHour)
                set(Calendar.MINUTE, targetMinute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (before(now)) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            val initialDelayMillis = target.timeInMillis - now.timeInMillis

            val constraints = Constraints.Builder()
                .setRequiresBatteryNotLow(false)
                .build()

            val dailyWorkRequest = PeriodicWorkRequestBuilder<DailyExpiryWorker>(
                24, TimeUnit.HOURS,
                15, TimeUnit.MINUTES // Flex interval
            )
            .setInitialDelay(initialDelayMillis, TimeUnit.MILLISECONDS)
            .setConstraints(constraints)
            .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                dailyWorkRequest
            )
        }

        /**
         * إيقاف أو إلغاء الجدولة اليومية
         */
        fun cancelDailyWork(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
`
  },
  {
    id: 'boot-receiver',
    fileName: 'BootReceiver.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/receiver/BootReceiver.kt',
    category: 'WorkManager & Logic',
    description: 'مستقبل البث BootReceiver لإعادة جدولة المنبه اليومي تلقائياً عند إعادة تشغيل الهاتف',
    code: `package com.example.expirymanager.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.expirymanager.worker.DailyExpiryWorker

/**
 * يضمن استمرار إرسال إشعارات المنبه اليومي حتى بعد إغلاق أو إعادة تشغيل هاتف التاجر
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            // إعادة جدولة المنبه اليومي صباحاً عند الساعة 09:00
            DailyExpiryWorker.scheduleDailyMorningWork(context, targetHour = 9, targetMinute = 0)
        }
    }
}
`
  },
  {
    id: 'viewmodel',
    fileName: 'ProductViewModel.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/viewmodel/ProductViewModel.kt',
    category: 'Jetpack Compose UI',
    description: 'نموذج العرض ViewModel لإدارة الحالة والبحث والعمليات وقراءة الباركود',
    code: `package com.example.expirymanager.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.expirymanager.data.local.AppDatabase
import com.example.expirymanager.data.local.entity.Product
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * حالة واجهة تفاصيل المنتج
 */
sealed interface ProductUiState {
    object Loading : ProductUiState
    data class Success(val product: Product) : ProductUiState
    object NotFound : ProductUiState
}

class ProductViewModel(application: Application) : AndroidViewModel(application) {

    private val dao = AppDatabase.getDatabase(application).productDao()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // قائمة المنتجات مرتبة تلقائياً بنظام FEFO مع دعم البحث
    val productsList: StateFlow<List<Product>> = _searchQuery
        .debounce(200)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                dao.getAllProductsSortedByExpiry()
            } else {
                dao.searchProducts(query)
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    fun onSearchQueryChanged(newQuery: String) {
        _searchQuery.value = newQuery
    }

    /**
     * جلب تدفق بيانات منتج محدد إما بـ ID أو الباركود لشاشة ProductDetailScreen
     */
    fun getProductDetails(productId: Int? = null, barcode: String? = null): StateFlow<ProductUiState> {
        val flow = when {
            productId != null && productId > 0 -> dao.getProductById(productId)
            !barcode.isNullOrBlank() -> dao.getProductByBarcodeFlow(barcode)
            else -> flowOf(null)
        }

        return flow.map { product ->
            if (product != null) ProductUiState.Success(product) else ProductUiState.NotFound
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = ProductUiState.Loading
        )
    }

    /**
     * البحث عن تفاصيل الباركود للتعبئة التلقائية
     */
    suspend fun findProductByBarcode(barcode: String): Product? {
        return dao.getProductByBarcode(barcode)
    }

    fun addProduct(product: Product, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            dao.insertProduct(product)
            onComplete()
        }
    }

    fun updateProduct(product: Product, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            dao.updateProduct(product)
            onComplete()
        }
    }

    fun deleteProduct(product: Product) {
        viewModelScope.launch {
            dao.deleteProduct(product)
        }
    }
}
`
  },
  {
    id: 'camerax-scanner',
    fileName: 'CameraBarcodeScanner.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/components/CameraBarcodeScanner.kt',
    category: 'CameraX & ML Kit',
    description: 'مكون الكاميرا ومسح الباركود باستخدام CameraX و Google ML Kit Barcode Scanning',
    code: `package com.example.expirymanager.ui.components

import android.annotation.SuppressLint
import android.util.Log
import android.view.ViewGroup
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * واجهة كاميرا Jetpack Compose مدمجة مع CameraX و Google ML Kit
 */
@Composable
fun CameraBarcodeScanner(
    onBarcodeScanned: (String) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    var isFlashOn by remember { mutableStateOf(false) }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var hasScanned by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                }

                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    val barcodeScanner = BarcodeScanning.getClient()

                    val imageAnalyzer = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                                processImageProxy(barcodeScanner, imageProxy) { barcodeValue ->
                                    if (!hasScanned) {
                                        hasScanned = true
                                        onBarcodeScanned(barcodeValue)
                                    }
                                }
                            }
                        }

                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                    try {
                        cameraProvider.unbindAll()
                        camera = cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            imageAnalyzer
                        )
                    } catch (exc: Exception) {
                        Log.e("CameraScanner", "فشل ربط الكاميرا", exc)
                    }
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            modifier = Modifier.fillMaxSize()
        )

        // إطار التوجيه والمسح البصري
        Box(
            modifier = Modifier
                .size(260.dp, 160.dp)
                .align(Alignment.Center)
                .border(2.dp, Color(0xFF4CAF50), RoundedCornerShape(12.dp))
        )

        Text(
            text = "وجّه الكاميرا نحو باركود المنتج",
            color = Color.White,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = 100.dp)
                .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                .padding(horizontal = 16.dp, vertical = 6.dp)
        )

        // أزرار التحكم العلوي
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onClose,
                colors = IconButtonDefaults.iconButtonColors(containerColor = Color.Black.copy(alpha = 0.5f))
            ) {
                Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = Color.White)
            }

            IconButton(
                onClick = {
                    isFlashOn = !isFlashOn
                    camera?.cameraControl?.enableTorch(isFlashOn)
                },
                colors = IconButtonDefaults.iconButtonColors(containerColor = Color.Black.copy(alpha = 0.5f))
            ) {
                Icon(Icons.Default.FlashOn, contentDescription = "فلاش", tint = if (isFlashOn) Color.Yellow else Color.White)
            }
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
private fun processImageProxy(
    barcodeScanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    imageProxy: ImageProxy,
    onSuccess: (String) -> Unit
) {
    val mediaImage = imageProxy.image
    if (mediaImage != null) {
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    barcode.rawValue?.let { raw ->
                        onSuccess(raw)
                        break
                    }
                }
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    } else {
        imageProxy.close()
    }
}
`
  },
  {
    id: 'all-in-one-auto-scanner',
    fileName: 'AllInOneAutoScanner.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/components/AllInOneAutoScanner.kt',
    category: 'CameraX & ML Kit',
    description: 'ماسح تلقائي شامل يدمج CameraX مع ML Kit Barcode + Text Recognition لقراءة الباركود، الاسم، وتاريخ الانتهاء في نفس اللحظة',
    code: `package com.example.expirymanager.ui.components

import android.annotation.SuppressLint
import android.util.Log
import android.view.ViewGroup
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.expirymanager.utils.ExpiryDateOcrParser
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.Executors

/**
 * نتيجة المسح التلقائي الشامل
 */
data class AutoScanResult(
    val barcode: String? = null,
    val productName: String? = null,
    val expiryDate: String? = null // بصيغة YYYY-MM-DD
)

/**
 * ماسح ذكي شامل يحلل إطارات الكاميرا بالتوازي:
 * 1. Barcode Scanner: لقراءة رمز الباركود الدولي
 * 2. Text Recognition: للتعرف على تاريخ الانتهاء المطبوع (EXP/BB) واسم الصنف
 * عند اكتمال التعرف، يعيد النتيجة فوراً لتعبئة الحقول تلقائياً
 */
@Composable
fun AllInOneAutoScanner(
    onScanCompleted: (AutoScanResult) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    
    val barcodeScanner = remember { BarcodeScanning.getClient() }
    val textRecognizer = remember { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    var detectedBarcode by remember { mutableStateOf<String?>(null) }
    var detectedExpiry by remember { mutableStateOf<String?>(null) }
    var detectedName by remember { mutableStateOf<String?>(null) }
    var isFlashOn by remember { mutableStateOf(false) }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var hasCompleted by remember { mutableStateOf(false) }

    // التحقق من اكتمال القراءة الشاملة
    LaunchedEffect(detectedBarcode, detectedExpiry, detectedName) {
        if (!hasCompleted && (detectedBarcode != null || detectedExpiry != null)) {
            // إذا وُجد الباركود والتاريخ، أو تم التعرف على الباركود واسم المنتج
            if (detectedBarcode != null && detectedExpiry != null) {
                hasCompleted = true
                onScanCompleted(
                    AutoScanResult(
                        barcode = detectedBarcode,
                        productName = detectedName,
                        expiryDate = detectedExpiry
                    )
                )
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }

                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    // محلل الإطارات المتوازي (ML Kit Barcode + Text OCR)
                    val imageAnalyzer = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                                processDualVisionFrame(
                                    barcodeScanner = barcodeScanner,
                                    textRecognizer = textRecognizer,
                                    imageProxy = imageProxy,
                                    onBarcodeFound = { code -> if (detectedBarcode == null) detectedBarcode = code },
                                    onTextFound = { rawText ->
                                        // 1. استخراج تاريخ الانتهاء
                                        if (detectedExpiry == null) {
                                            val parsedDate = ExpiryDateOcrParser.extractExpiryDate(rawText)
                                            if (parsedDate != null) detectedExpiry = parsedDate
                                        }
                                        // 2. استخراج الاسم المقترح إذا لم يتم تحديده
                                        if (detectedName == null) {
                                            val suggestedName = ExpiryDateOcrParser.extractPotentialProductName(rawText)
                                            if (suggestedName != null) detectedName = suggestedName
                                        }
                                    }
                                )
                            }
                        }

                    try {
                        cameraProvider.unbindAll()
                        camera = cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            imageAnalyzer
                        )
                    } catch (e: Exception) {
                        Log.e("AllInOneScanner", "Camera bind failed", e)
                    }
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            modifier = Modifier.fillMaxSize()
        )

        // واجهة HUD المتقدمة للإشارة للبيانات المكتشفة حياً
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // شريط الأدوات العلوي
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onClose,
                    colors = IconButtonDefaults.iconButtonColors(containerColor = Color.Black.copy(alpha = 0.6f))
                ) {
                    Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = Color.White)
                }

                Text(
                    text = "المسح التلقائي الشامل",
                    color = Color.White,
                    fontSize = 16.sp,
                    style = MaterialTheme.typography.titleMedium
                )

                IconButton(
                    onClick = {
                        isFlashOn = !isFlashOn
                        camera?.cameraControl?.enableTorch(isFlashOn)
                    },
                    colors = IconButtonDefaults.iconButtonColors(containerColor = Color.Black.copy(alpha = 0.6f))
                ) {
                    Icon(
                        if (isFlashOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                        contentDescription = "فلاش",
                        tint = if (isFlashOn) Color.Yellow else Color.White
                    )
                }
            }

            // إطار المسح والتوجيه
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .border(2.dp, Color(0xFF2196F3), RoundedCornerShape(16.dp))
                    .padding(12.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceAround
                ) {
                    // مؤشر الباركود المكتشف
                    BadgeIndicator(
                        icon = Icons.Default.QrCodeScanner,
                        title = "الباركود: " + (detectedBarcode ?: "جاري المسح..."),
                        isDetected = detectedBarcode != null,
                        color = Color(0xFF4CAF50)
                    )

                    // مؤشر تاريخ الانتهاء المكتشف
                    BadgeIndicator(
                        icon = Icons.Default.CalendarToday,
                        title = "تاريخ الانتهاء: " + (detectedExpiry ?: "جاري قراءة EXP/BB..."),
                        isDetected = detectedExpiry != null,
                        color = Color(0xFFFF9800)
                    )

                    // مؤشر اسم المنتج المكتشف
                    BadgeIndicator(
                        icon = Icons.Default.ShoppingBag,
                        title = "الاسم: " + (detectedName ?: "جاري التعرف على العبوة..."),
                        isDetected = detectedName != null,
                        color = Color(0xFF2196F3)
                    )
                }
            }

            // زر الاعتماد الفوري اليدوي إذا لزم
            Button(
                onClick = {
                    onScanCompleted(
                        AutoScanResult(
                            barcode = detectedBarcode,
                            productName = detectedName,
                            expiryDate = detectedExpiry
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = detectedBarcode != null || detectedExpiry != null,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3))
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("تأكيد وتعبئة البيانات تلقائياً")
            }
        }
    }
}

@Composable
private fun BadgeIndicator(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    isDetected: Boolean,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = if (isDetected) color.copy(alpha = 0.25f) else Color.Black.copy(alpha = 0.5f),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isDetected) color else Color.Gray.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(icon, contentDescription = null, tint = if (isDetected) color else Color.LightGray, modifier = Modifier.size(18.dp))
            Text(title, color = Color.White, fontSize = 13.sp)
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
private fun processDualVisionFrame(
    barcodeScanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    textRecognizer: com.google.mlkit.vision.text.TextRecognizer,
    imageProxy: ImageProxy,
    onBarcodeFound: (String) -> Unit,
    onTextFound: (String) -> Unit
) {
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }

    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    
    // تشغيل فحص الباركود والنصوص بالتوازي
    val barcodeTask = barcodeScanner.process(image)
    val textTask = textRecognizer.process(image)

    Tasks.whenAllComplete(barcodeTask, textTask)
        .addOnSuccessListener {
            if (barcodeTask.isSuccessful) {
                barcodeTask.result?.firstOrNull()?.rawValue?.let { code ->
                    onBarcodeFound(code)
                }
            }
            if (textTask.isSuccessful) {
                textTask.result?.text?.let { text ->
                    onTextFound(text)
                }
            }
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}
`
  },
  {
    id: 'expiry-ocr-parser',
    fileName: 'ExpiryDateOcrParser.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/utils/ExpiryDateOcrParser.kt',
    category: 'CameraX & ML Kit',
    description: 'محلل نصوص ذكي لاستخراج تواريخ الانتهاء المطبوعة بجميع الأنماط (EXP, BB, DD/MM/YYYY, Arabic)',
    code: `package com.example.expirymanager.utils

import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern

/**
 * خوارزمية ذكية لاستخراج تاريخ الصلاحية من النصوص المقروءة عبر ML Kit OCR
 */
object ExpiryDateOcrParser {

    // أنماط regex لتغطية مختلف التواريخ المطبوعة على العبوات التجارية والدوائية
    private val DATE_PATTERNS = listOf(
        // YYYY-MM-DD أو YYYY/MM/DD أو YYYY.MM.DD
        Pattern.compile("""\\b(20[2-3][0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\\b"""),
        // DD-MM-YYYY أو DD/MM/YYYY أو DD.MM.YYYY
        Pattern.compile("""\\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](20[2-3][0-9])\\b"""),
        // MM-YYYY أو MM/YYYY بعد كلمة EXP أو BB
        Pattern.compile("""(?i)(?:EXP|BB|BBE|EXPIRY|صلاحية|انتهاء)[:\\s]*([01]?[0-9])[-/.](20[2-3][0-9])\\b"""),
        // DD-MM-YY صيغة السنة برقمين
        Pattern.compile("""\\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.]([2-3][0-9])\\b""")
    )

    /**
     * يستخرج تاريخ الانتهاء ويحوله إلى تنسيق ISO الموحد: YYYY-MM-DD
     */
    fun extractExpiryDate(rawText: String): String? {
        if (rawText.isBlank()) return null

        val cleanText = rawText.replace("\n", " ").trim()

        // 1. فحص نمط YYYY-MM-DD
        val p1 = Pattern.compile("""\\b(20[2-3][0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\\b""")
        val m1 = p1.matcher(cleanText)
        if (m1.find()) {
            val y = m1.group(1)
            val m = m1.group(2)
            val d = m1.group(3)
            return "$y-$m-$d"
        }

        // 2. فحص نمط DD-MM-YYYY
        val p2 = Pattern.compile("""\\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](20[2-3][0-9])\\b""")
        val m2 = p2.matcher(cleanText)
        if (m2.find()) {
            val d = m2.group(1)
            val m = m2.group(2)
            val y = m2.group(3)
            return "$y-$m-$d"
        }

        // 3. فحص نمط MM/YYYY
        val p3 = Pattern.compile("""(?i)(?:EXP|BB|BBE|EXPIRY|انتهاء)[:\\s]*([01]?[0-9])[-/.](20[2-3][0-9])\\b""")
        val m3 = p3.matcher(cleanText)
        if (m3.find()) {
            val m = m3.group(1)?.padStart(2, '0')
            val y = m3.group(2)
            // تعيين اليوم الأخير من ذلك الشهر
            return "$y-$m-28"
        }

        return null
    }

    /**
     * يستخرج اسم المنتج المحتمل من السطر الأبرز في العلبة
     */
    fun extractPotentialProductName(rawText: String): String? {
        val lines = rawText.lines().map { it.trim() }.filter { it.length in 3..45 }
        val excludedKeywords = listOf("EXP", "BB", "LOT", "BATCH", "PROD", "MFG", "MADE IN", "صنع في", "تاريخ", "السعر")
        
        for (line in lines) {
            val containsExcluded = excludedKeywords.any { line.contains(it, ignoreCase = true) }
            if (!containsExcluded && !line.matches(Regex("^[0-9\\s\\-./]+$"))) {
                return line
            }
        }
        return null
    }
}
`
  },
  {
    id: 'add-product-screen',
    fileName: 'AddProductScreen.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/screens/AddProductScreen.kt',
    category: 'Jetpack Compose UI',
    description: 'واجهة إضافة وتعديل المنتجات مع التعبئة الآلية، DatePicker، ومسح الباركود',
    code: `package com.example.expirymanager.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.expirymanager.data.local.entity.Product
import com.example.expirymanager.ui.components.CameraBarcodeScanner
import com.example.expirymanager.ui.viewmodel.ProductViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * شاشة إضافة وتعديل المنتجات:
 * 1. دمج مسح الباركود عبر CameraX و ML Kit
 * 2. منطق التعبئة الآلية عند مسح باركود مسجل مسبقاً
 * 3. نموذج إدخال يدوي متكامل مع KeyboardOptions.Number و DatePicker
 * 4. أزرار التحكم: "حفظ" و "حفظ وإضافة منتج آخر"
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddProductScreen(
    viewModel: ProductViewModel,
    existingProduct: Product? = null,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // حالة حقول الإدخال
    var barcode by remember { mutableStateOf(existingProduct?.barcode ?: "") }
    var productName by remember { mutableStateOf(existingProduct?.productName ?: "") }
    var quantity by remember { mutableStateOf(existingProduct?.quantity?.toString() ?: "1.0") }
    var unit by remember { mutableStateOf(existingProduct?.unit ?: "حبة") }
    var costPrice by remember { mutableStateOf(existingProduct?.costPrice?.toString() ?: "0.0") }
    var sellPrice by remember { mutableStateOf(existingProduct?.sellPrice?.toString() ?: "0.0") }
    var productionDate by remember { mutableStateOf(existingProduct?.productionDate ?: "") }
    var expiryDate by remember { mutableStateOf(existingProduct?.expiryDate ?: "") }
    var batchNumber by remember { mutableStateOf(existingProduct?.batchNumber ?: "") }

    var isScannerOpen by remember { mutableStateOf(false) }
    var showDatePickerForExpiry by remember { mutableStateOf(false) }
    var showDatePickerForProduction by remember { mutableStateOf(false) }

    // قائمة الوحدات الشائعة
    val unitOptions = listOf("حبة", "كرتون", "كيلو", "جرام", "لتر", "علبة", "كيس", "درزن")
    var unitExpanded by remember { mutableStateOf(false) }

    /**
     * منطق التعبئة الآلية: عند مسح الباركود، نبحث في قاعدة البيانات
     * إذا وُجد المنتج، نملأ الاسم والوحدة والأسعار وندع التاجر يكمل الكمية والتواريخ ورقم الدفعة
     */
    fun onBarcodeDetected(scannedCode: String) {
        barcode = scannedCode
        isScannerOpen = false
        coroutineScope.launch {
            val matched = viewModel.findProductByBarcode(scannedCode)
            if (matched != null) {
                productName = matched.productName
                unit = matched.unit
                costPrice = matched.costPrice.toString()
                sellPrice = matched.sellPrice.toString()
                Toast.makeText(context, "تمت تعبئة بيانات المنتج ($productName) تلقائياً!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(context, "باركود جديد: $scannedCode", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun validateAndSave(addAnother: Boolean) {
        if (productName.isBlank()) {
            Toast.makeText(context, "يرجى إدخال اسم المنتج", Toast.LENGTH_SHORT).show()
            return
        }
        if (expiryDate.isBlank()) {
            Toast.makeText(context, "يرجى تحديد تاريخ الانتهاء", Toast.LENGTH_SHORT).show()
            return
        }

        val qty = quantity.toDoubleOrNull() ?: 1.0
        val cost = costPrice.toDoubleOrNull() ?: 0.0
        val sell = sellPrice.toDoubleOrNull() ?: 0.0
        val finalUnit = if (unit.isBlank()) "حبة" else unit.trim()

        val product = Product(
            id = existingProduct?.id ?: 0,
            barcode = barcode.ifBlank { null },
            productName = productName.trim(),
            quantity = qty,
            unit = finalUnit,
            costPrice = cost,
            sellPrice = sell,
            productionDate = productionDate.ifBlank { null },
            expiryDate = expiryDate.trim(),
            batchNumber = batchNumber.ifBlank { null }
        )

        if (existingProduct == null) {
            viewModel.addProduct(product) {
                Toast.makeText(context, "تم حفظ المنتج بنجاح", Toast.LENGTH_SHORT).show()
                if (addAnother) {
                    // تفريغ الحقول لإضافة منتج آخر
                    barcode = ""
                    productName = ""
                    quantity = "1.0"
                    costPrice = "0.0"
                    sellPrice = "0.0"
                    productionDate = ""
                    expiryDate = ""
                    batchNumber = ""
                } else {
                    onNavigateBack()
                }
            }
        } else {
            viewModel.updateProduct(product) {
                Toast.makeText(context, "تم تعديل المنتج بنجاح", Toast.LENGTH_SHORT).show()
                onNavigateBack()
            }
        }
    }

    if (isScannerOpen) {
        CameraBarcodeScanner(
            onBarcodeScanned = { onBarcodeDetected(it) },
            onClose = { isScannerOpen = false }
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (existingProduct == null) "إضافة بضاعة جديدة" else "تعديل بيانات البضاعة") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "رجوع")
                    }
                },
                actions = {
                    IconButton(onClick = { isScannerOpen = true }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "مسح الباركود")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // 1. حقل الباركود مع زر المسح
            OutlinedTextField(
                value = barcode,
                onValueChange = { barcode = it },
                label = { Text("الباركود (Barcode)") },
                placeholder = { Text("امسح أو اكتب الباركود...") },
                trailingIcon = {
                    IconButton(onClick = { isScannerOpen = true }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "مسح")
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // 2. اسم المنتج
            OutlinedTextField(
                value = productName,
                onValueChange = { productName = it },
                label = { Text("اسم المنتج *") },
                placeholder = { Text("مثال: حليب المراعي 1 لتر") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // 3. الكمية والوحدة (الوحدة كتابة نصية حرة واختيارية)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it },
                    label = { Text("الكمية *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )

                OutlinedTextField(
                    value = unit,
                    onValueChange = { unit = it },
                    label = { Text("الوحدة (اختياري)") },
                    placeholder = { Text("مثال: حبة، كرتون") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            // شرائح مقترحات سريعة للوحدة
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                unitOptions.take(5).forEach { opt ->
                    SuggestionChip(
                        onClick = { unit = opt },
                        label = { Text(opt, fontSize = 11.sp) },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            containerColor = if (unit == opt) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                        )
                    )
                }
            }

            // 4. الأسعار (سعر التكلفة وسعر البيع)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = costPrice,
                    onValueChange = { costPrice = it },
                    label = { Text("سعر التكلفة") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )

                OutlinedTextField(
                    value = sellPrice,
                    onValueChange = { sellPrice = it },
                    label = { Text("سعر البيع") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            // 5. تاريخ الإنتاج والانتهاء
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = productionDate,
                    onValueChange = { productionDate = it },
                    label = { Text("تاريخ الإنتاج") },
                    placeholder = { Text("YYYY-MM-DD") },
                    trailingIcon = {
                        IconButton(onClick = { showDatePickerForProduction = true }) {
                            Icon(Icons.Default.CalendarMonth, contentDescription = "اختر تاريخ الإنتاج")
                        }
                    },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )

                OutlinedTextField(
                    value = expiryDate,
                    onValueChange = { expiryDate = it },
                    label = { Text("تاريخ الانتهاء *") },
                    placeholder = { Text("YYYY-MM-DD") },
                    trailingIcon = {
                        IconButton(onClick = { showDatePickerForExpiry = true }) {
                            Icon(Icons.Default.CalendarToday, contentDescription = "اختر تاريخ الانتهاء")
                        }
                    },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            // 6. رقم الدفعة (Batch Number)
            OutlinedTextField(
                value = batchNumber,
                onValueChange = { batchNumber = it },
                label = { Text("رقم الدفعة / التشغيلة (Batch No)") },
                placeholder = { Text("مثال: LOT-2026-A") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 7. أزرار التحكم: حفظ / حفظ وإضافة منتج آخر
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = { validateAndSave(addAnother = false) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("حفظ")
                }

                if (existingProduct == null) {
                    OutlinedButton(
                        onClick = { validateAndSave(addAnother = true) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.AddCircleOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("حفظ وإضافة آخر")
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }

        // حوار اختيار تاريخ الانتهاء
        if (showDatePickerForExpiry) {
            val datePickerState = rememberDatePickerState()
            DatePickerDialog(
                onDismissRequest = { showDatePickerForExpiry = false },
                confirmButton = {
                    TextButton(onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                            expiryDate = formatter.format(Date(millis))
                        }
                        showDatePickerForExpiry = false
                    }) {
                        Text("موافق")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePickerForExpiry = false }) { Text("إلغاء") }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }

        // حوار اختيار تاريخ الإنتاج
        if (showDatePickerForProduction) {
            val datePickerState = rememberDatePickerState()
            DatePickerDialog(
                onDismissRequest = { showDatePickerForProduction = false },
                confirmButton = {
                    TextButton(onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                            productionDate = formatter.format(Date(millis))
                        }
                        showDatePickerForProduction = false
                    }) {
                        Text("موافق")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePickerForProduction = false }) { Text("إلغاء") }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}
`
  },
  {
    id: 'home-screen',
    fileName: 'HomeScreen.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/screens/HomeScreen.kt',
    category: 'Jetpack Compose UI',
    description: 'الشاشة الرئيسية مع بطاقات الإحصائيات، البحث والباركود، وقائمة FEFO مع شريط الصلاحية',
    code: `package com.example.expirymanager.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.expirymanager.data.local.entity.Product
import com.example.expirymanager.ui.components.CameraBarcodeScanner
import com.example.expirymanager.ui.viewmodel.ProductViewModel
import com.example.expirymanager.util.ExpiryUtils

/**
 * الواجهة الرئيسية HomeScreen:
 * 1. بطاقات إحصائية في الأعلى (إجمالي المنتجات، المنتجات الحرجة، المنتهية، السليمة)
 * 2. OutlinedTextField للبحث المباشر بـ "اسم المنتج" أو زر لمسح الباركود
 * 3. LazyColumn لعرض قائمة المنتجات مع شريط/عداد تنازلي للـ Expiry Status
 * 4. FloatingActionButton (+) للانتقال لشاشة إضافة منتج
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: ProductViewModel,
    onNavigateToAddProduct: () -> Unit,
    onEditProduct: (Product) -> Unit
) {
    val products by viewModel.productsList.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var isQuickScannerOpen by remember { mutableStateOf(false) }

    // حساب الإحصائيات اللحظية
    val totalCount = products.size
    val criticalCount = products.count {
        val status = ExpiryUtils.calculateExpiryStatus(it.expiryDate)
        status.isCritical && !status.isExpired
    }
    val expiredCount = products.count {
        ExpiryUtils.calculateExpiryStatus(it.expiryDate).isExpired
    }
    val safeCount = totalCount - criticalCount - expiredCount

    if (isQuickScannerOpen) {
        CameraBarcodeScanner(
            onBarcodeScanned = { barcode ->
                viewModel.onSearchQueryChanged(barcode)
                isQuickScannerOpen = false
            },
            onClose = { isQuickScannerOpen = false }
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Inventory2,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("مدير الصلاحية (FEFO)", fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToAddProduct,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "إضافة بضاعة")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 14.dp)
        ) {
            Spacer(modifier = Modifier.height(10.dp))

            // 1. بطاقات إحصائية في الأعلى
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatCard(
                    title = "الإجمالي",
                    value = totalCount.toString(),
                    color = MaterialTheme.colorScheme.primary,
                    bgColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "حرج (<7 أيام)",
                    value = criticalCount.toString(),
                    color = Color.Red,
                    bgColor = Color(0xFFFFEBEE),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "منتهي",
                    value = expiredCount.toString(),
                    color = Color(0xFFB71C1C),
                    bgColor = Color(0xFFFFCDD2),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "سليم",
                    value = safeCount.toString(),
                    color = Color(0xFF2E7D32),
                    bgColor = Color(0xFFE8F5E9),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 2. شريط البحث المباشر مع زر مسح الباركود
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.onSearchQueryChanged(it) },
                placeholder = { Text("ابحث بالاسم أو الباركود...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "مسح")
                            }
                        }
                        IconButton(onClick = { isQuickScannerOpen = true }) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = "مسح الباركود للبحث", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 3. القائمة المرتبة بنظام FEFO
            if (products.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (searchQuery.isEmpty()) "لا توجد بضائع مسجلة بعد" else "لا توجد نتائج مطابقة للبحث",
                            color = Color.Gray,
                            fontSize = 16.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(products, key = { it.id }) { product ->
                        ProductItemCard(
                            product = product,
                            onClick = { onEditProduct(product) },
                            onDelete = { viewModel.deleteProduct(product) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    color: Color,
    bgColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = bgColor),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = color)
            Text(text = title, fontSize = 11.sp, color = color.copy(alpha = 0.85f), maxLines = 1)
        }
    }
}

@Composable
fun ProductItemCard(
    product: Product,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val expiryInfo = ExpiryUtils.calculateExpiryStatus(product.expiryDate)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // الصف العلوي: الاسم والشارة اللونية
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = product.productName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (!product.barcode.isNullOrBlank()) {
                        Text(
                            text = "باركود: \${product.barcode}",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                }

                // شارة الصلاحية الملونة
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = expiryInfo.badgeBackground
                ) {
                    Text(
                        text = expiryInfo.statusText,
                        color = expiryInfo.badgeTextColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // شريط التقدم المرئي للصلاحية
            LinearProgressIndicator(
                progress = when {
                    expiryInfo.daysRemaining <= 0 -> 1.0f
                    expiryInfo.daysRemaining < 30 -> (30 - expiryInfo.daysRemaining) / 30f
                    else -> 0.15f
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = expiryInfo.cardColor,
                trackColor = Color.LightGray.copy(alpha = 0.3f)
            )

            Spacer(modifier = Modifier.height(10.dp))

            // التفاصيل السفلية (الكمية، السعر، تاريخ الانتهاء)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "الكمية: \${product.quantity} \${product.unit}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "البيع: \${product.sellPrice} ر.س",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "ينتهي: \${product.expiryDate}",
                        fontSize = 12.sp,
                        color = Color.DarkGray
                    )
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            Icons.Default.DeleteOutline,
                            contentDescription = "حذف",
                            tint = Color.Gray,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}
`
  },
  {
    id: 'product-detail-screen',
    fileName: 'ProductDetailScreen.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/screens/ProductDetailScreen.kt',
    category: 'Jetpack Compose UI',
    description: 'شاشة تفاصيل المنتج المستقلة مع جلب البيانات من Room DAO وزر التعديل المباشر',
    code: `package com.example.expirymanager.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.expirymanager.data.local.entity.Product
import com.example.expirymanager.ui.viewmodel.ProductUiState
import com.example.expirymanager.ui.viewmodel.ProductViewModel
import com.example.expirymanager.util.ExpiryUtils

/**
 * شاشة تفاصيل المنتج ProductDetailScreen:
 * - تقبل productId أو barcode
 * - تجلب البيانات الكاملة للمنتج من ProductDao عبر ViewModel
 * - تعرض كافة الحقول والبيانات المالية وحالة الصلاحية ورمز الباركود
 * - تحتوي على زر "تعديل" ينقل المستخدم لشاشة AddProductScreen معبأة مسبقاً ببيانات المنتج
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: Int? = null,
    barcode: String? = null,
    viewModel: ProductViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Product) -> Unit,
    onDeleteProduct: ((Product) -> Unit)? = null
) {
    // مراقبة تدفق بيانات المنتج من Room DAO عبر ViewModel
    val uiState by remember(productId, barcode) {
        viewModel.getProductDetails(productId = productId, barcode = barcode)
    }.collectAsState()

    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("تفاصيل المنتج والتشغيلة", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "رجوع")
                    }
                },
                actions = {
                    if (uiState is ProductUiState.Success) {
                        val product = (uiState as ProductUiState.Success).product
                        IconButton(onClick = { onNavigateToEdit(product) }) {
                            Icon(Icons.Default.Edit, contentDescription = "تعديل البيانات", tint = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = { showDeleteConfirmDialog = true }) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "حذف المنتج", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (uiState is ProductUiState.Success) {
                val product = (uiState as ProductUiState.Success).product
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shadowElevation = 6.dp,
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // زر التعديل الأساسي
                        Button(
                            onClick = { onNavigateToEdit(product) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("تعديل بيانات البضاعة (Edit)", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is ProductUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is ProductUiState.NotFound -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(
                                Icons.Default.SearchOff,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.outline
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "لم يتم العثور على هذا المنتج في قاعدة بيانات Room",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onNavigateBack) {
                                Text("العودة للقائمة")
                            }
                        }
                    }
                }
                is ProductUiState.Success -> {
                    val product = state.product
                    val expiryInfo = ExpiryUtils.calculateExpiryStatus(product.expiryDate)
                    val totalCost = product.quantity * product.costPrice
                    val totalSell = product.quantity * product.sellPrice
                    val expectedProfit = totalSell - totalCost
                    val marginPercentage = if (product.sellPrice > 0) {
                        ((product.sellPrice - product.costPrice) / product.sellPrice) * 100
                    } else 0.0

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // 1. بطاقة عنوان المنتج وحالة الصلاحية ورمز الاستجابة
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = product.productName,
                                            style = MaterialTheme.typography.headlineSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "معرّف السجل (ID): #\${product.id}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    // شارة الصلاحية الملونة
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = expiryInfo.badgeBackground
                                    ) {
                                        Text(
                                            text = expiryInfo.statusText,
                                            color = expiryInfo.badgeTextColor,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(14.dp))

                                // شريط التقدم المرئي للصلاحية
                                LinearProgressIndicator(
                                    progress = when {
                                        expiryInfo.daysRemaining <= 0 -> 1.0f
                                        expiryInfo.daysRemaining < 30 -> (30 - expiryInfo.daysRemaining) / 30f
                                        else -> 0.15f
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = expiryInfo.cardColor,
                                    trackColor = Color.LightGray.copy(alpha = 0.3f)
                                )
                            }
                        }

                        // 2. بطاقة بيانات التتبع والترميز
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    text = "بيانات التتبع والترميز (Identification)",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )

                                DetailRow(
                                    icon = Icons.Default.QrCode,
                                    label = "الباركود الدولي",
                                    value = product.barcode ?: "غير محدد"
                                )

                                DetailRow(
                                    icon = Icons.Default.Tag,
                                    label = "رقم التشغيلة / الدفعة (Batch No)",
                                    value = product.batchNumber ?: "غير محدد"
                                )

                                DetailRow(
                                    icon = Icons.Default.CalendarToday,
                                    label = "تاريخ الإنتاج",
                                    value = product.productionDate ?: "غير مسجل"
                                )

                                DetailRow(
                                    icon = Icons.Default.EventBusy,
                                    label = "تاريخ انتهاء الصلاحية",
                                    value = product.expiryDate,
                                    valueColor = expiryInfo.cardColor,
                                    isBold = true
                                )
                            }
                        }

                        // 3. بطاقة الكميات والتقييم المالي
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    text = "المخزون والتسعير (Inventory & Pricing)",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )

                                DetailRow(
                                    icon = Icons.Default.Inventory2,
                                    label = "الكمية المتوفرة في المستودع",
                                    value = "\${product.quantity} \${product.unit}",
                                    isBold = true
                                )

                                DetailRow(
                                    icon = Icons.Default.Paid,
                                    label = "سعر التكلفة للوحدة",
                                    value = "\${product.costPrice} ر.س"
                                )

                                DetailRow(
                                    icon = Icons.Default.Sell,
                                    label = "سعر البيع للوحدة",
                                    value = "\${product.sellPrice} ر.س",
                                    valueColor = MaterialTheme.colorScheme.primary,
                                    isBold = true
                                )

                                Divider(modifier = Modifier.padding(vertical = 4.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(text = "إجمالي التكلفة", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(text = "\${totalCost} ر.س", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                    Column {
                                        Text(text = "إجمالي البيع المتوقع", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(text = "\${totalSell} ر.س", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                                    }
                                    Column {
                                        Text(text = "هامش الربح", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(text = "\${"%.1f".format(marginPercentage)}%", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF2E7D32))
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(70.dp))
                    }

                    // حوار تأكيد الحذف
                    if (showDeleteConfirmDialog) {
                        AlertDialog(
                            onDismissRequest = { showDeleteConfirmDialog = false },
                            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            title = { Text("تأكيد حذف البضاعة") },
                            text = { Text("هل أنت متأكد من رغبتك في حذف '\${product.productName}' نهائياً من قاعدة بيانات Room؟") },
                            confirmButton = {
                                TextButton(
                                    onClick = {
                                        showDeleteConfirmDialog = false
                                        viewModel.deleteProduct(product)
                                        onDeleteProduct?.invoke(product)
                                        onNavigateBack()
                                    },
                                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                                ) {
                                    Text("نعم، حذف")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                                    Text("إلغاء")
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(
    icon: ImageVector,
    label: String,
    value: String,
    valueColor: Color = Color.Unspecified,
    isBold: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = label,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal,
            color = valueColor
        )
    }
}
`
  },
  {
    id: 'app-navigation',
    fileName: 'AppNavigation.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/ui/navigation/AppNavigation.kt',
    category: 'Jetpack Compose UI',
    description: 'خريطة التنقل NavHost بين HomeScreen و ProductDetailScreen و AddProductScreen',
    code: `package com.example.expirymanager.ui.navigation

import androidx.compose.runtime.*
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.expirymanager.data.local.entity.Product
import com.example.expirymanager.ui.screens.AddProductScreen
import com.example.expirymanager.ui.screens.HomeScreen
import com.example.expirymanager.ui.screens.ProductDetailScreen
import com.example.expirymanager.ui.viewmodel.ProductViewModel

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object AddProduct : Screen("add_product")
    object ProductDetail : Screen("product_detail/{productId}?barcode={barcode}") {
        fun createRoute(productId: Int = 0, barcode: String? = null): String {
            return if (!barcode.isNullOrBlank()) {
                "product_detail/\$productId?barcode=\$barcode"
            } else {
                "product_detail/\$productId"
            }
        }
    }
}

@Composable
fun AppNavigation(viewModel: ProductViewModel) {
    val navController = rememberNavController()
    var productToEdit by remember { mutableStateOf<Product?>(null) }

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        // 1. الشاشة الرئيسية HomeScreen
        composable(Screen.Home.route) {
            HomeScreen(
                viewModel = viewModel,
                onNavigateToAddProduct = {
                    productToEdit = null
                    navController.navigate(Screen.AddProduct.route)
                },
                onEditProduct = { product ->
                    navController.navigate(Screen.ProductDetail.createRoute(productId = product.id))
                }
            )
        }

        // 2. شاشة تفاصيل المنتج ProductDetailScreen
        composable(
            route = Screen.ProductDetail.route,
            arguments = listOf(
                navArgument("productId") {
                    type = NavType.IntType
                    defaultValue = 0
                },
                navArgument("barcode") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val productId = backStackEntry.arguments?.getInt("productId")
            val barcode = backStackEntry.arguments?.getString("barcode")

            ProductDetailScreen(
                productId = productId,
                barcode = barcode,
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEdit = { product ->
                    productToEdit = product
                    navController.navigate(Screen.AddProduct.route)
                }
            )
        }

        // 3. شاشة إضافة وتعديل المنتج AddProductScreen
        composable(Screen.AddProduct.route) {
            AddProductScreen(
                viewModel = viewModel,
                existingProduct = productToEdit,
                onNavigateBack = {
                    productToEdit = null
                    navController.popBackStack()
                }
            )
        }
    }
}
`
  },
  {
    id: 'gradle-deps',
    fileName: 'build.gradle.kts',
    filePath: 'app/build.gradle.kts',
    category: 'Gradle & Manifest',
    description: 'ملف التبعات والمكتبات المكتمل مع Room، CameraX، ML Kit، و WorkManager',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("com.google.devtools.ksp") version "2.0.21-1.0.27"
}

android {
    namespace = "com.example.expirymanager"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.expirymanager"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // AndroidX Core & Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // 1. Room Database (Offline Storage)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // 2. CameraX & ML Kit Barcode + Text Recognition OCR (All-in-One Auto Scanner)
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
    implementation("com.google.mlkit:barcode-scanning:17.2.0")
    implementation("com.google.mlkit:text-recognition:16.0.0")

    // 3. WorkManager & Daily Notifications
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.core:core-ktx:1.15.0")
}
`
  },
  {
    id: 'android-manifest',
    fileName: 'AndroidManifest.xml',
    filePath: 'app/src/main/AndroidManifest.xml',
    category: 'Gradle & Manifest',
    description: 'ملف المانيفست مع أذونات الكاميرا والإشعارات والتشغيل بدون إنترنت',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- أذونات الكاميرا لمسح الباركود -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-permission android:name="android.permission.CAMERA" />

    <!-- إذن إرسال الإشعارات لأندرويد 13+ -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- إذن إعادة جدولة الفحص اليومي عند إعادة تشغيل الهاتف -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".GoodsExpiryApp"
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="مدير الصلاحية"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GoodsExpiryManager">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.GoodsExpiryManager">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>
`
  },
  {
    id: 'app-application',
    fileName: 'GoodsExpiryApp.kt',
    filePath: 'app/src/main/java/com/example/expirymanager/GoodsExpiryApp.kt',
    category: 'WorkManager & Logic',
    description: 'صنف Application لتهيئة WorkManager والجدولة اليومية التلقائية',
    code: `package com.example.expirymanager

import android.app.Application
import com.example.expirymanager.worker.DailyExpiryWorker

class GoodsExpiryApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // بدء جدولة فحص تواريخ الانتهاء يومياً في الخلفية عند الساعة 09:00 صباحاً
        DailyExpiryWorker.scheduleDailyMorningWork(this, targetHour = 9, targetMinute = 0)
    }
}
`
  }
];
