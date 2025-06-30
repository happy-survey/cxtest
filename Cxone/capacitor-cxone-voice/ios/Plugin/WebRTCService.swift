import Foundation
import WebRTC

class WebRTCService: NSObject {
    private var peerConnectionFactory: RTCPeerConnectionFactory?
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?
    private var videoCapturer: RTCCameraVideoCapturer?
    private var dataChannels: [String: RTCDataChannel] = [:]
    
    private var useCXONEServers = false
    private var cxoneStunServers: [String]?
    private var cxoneTurnServers: [String]?
    private var turnUsername: String?
    private var turnCredential: String?
    
    private let rtcConfig = RTCConfiguration()
    private let mediaConstraints = RTCMediaConstraints(
        mandatoryConstraints: nil,
        optionalConstraints: ["DtlsSrtpKeyAgreement": "true"]
    )
    
    override init() {
        super.init()
        setupWebRTC()
    }
    
    private func setupWebRTC() {
        // Initialize SSL
        RTCInitializeSSL()
        
        // Create peer connection factory
        let encoderFactory = RTCDefaultVideoEncoderFactory()
        let decoderFactory = RTCDefaultVideoDecoderFactory()
        
        peerConnectionFactory = RTCPeerConnectionFactory(
            encoderFactory: encoderFactory,
            decoderFactory: decoderFactory
        )
        
        // Configure ICE servers
        updateICEServers()
        rtcConfig.sdpSemantics = .unifiedPlan
        rtcConfig.continualGatheringPolicy = .gatherContinually
    }
    
    func makeCall(to phoneNumber: String, completion: @escaping (Bool) -> Void) {
        let callId = UUID().uuidString
        
        guard let peerConnection = createPeerConnection(callId: callId) else {
            completion(false)
            return
        }
        
        // Add local audio track
        addLocalAudioTrack(to: peerConnection)
        
        // Create offer
        let offerConstraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "false"
            ],
            optionalConstraints: nil
        )
        
        peerConnection.offer(for: offerConstraints) { [weak self] sdp, error in
            guard let sdp = sdp, error == nil else {
                print("Failed to create offer: \(error?.localizedDescription ?? "Unknown error")")
                completion(false)
                return
            }
            
            peerConnection.setLocalDescription(sdp) { error in
                if let error = error {
                    print("Failed to set local description: \(error.localizedDescription)")
                    completion(false)
                } else {
                    // Send offer to signaling server via CXONE SDK
                    self?.sendOffer(sdp: sdp, callId: callId)
                    completion(true)
                }
            }
        }
    }
    
    func answerCall(callId: String, completion: @escaping (Bool) -> Void) {
        guard let peerConnection = peerConnections[callId] else {
            // Create new peer connection if not exists
            guard let newPeerConnection = createPeerConnection(callId: callId) else {
                completion(false)
                return
            }
            peerConnections[callId] = newPeerConnection
            
            // Add local audio track
            addLocalAudioTrack(to: newPeerConnection)
            
            completion(true)
            return
        }
        
        // Create answer
        let answerConstraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "true",
                "OfferToReceiveVideo": "false"
            ],
            optionalConstraints: nil
        )
        
        peerConnection.answer(for: answerConstraints) { [weak self] sdp, error in
            guard let sdp = sdp, error == nil else {
                print("Failed to create answer: \(error?.localizedDescription ?? "Unknown error")")
                completion(false)
                return
            }
            
            peerConnection.setLocalDescription(sdp) { error in
                if let error = error {
                    print("Failed to set local description: \(error.localizedDescription)")
                    completion(false)
                } else {
                    // Send answer to signaling server via CXONE SDK
                    self?.sendAnswer(sdp: sdp, callId: callId)
                    completion(true)
                }
            }
        }
    }
    
    func endCall(callId: String) {
        if let peerConnection = peerConnections[callId] {
            peerConnection.close()
            peerConnections.removeValue(forKey: callId)
        }
        
        if let dataChannel = dataChannels[callId] {
            dataChannel.close()
            dataChannels.removeValue(forKey: callId)
        }
    }
    
    func setMute(callId: String, muted: Bool) {
        localAudioTrack?.isEnabled = !muted
    }
    
    func handleRemoteOffer(sdp: RTCSessionDescription, callId: String) {
        guard let peerConnection = peerConnections[callId] ?? createPeerConnection(callId: callId) else {
            return
        }
        
        peerConnection.setRemoteDescription(sdp) { error in
            if let error = error {
                print("Failed to set remote description: \(error.localizedDescription)")
            }
        }
    }
    
    func handleRemoteAnswer(sdp: RTCSessionDescription, callId: String) {
        guard let peerConnection = peerConnections[callId] else { return }
        
        peerConnection.setRemoteDescription(sdp) { error in
            if let error = error {
                print("Failed to set remote description: \(error.localizedDescription)")
            }
        }
    }
    
    func handleIceCandidate(candidate: RTCIceCandidate, callId: String) {
        guard let peerConnection = peerConnections[callId] else { return }
        peerConnection.add(candidate)
    }
    
    // MARK: - Private Methods
    
    private func createPeerConnection(callId: String) -> RTCPeerConnection? {
        guard let factory = peerConnectionFactory else { return nil }
        
        let peerConnection = factory.peerConnection(with: rtcConfig, constraints: mediaConstraints, delegate: self)
        peerConnections[callId] = peerConnection
        
        // Create data channel for additional communication
        let dataChannelConfig = RTCDataChannelConfiguration()
        dataChannelConfig.isOrdered = true
        
        if let dataChannel = peerConnection.dataChannel(forLabel: "cxone-voice-data", configuration: dataChannelConfig) {
            dataChannels[callId] = dataChannel
            dataChannel.delegate = self
        }
        
        return peerConnection
    }
    
    private func addLocalAudioTrack(to peerConnection: RTCPeerConnection) {
        guard let factory = peerConnectionFactory else { return }
        
        let audioConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let audioSource = factory.audioSource(with: audioConstraints)
        
        // Configure audio processing
        audioSource.volume = 1.0
        
        localAudioTrack = factory.audioTrack(with: audioSource, trackId: "audio0")
        
        if let localAudioTrack = localAudioTrack {
            peerConnection.add(localAudioTrack, streamIds: ["stream0"])
        }
    }
    
    private func sendOffer(sdp: RTCSessionDescription, callId: String) {
        // This would send the offer through CXONE SDK to the signaling server
        print("Sending offer for call \(callId)")
    }
    
    private func sendAnswer(sdp: RTCSessionDescription, callId: String) {
        // This would send the answer through CXONE SDK to the signaling server
        print("Sending answer for call \(callId)")
    }
    
    private func sendIceCandidate(candidate: RTCIceCandidate, callId: String) {
        // This would send the ICE candidate through CXONE SDK to the signaling server
        print("Sending ICE candidate for call \(callId)")
    }
    
    deinit {
        RTCCleanupSSL()
    }
}

