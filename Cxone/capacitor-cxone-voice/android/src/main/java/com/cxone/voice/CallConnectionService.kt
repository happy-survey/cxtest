package com.cxone.voice

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telecom.*
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.M)
class CallConnectionService : ConnectionService() {
    
    companion object {
        private val activeConnections = mutableMapOf<String, CallConnection>()
        
        fun getConnection(callId: String): CallConnection? {
            return activeConnections[callId]
        }
    }
    
    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val callId = request?.extras?.getString("callId") ?: generateCallId()
        val phoneNumber = request?.address?.schemeSpecificPart ?: ""
        val displayName = request?.extras?.getString("displayName")
        
        val connection = CallConnection(callId, phoneNumber, displayName)
        connection.setInitializing()
        
        // Configure connection
        connection.connectionProperties = Connection.PROPERTY_SELF_MANAGED
        connection.connectionCapabilities = Connection.CAPABILITY_SUPPORT_HOLD or
                Connection.CAPABILITY_MUTE or
                Connection.CAPABILITY_MANAGE_CONFERENCE
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
            connection.connectionCapabilities = connection.connectionCapabilities or
                    Connection.CAPABILITY_CAN_PULL_CALL
        }
        
        connection.setAudioModeIsVoip(true)
        connection.setAddress(request?.address, TelecomManager.PRESENTATION_ALLOWED)
        connection.setCallerDisplayName(displayName, TelecomManager.PRESENTATION_ALLOWED)
        
        activeConnections[callId] = connection
        
        // Notify the connection is dialing
        connection.setDialing()
        
        return connection
    }
    
    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val callId = request?.extras?.getString("callId") ?: generateCallId()
        val phoneNumber = request?.address?.schemeSpecificPart ?: ""
        val displayName = request?.extras?.getString("displayName")
        
        val connection = CallConnection(callId, phoneNumber, displayName)
        
        // Configure connection
        connection.connectionProperties = Connection.PROPERTY_SELF_MANAGED
        connection.connectionCapabilities = Connection.CAPABILITY_SUPPORT_HOLD or
                Connection.CAPABILITY_MUTE or
                Connection.CAPABILITY_MANAGE_CONFERENCE
        
        connection.setAudioModeIsVoip(true)
        connection.setAddress(request?.address, TelecomManager.PRESENTATION_ALLOWED)
        connection.setCallerDisplayName(displayName, TelecomManager.PRESENTATION_ALLOWED)
        connection.setRinging()
        
        activeConnections[callId] = connection
        
        return connection
    }
    
    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        super.onCreateIncomingConnectionFailed(connectionManagerPhoneAccount, request)
        // Handle failure
    }
    
    override fun onCreateOutgoingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        super.onCreateOutgoingConnectionFailed(connectionManagerPhoneAccount, request)
        // Handle failure
    }
    
    private fun generateCallId(): String {
        return "call-${System.currentTimeMillis()}-${(0..9999).random()}"
    }
    
    inner class CallConnection(
        private val callId: String,
        private val phoneNumber: String,
        private val displayName: String?
    ) : Connection() {
        
        private var audioPlayer: AudioPlayer? = null
        
        init {
            // Set audio route to earpiece by default
            setAudioRoute(CallAudioState.ROUTE_EARPIECE)
        }
        
        override fun onAnswer() {
            super.onAnswer()
            setActive()
            
            // Notify plugin that call was answered
            sendCallEvent("answered")
        }
        
        override fun onAnswer(videoState: Int) {
            super.onAnswer(videoState)
            setActive()
            
            // Notify plugin that call was answered
            sendCallEvent("answered")
        }
        
        override fun onReject() {
            super.onReject()
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
            
            // Notify plugin that call was rejected
            sendCallEvent("rejected")
        }
        
        override fun onDisconnect() {
            super.onDisconnect()
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
            
            // Stop any playing recordings
            audioPlayer?.stop()
            
            // Notify plugin that call was disconnected
            sendCallEvent("disconnected")
        }
        
        override fun onHold() {
            super.onHold()
            setOnHold()
            
            // Notify plugin that call was put on hold
            sendCallEvent("held")
        }
        
        override fun onUnhold() {
            super.onUnhold()
            setActive()
            
            // Notify plugin that call was resumed
            sendCallEvent("resumed")
        }
        
        override fun onPlayDtmfTone(c: Char) {
            super.onPlayDtmfTone(c)
            // Handle DTMF tone
        }
        
        override fun onStopDtmfTone() {
            super.onStopDtmfTone()
            // Stop DTMF tone
        }
        
        override fun onCallAudioStateChanged(state: CallAudioState?) {
            super.onCallAudioStateChanged(state)
            // Handle audio state changes
        }
        
        override fun onStateChanged(state: Int) {
            super.onStateChanged(state)
            
            val stateString = when (state) {
                STATE_NEW -> "new"
                STATE_RINGING -> "ringing"
                STATE_DIALING -> "dialing"
                STATE_ACTIVE -> "active"
                STATE_HOLDING -> "holding"
                STATE_DISCONNECTED -> "disconnected"
                else -> "unknown"
            }
            
            sendCallEvent("stateChanged", mapOf("state" to stateString))
        }
        
        fun playRecording(url: String, volume: Float, loop: Boolean, callback: (Boolean) -> Unit) {
            audioPlayer = AudioPlayer(applicationContext)
            audioPlayer?.play(url, volume, loop) { success ->
                callback(success)
            }
        }
        
        fun stopRecording() {
            audioPlayer?.stop()
        }
        
        private fun sendCallEvent(event: String, data: Map<String, Any> = emptyMap()) {
            val intent = Intent("com.cxone.voice.CALL_EVENT")
            intent.putExtra("callId", callId)
            intent.putExtra("event", event)
            data.forEach { (key, value) ->
                when (value) {
                    is String -> intent.putExtra(key, value)
                    is Boolean -> intent.putExtra(key, value)
                    is Int -> intent.putExtra(key, value)
                    is Float -> intent.putExtra(key, value)
                }
            }
            applicationContext.sendBroadcast(intent)
        }
        
        override fun onAbort() {
            super.onAbort()
            destroy()
        }
        
        override fun destroy() {
            super.destroy()
            activeConnections.remove(callId)
            audioPlayer?.release()
        }
    }
}