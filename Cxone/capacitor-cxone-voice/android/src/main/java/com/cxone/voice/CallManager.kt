package com.cxone.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import org.json.JSONObject

class CallManager(
    private val context: Context,
    private val eventCallback: (JSONObject) -> Unit
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioPlayers = mutableMapOf<String, AudioPlayer>()
    
    init {
        setupAudioFocus()
    }
    
    private fun setupAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(audioAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener { focusChange ->
                    handleAudioFocusChange(focusChange)
                }
                .build()
        }
    }
    
    fun answerCall(callId: String) {
        requestAudioFocus()
        
        // Configure audio for voice call
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = false
        
        // Get the connection and answer it
        CallConnectionService.getConnection(callId)?.onAnswer()
    }
    
    fun endCall(callId: String) {
        // Clean up audio
        audioPlayers[callId]?.release()
        audioPlayers.remove(callId)
        
        // Get the connection and disconnect it
        CallConnectionService.getConnection(callId)?.onDisconnect()
        
        // Release audio focus
        releaseAudioFocus()
        
        // Reset audio mode
        audioManager.mode = AudioManager.MODE_NORMAL
    }
    
    fun holdCall(callId: String) {
        CallConnectionService.getConnection(callId)?.onHold()
    }
    
    fun resumeCall(callId: String) {
        CallConnectionService.getConnection(callId)?.onUnhold()
    }
    
    fun playRecording(
        callId: String,
        recordingUrl: String,
        volume: Float,
        loop: Boolean,
        callback: (Boolean) -> Unit
    ) {
        // Stop any existing recording for this call
        audioPlayers[callId]?.release()
        
        // Create new audio player
        val audioPlayer = AudioPlayer(context)
        audioPlayers[callId] = audioPlayer
        
        // Use ConnectionService if available
        val connection = CallConnectionService.getConnection(callId)
        if (connection != null) {
            connection.playRecording(recordingUrl, volume, loop, callback)
        } else {
            // Fallback to direct playback
            audioPlayer.play(recordingUrl, volume, loop, callback)
        }
    }
    
    fun stopRecording(callId: String) {
        CallConnectionService.getConnection(callId)?.stopRecording()
        audioPlayers[callId]?.stop()
    }
    
    fun setMute(callId: String, muted: Boolean) {
        audioManager.isMicrophoneMute = muted
    }
    
    fun setSpeakerphone(enabled: Boolean) {
        audioManager.isSpeakerphoneOn = enabled
    }
    
    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let {
                audioManager.requestAudioFocus(it)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                { focusChange -> handleAudioFocusChange(focusChange) },
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
        }
    }
    
    private fun releaseAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let {
                audioManager.abandonAudioFocusRequest(it)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus { }
        }
    }
    
    private fun handleAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Resume playback or unmute
            }
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Stop playback
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Pause playback
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Lower volume
            }
        }
    }
    
    fun startAudioLevelMonitoring(callId: String) {
        // This would implement audio level monitoring
        // For now, we'll send dummy data
        val timer = java.util.Timer()
        timer.scheduleAtFixedRate(object : java.util.TimerTask() {
            override fun run() {
                val event = JSONObject()
                event.put("callId", callId)
                event.put("localLevel", Math.random())
                event.put("remoteLevel", Math.random())
                eventCallback(event)
            }
        }, 0, 100)
    }
    
    fun stopAudioLevelMonitoring() {
        // Stop the monitoring timer
    }
    
    fun release() {
        audioPlayers.values.forEach { it.release() }
        audioPlayers.clear()
        releaseAudioFocus()
    }
}