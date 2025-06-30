package com.cxone.voice

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.*

@CapacitorPlugin(
    name = "CXONEVoice",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        ),
        Permission(
            alias = "phone",
            strings = [
                Manifest.permission.MANAGE_OWN_CALLS,
                Manifest.permission.READ_PHONE_STATE
            ]
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class CXONEVoicePlugin : Plugin() {
    private lateinit var telecomManager: TelecomManager
    private lateinit var audioManager: AudioManager
    private lateinit var webRTCManager: WebRTCManager
    private lateinit var callManager: CallManager
    private val activeCalls = mutableMapOf<String, CallInfo>()
    private var phoneAccountHandle: PhoneAccountHandle? = null
    private var cxoneSDK: CXONEVoiceSDK? = null
    
    override fun load() {
        super.load()
        
        telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        webRTCManager = WebRTCManager(context)
        callManager = CallManager(context) { event ->
            notifyListeners("callStateChanged", event)
        }
        
        registerPhoneAccount()
    }
    
    @PluginMethod
    fun initialize(call: PluginCall) {
        val agentId = call.getString("agentId")
        val apiKey = call.getString("apiKey")
        val environment = call.getString("environment")
        
        if (agentId == null || apiKey == null || environment == null) {
            call.reject("Missing required parameters")
            return
        }
        
        val enableConnectionService = call.getBoolean("enableConnectionService", true) ?: true
        val enablePushNotifications = call.getBoolean("enablePushNotifications", true) ?: true
        
        // Initialize CXONE SDK
        cxoneSDK = CXONEVoiceSDK(
            context,
            agentId,
            apiKey,
            environment
        )
        
        // Setup ConnectionService if enabled
        if (enableConnectionService) {
            setupConnectionService()
        }
        
        // Setup FCM for push notifications if enabled
        if (enablePushNotifications) {
            setupPushNotifications()
        }
        
        call.resolve()
    }
    
    @PluginMethod
    fun makeCall(call: PluginCall) {
        val phoneNumber = call.getString("phoneNumber")
        if (phoneNumber == null) {
            call.reject("Phone number is required")
            return
        }
        
        val callerId = call.getString("callerId")
        val displayName = call.getString("displayName")
        val metadata = call.getObject("metadata")
        
        // Check permissions
        if (!hasRequiredPermissions()) {
            call.reject("Missing required permissions")
            return
        }
        
        // Generate call ID
        val callId = UUID.randomUUID().toString()
        
        // Create call info
        val callInfo = CallInfo(
            callId = callId,
            phoneNumber = phoneNumber,
            displayName = displayName,
            direction = CallDirection.OUTBOUND,
            state = CallState.DIALING
        )
        
        activeCalls[callId] = callInfo
        
        // Start outgoing call
        if (phoneAccountHandle != null) {
            val uri = Uri.fromParts("tel", phoneNumber, null)
            val extras = android.os.Bundle().apply {
                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, phoneAccountHandle)
                putString("callId", callId)
                displayName?.let { putString("displayName", it) }
            }
            
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    telecomManager.placeCall(uri, extras)
                }
                
                // Setup WebRTC
                webRTCManager.makeCall(phoneNumber) { success ->
                    if (success) {
                        val result = JSObject()
                        result.put("callId", callId)
                        result.put("state", "dialing")
                        call.resolve(result)
                    } else {
                        call.reject("Failed to establish WebRTC connection")
                    }
                }
            } catch (e: SecurityException) {
                call.reject("Permission denied to place call")
            }
        } else {
            call.reject("Phone account not registered")
        }
    }
    
    @PluginMethod
    fun answerCall(call: PluginCall) {
        val callId = call.getString("callId")
        if (callId == null) {
            call.reject("Call ID is required")
            return
        }
        
        val callInfo = activeCalls[callId]
        if (callInfo == null) {
            call.reject("Call not found")
            return
        }
        
        // Answer call via ConnectionService
        callManager.answerCall(callId)
        
        // Setup WebRTC
        webRTCManager.answerCall(callId) { success ->
            if (success) {
                updateCallState(callId, CallState.CONNECTED)
                call.resolve()
            } else {
                call.reject("Failed to establish WebRTC connection")
            }
        }
    }
    
    @PluginMethod
    fun endCall(call: PluginCall) {
        val callId = call.getString("callId")
        if (callId == null) {
            call.reject("Call ID is required")
            return
        }
        
        val callInfo = activeCalls[callId]
        if (callInfo == null) {
            call.reject("Call not found")
            return
        }
        
        // End call via ConnectionService
        callManager.endCall(callId)
        
        // Cleanup WebRTC
        webRTCManager.endCall(callId)
        
        // Remove from active calls
        activeCalls.remove(callId)
        
        call.resolve()
    }
    
    @PluginMethod
    fun muteCall(call: PluginCall) {
        val callId = call.getString("callId")
        val muted = call.getBoolean("muted")
        
        if (callId == null || muted == null) {
            call.reject("Missing required parameters")
            return
        }
        
        webRTCManager.setMute(callId, muted)
        
        activeCalls[callId]?.let {
            it.isMuted = muted
        }
        
        call.resolve()
    }
    
    @PluginMethod
    fun playRecording(call: PluginCall) {
        val callId = call.getString("callId")
        val recordingUrl = call.getString("recordingUrl")
        
        if (callId == null || recordingUrl == null) {
            call.reject("Missing required parameters")
            return
        }
        
        val volume = call.getFloat("volume", 0.5f) ?: 0.5f
        val loop = call.getBoolean("loop", false) ?: false
        
        callManager.playRecording(callId, recordingUrl, volume, loop) { success ->
            if (success) {
                val event = JSObject()
                event.put("callId", callId)
                event.put("state", "started")
                event.put("recordingUrl", recordingUrl)
                notifyListeners("recordingPlaybackStateChanged", event)
                call.resolve()
            } else {
                call.reject("Failed to play recording")
            }
        }
    }
    
    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val callId = call.getString("callId")
        if (callId == null) {
            call.reject("Call ID is required")
            return
        }
        
        callManager.stopRecording(callId)
        
        val event = JSObject()
        event.put("callId", callId)
        event.put("state", "stopped")
        notifyListeners("recordingPlaybackStateChanged", event)
        
        call.resolve()
    }
    
    @PluginMethod
    fun getActiveCall(call: PluginCall) {
        val activeCall = activeCalls.values.firstOrNull { it.state == CallState.CONNECTED }
        
        if (activeCall != null) {
            call.resolve(activeCall.toJSObject())
        } else {
            call.resolve(JSObject())
        }
    }
    
    @PluginMethod
    fun getActiveCalls(call: PluginCall) {
        val calls = JSONArray()
        activeCalls.values.forEach { callInfo ->
            calls.put(callInfo.toJSONObject())
        }
        
        val result = JSObject()
        result.put("calls", calls)
        call.resolve(result)
    }
    
    @PluginMethod
    fun holdCall(call: PluginCall) {
        val callId = call.getString("callId")
        if (callId == null) {
            call.reject("Call ID is required")
            return
        }
        
        val callInfo = activeCalls[callId]
        if (callInfo == null) {
            call.reject("Call not found")
            return
        }
        
        callManager.holdCall(callId)
        callInfo.isOnHold = true
        updateCallState(callId, CallState.HELD)
        
        call.resolve()
    }
    
    @PluginMethod
    fun resumeCall(call: PluginCall) {
        val callId = call.getString("callId")
        if (callId == null) {
            call.reject("Call ID is required")
            return
        }
        
        val callInfo = activeCalls[callId]
        if (callInfo == null) {
            call.reject("Call not found")
            return
        }
        
        callManager.resumeCall(callId)
        callInfo.isOnHold = false
        updateCallState(callId, CallState.CONNECTED)
        
        call.resolve()
    }
    
    @PluginMethod
    fun transferCall(call: PluginCall) {
        val callId = call.getString("callId")
        val targetNumber = call.getString("targetNumber")
        val transferType = call.getString("transferType")
        
        if (callId == null || targetNumber == null || transferType == null) {
            call.reject("Missing required parameters")
            return
        }
        
        // Transfer functionality would be implemented here
        call.reject("Call transfer not implemented")
    }
    
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val permissions = JSONObject()
        
        // Check microphone permission
        val microphonePermission = if (ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        ) "granted" else "prompt"
        permissions.put("microphone", microphonePermission)
        
        // Check phone permissions (Android only)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val phonePermission = if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.MANAGE_OWN_CALLS
                ) == PackageManager.PERMISSION_GRANTED
            ) "granted" else "prompt"
            permissions.put("phone", phonePermission)
        }
        
        // Check notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val notificationPermission = if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            ) "granted" else "prompt"
            permissions.put("notifications", notificationPermission)
        }
        
        call.resolve(JSObject.fromJSONObject(permissions))
    }
    
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val permissions = mutableListOf(
            Manifest.permission.RECORD_AUDIO
        )
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions.add(Manifest.permission.MANAGE_OWN_CALLS)
            permissions.add(Manifest.permission.READ_PHONE_STATE)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        
        ActivityCompat.requestPermissions(
            activity,
            permissions.toTypedArray(),
            PERMISSION_REQUEST_CODE
        )
        
        // The result will be handled in handleRequestPermissionsResult
        permissionCall = call
    }
    
    @PluginMethod
    fun registerForPushNotifications(call: PluginCall) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                cxoneSDK?.registerPushToken(token)
                
                val result = JSObject()
                result.put("pushToken", token)
                call.resolve(result)
            } else {
                call.reject("Failed to get push token")
            }
        }
    }
    
    // Private methods
    
    private fun registerPhoneAccount() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val componentName = ComponentName(context, CallConnectionService::class.java)
            phoneAccountHandle = PhoneAccountHandle(componentName, "CXONEVoice")
            
            val phoneAccount = PhoneAccount.builder(phoneAccountHandle, "CXONE Voice")
                .setCapabilities(
                    PhoneAccount.CAPABILITY_CALL_PROVIDER or
                    PhoneAccount.CAPABILITY_CONNECTION_MANAGER or
                    PhoneAccount.CAPABILITY_SELF_MANAGED
                )
                .build()
            
            try {
                telecomManager.registerPhoneAccount(phoneAccount)
            } catch (e: Exception) {
                // Handle registration failure
            }
        }
    }
    
    private fun setupConnectionService() {
        // ConnectionService setup is handled by the service itself
    }
    
    private fun setupPushNotifications() {
        // FCM setup
        FirebaseMessaging.getInstance().isAutoInitEnabled = true
    }
    
    private fun hasRequiredPermissions(): Boolean {
        val microphoneGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        
        val phoneGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.MANAGE_OWN_CALLS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        
        return microphoneGranted && phoneGranted
    }
    
    private fun updateCallState(callId: String, state: CallState) {
        activeCalls[callId]?.let { callInfo ->
            val previousState = callInfo.state
            callInfo.state = state
            
            val event = JSObject()
            event.put("callId", callId)
            event.put("previousState", previousState.value)
            event.put("currentState", state.value)
            
            notifyListeners("callStateChanged", event)
        }
    }
    
    fun handleIncomingCall(callData: Map<String, Any>) {
        val callId = callData["callId"] as? String ?: return
        val phoneNumber = callData["phoneNumber"] as? String ?: return
        val displayName = callData["displayName"] as? String
        
        val callInfo = CallInfo(
            callId = callId,
            phoneNumber = phoneNumber,
            displayName = displayName,
            direction = CallDirection.INBOUND,
            state = CallState.RINGING
        )
        
        activeCalls[callId] = callInfo
        
        val event = JSObject()
        event.put("callId", callId)
        event.put("phoneNumber", phoneNumber)
        event.put("displayName", displayName ?: "")
        event.put("hasVideo", false)
        
        notifyListeners("incomingCall", event)
    }
    
    companion object {
        private const val PERMISSION_REQUEST_CODE = 12345
        private var permissionCall: PluginCall? = null
    }
}

