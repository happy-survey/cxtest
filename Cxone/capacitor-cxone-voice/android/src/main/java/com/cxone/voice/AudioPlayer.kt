package com.cxone.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import kotlinx.coroutines.*
import java.io.File
import java.net.URL

class AudioPlayer(private val context: Context) {
    private var mediaPlayer: MediaPlayer? = null
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    fun play(url: String, volume: Float, loop: Boolean, callback: (Boolean) -> Unit) {
        coroutineScope.launch {
            try {
                // Release any existing player
                release()
                
                // Create new media player
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .build()
                    )
                    
                    // Set volume
                    setVolume(volume, volume)
                    
                    // Set looping
                    isLooping = loop
                    
                    // Set completion listener
                    setOnCompletionListener {
                        if (!loop) {
                            callback(true)
                        }
                    }
                    
                    // Set error listener
                    setOnErrorListener { _, _, _ ->
                        callback(false)
                        true
                    }
                }
                
                // Handle different URL types
                when {
                    url.startsWith("http://") || url.startsWith("https://") -> {
                        // Download and play from URL
                        playFromUrl(url, callback)
                    }
                    url.startsWith("file://") -> {
                        // Play from local file
                        val uri = Uri.parse(url)
                        mediaPlayer?.setDataSource(context, uri)
                        prepareAndPlay(callback)
                    }
                    else -> {
                        // Assume it's a local file path
                        mediaPlayer?.setDataSource(url)
                        prepareAndPlay(callback)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    callback(false)
                }
            }
        }
    }
    
    private suspend fun playFromUrl(url: String, callback: (Boolean) -> Unit) {
        withContext(Dispatchers.IO) {
            try {
                // Download to temporary file
                val tempFile = File(context.cacheDir, "recording_${System.currentTimeMillis()}.tmp")
                
                URL(url).openStream().use { input ->
                    tempFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                
                // Play from temporary file
                mediaPlayer?.setDataSource(tempFile.absolutePath)
                prepareAndPlay(callback)
                
                // Delete temp file after playback
                tempFile.deleteOnExit()
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    callback(false)
                }
            }
        }
    }
    
    private suspend fun prepareAndPlay(callback: (Boolean) -> Unit) {
        try {
            mediaPlayer?.prepare()
            mediaPlayer?.start()
            
            withContext(Dispatchers.Main) {
                callback(true)
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                callback(false)
            }
        }
    }
    
    fun stop() {
        mediaPlayer?.stop()
    }
    
    fun pause() {
        mediaPlayer?.pause()
    }
    
    fun resume() {
        mediaPlayer?.start()
    }
    
    fun setVolume(volume: Float) {
        mediaPlayer?.setVolume(volume, volume)
    }
    
    fun release() {
        mediaPlayer?.release()
        mediaPlayer = null
    }
    
    fun isPlaying(): Boolean {
        return mediaPlayer?.isPlaying ?: false
    }
    
    protected fun finalize() {
        release()
        coroutineScope.cancel()
    }
}