package com.cxone.voice

import android.content.Context
import org.webrtc.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class WebRTCManager(private val context: Context) {
    
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private val peerConnections = mutableMapOf<String, PeerConnection>()
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private var useCXONEServers = false
    private var cxoneStunServers: List<String>? = null
    private var cxoneTurnServers: List<String>? = null
    private var turnUsername: String? = null
    private var turnCredential: String? = null
    
    private val iceServers: List<PeerConnection.IceServer>
        get() {
            // CXONE servers are required
            if (!useCXONEServers || cxoneStunServers.isNullOrEmpty()) {
                throw IllegalStateException("CXONE WebRTC servers must be configured before making calls")
            }
            
            val servers = mutableListOf<PeerConnection.IceServer>()
            
            // Add STUN servers
            cxoneStunServers?.forEach { stun ->
                servers.add(PeerConnection.IceServer.builder(stun).createIceServer())
            }
            
            // Add TURN servers with credentials
            cxoneTurnServers?.forEach { turn ->
                servers.add(PeerConnection.IceServer.builder(turn)
                    .setUsername(turnUsername ?: "cxone")
                    .setPassword(turnCredential ?: "cxone")
                    .createIceServer())
            }
            
            return servers
        }
    
    init {
        initializePeerConnectionFactory()
    }
    
    private fun initializePeerConnectionFactory() {
        val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        
        PeerConnectionFactory.initialize(initOptions)
        
        val options = PeerConnectionFactory.Options()
        
        val encoderFactory = DefaultVideoEncoderFactory(
            EglBase.create().eglBaseContext,
            true,
            true
        )
        
        val decoderFactory = DefaultVideoDecoderFactory(
            EglBase.create().eglBaseContext
        )
        
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(options)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
        
        createLocalAudioTrack()
    }
    
    private fun createLocalAudioTrack() {
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "true"))
        }
        
        val audioSource = peerConnectionFactory?.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory?.createAudioTrack("audio0", audioSource)
    }
    
    fun makeCall(phoneNumber: String, callback: (Boolean) -> Unit) {
        executor.execute {
            val callId = generateCallId()
            val peerConnection = createPeerConnection(callId)
            
            if (peerConnection == null) {
                callback(false)
                return@execute
            }
            
            // Add local audio track
            localAudioTrack?.let { track ->
                val streamIds = listOf("stream0")
                peerConnection.addTrack(track, streamIds)
            }
            
            // Create offer
            val offerConstraints = MediaConstraints().apply {
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            }
            
            peerConnection.createOffer(object : SdpObserver {
                override fun onCreateSuccess(sdp: SessionDescription?) {
                    sdp?.let {
                        peerConnection.setLocalDescription(object : SdpObserver {
                            override fun onCreateSuccess(p0: SessionDescription?) {}
                            override fun onSetSuccess() {
                                // Send offer to signaling server
                                sendOffer(it, callId)
                                callback(true)
                            }
                            override fun onCreateFailure(p0: String?) {
                                callback(false)
                            }
                            override fun onSetFailure(p0: String?) {
                                callback(false)
                            }
                        }, it)
                    }
                }
                
                override fun onSetSuccess() {}
                override fun onCreateFailure(error: String?) {
                    callback(false)
                }
                override fun onSetFailure(error: String?) {}
            }, offerConstraints)
        }
    }
    
    fun answerCall(callId: String, callback: (Boolean) -> Unit) {
        executor.execute {
            var peerConnection = peerConnections[callId]
            
            if (peerConnection == null) {
                peerConnection = createPeerConnection(callId)
                if (peerConnection == null) {
                    callback(false)
                    return@execute
                }
            }
            
            // Add local audio track
            localAudioTrack?.let { track ->
                val streamIds = listOf("stream0")
                peerConnection.addTrack(track, streamIds)
            }
            
            // Create answer
            val answerConstraints = MediaConstraints().apply {
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            }
            
            peerConnection.createAnswer(object : SdpObserver {
                override fun onCreateSuccess(sdp: SessionDescription?) {
                    sdp?.let {
                        peerConnection.setLocalDescription(object : SdpObserver {
                            override fun onCreateSuccess(p0: SessionDescription?) {}
                            override fun onSetSuccess() {
                                // Send answer to signaling server
                                sendAnswer(it, callId)
                                callback(true)
                            }
                            override fun onCreateFailure(p0: String?) {
                                callback(false)
                            }
                            override fun onSetFailure(p0: String?) {
                                callback(false)
                            }
                        }, it)
                    }
                }
                
                override fun onSetSuccess() {}
                override fun onCreateFailure(error: String?) {
                    callback(false)
                }
                override fun onSetFailure(error: String?) {}
            }, answerConstraints)
        }
    }
    
    fun endCall(callId: String) {
        executor.execute {
            peerConnections[callId]?.let { pc ->
                pc.close()
                peerConnections.remove(callId)
            }
        }
    }
    
    fun setMute(callId: String, muted: Boolean) {
        localAudioTrack?.setEnabled(!muted)
    }
    
    fun handleRemoteOffer(sdp: SessionDescription, callId: String) {
        executor.execute {
            val peerConnection = peerConnections[callId] ?: createPeerConnection(callId)
            peerConnection?.setRemoteDescription(object : SdpObserver {
                override fun onCreateSuccess(p0: SessionDescription?) {}
                override fun onSetSuccess() {
                    // Remote description set successfully
                }
                override fun onCreateFailure(p0: String?) {}
                override fun onSetFailure(p0: String?) {}
            }, sdp)
        }
    }
    
    fun handleRemoteAnswer(sdp: SessionDescription, callId: String) {
        executor.execute {
            peerConnections[callId]?.setRemoteDescription(object : SdpObserver {
                override fun onCreateSuccess(p0: SessionDescription?) {}
                override fun onSetSuccess() {
                    // Remote description set successfully
                }
                override fun onCreateFailure(p0: String?) {}
                override fun onSetFailure(p0: String?) {}
            }, sdp)
        }
    }
    
    fun handleIceCandidate(candidate: IceCandidate, callId: String) {
        executor.execute {
            peerConnections[callId]?.addIceCandidate(candidate)
        }
    }
    
    fun configureCXONEServers(
        stunServers: List<String>?, 
        turnServers: List<String>?,
        username: String? = null,
        credential: String? = null
    ) {
        cxoneStunServers = stunServers
        cxoneTurnServers = turnServers
        turnUsername = username
        turnCredential = credential
        useCXONEServers = !stunServers.isNullOrEmpty()
    }
    
    private fun createPeerConnection(callId: String): PeerConnection? {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            keyType = PeerConnection.KeyType.ECDSA
            enableDtlsSrtp = true
        }
        
        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                // Handle signaling state change
            }
            
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                // Handle ICE connection state change
            }
            
            override fun onIceConnectionReceivingChange(receiving: Boolean) {
                // Handle ICE connection receiving change
            }
            
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
                // Handle ICE gathering state change
            }
            
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    sendIceCandidate(it, callId)
                }
            }
            
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {
                // Handle removed candidates
            }
            
            override fun onAddStream(stream: MediaStream?) {
                // Handle added stream
            }
            
            override fun onRemoveStream(stream: MediaStream?) {
                // Handle removed stream
            }
            
            override fun onDataChannel(dataChannel: DataChannel?) {
                // Handle data channel
            }
            
            override fun onRenegotiationNeeded() {
                // Handle renegotiation
            }
            
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                // Handle added track
            }
        }
        
        val peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, observer)
        peerConnection?.let {
            peerConnections[callId] = it
        }
        
        return peerConnection
    }
    
    private fun sendOffer(sdp: SessionDescription, callId: String) {
        // Send offer through CXONE SDK signaling
    }
    
    private fun sendAnswer(sdp: SessionDescription, callId: String) {
        // Send answer through CXONE SDK signaling
    }
    
    private fun sendIceCandidate(candidate: IceCandidate, callId: String) {
        // Send ICE candidate through CXONE SDK signaling
    }
    
    private fun generateCallId(): String {
        return "call-${System.currentTimeMillis()}-${(0..9999).random()}"
    }
    
    fun release() {
        executor.execute {
            peerConnections.values.forEach { it.close() }
            peerConnections.clear()
            
            localAudioTrack?.dispose()
            localVideoTrack?.dispose()
            
            peerConnectionFactory?.dispose()
            
            executor.shutdown()
        }
    }
}