// MARK: - RTCPeerConnectionDelegate

extension WebRTCService: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        print("Signaling state changed: \(stateChanged)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        print("Media stream added")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        print("Media stream removed")
    }
    
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        print("Peer connection should negotiate")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        print("ICE connection state changed: \(newState)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        print("ICE gathering state changed: \(newState)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        // Find call ID for this peer connection
        if let callId = peerConnections.first(where: { $0.value === peerConnection })?.key {
            sendIceCandidate(candidate: candidate, callId: callId)
        }
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {
        print("ICE candidates removed")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        print("Data channel opened")
    }
}

// MARK: - RTCDataChannelDelegate

extension WebRTCService: RTCDataChannelDelegate {
    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        print("Data channel state changed: \(dataChannel.readyState)")
    }
    
    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        if buffer.isBinary {
            print("Received binary data")
        } else {
            if let message = String(data: buffer.data, encoding: .utf8) {
                print("Received message: \(message)")
            }
        }
    }
}

// MARK: - CXONE Configuration

extension WebRTCService {
    func configureCXONEServers(stunServers: [String]?, turnServers: [String]?, username: String? = nil, credential: String? = nil) {
        cxoneStunServers = stunServers
        cxoneTurnServers = turnServers
        turnUsername = username
        turnCredential = credential
        useCXONEServers = !(stunServers?.isEmpty ?? true)
        updateICEServers()
    }
    
    private func updateICEServers() {
        // CXONE servers are required
        guard useCXONEServers, let stunServers = cxoneStunServers, !stunServers.isEmpty else {
            fatalError("CXONE WebRTC servers must be configured before making calls")
        }
        
        var iceServers: [RTCIceServer] = []
        
        // Add STUN servers
        stunServers.forEach { stun in
            iceServers.append(RTCIceServer(urlStrings: [stun]))
        }
        
        // Add TURN servers with credentials
        cxoneTurnServers?.forEach { turn in
            iceServers.append(RTCIceServer(
                urlStrings: [turn],
                username: turnUsername ?? "cxone",
                credential: turnCredential ?? "cxone"
            ))
        }
        
        rtcConfig.iceServers = iceServers
    }
}