// Supporting classes

data class CallInfo(
    val callId: String,
    val phoneNumber: String,
    val displayName: String?,
    val direction: CallDirection,
    var state: CallState,
    var isMuted: Boolean = false,
    var isOnHold: Boolean = false,
    val startTime: Long = System.currentTimeMillis()
) {
    fun toJSObject(): JSObject {
        val obj = JSObject()
        obj.put("callId", callId)
        obj.put("phoneNumber", phoneNumber)
        obj.put("displayName", displayName ?: "")
        obj.put("direction", direction.value)
        obj.put("state", state.value)
        obj.put("isMuted", isMuted)
        obj.put("isOnHold", isOnHold)
        obj.put("startTime", startTime)
        obj.put("duration", (System.currentTimeMillis() - startTime) / 1000)
        return obj
    }
    
    fun toJSONObject(): JSONObject {
        val obj = JSONObject()
        obj.put("callId", callId)
        obj.put("phoneNumber", phoneNumber)
        obj.put("displayName", displayName ?: "")
        obj.put("direction", direction.value)
        obj.put("state", state.value)
        obj.put("isMuted", isMuted)
        obj.put("isOnHold", isOnHold)
        obj.put("startTime", startTime)
        obj.put("duration", (System.currentTimeMillis() - startTime) / 1000)
        return obj
    }
}

enum class CallDirection(val value: String) {
    INBOUND("inbound"),
    OUTBOUND("outbound")
}

enum class CallState(val value: String) {
    IDLE("idle"),
    DIALING("dialing"),
    RINGING("ringing"),
    CONNECTING("connecting"),
    CONNECTED("connected"),
    HOLDING("holding"),
    HELD("held"),
    RESUMING("resuming"),
    DISCONNECTING("disconnecting"),
    DISCONNECTED("disconnected"),
    FAILED("failed")
}