import Foundation
import Capacitor
import CallKit
import AVFoundation
import PushKit
import WebRTC

@objc(CXONEVoicePlugin)
public class CXONEVoicePlugin: CAPPlugin {
    private var callManager: CallManager?
    private var audioSession: AudioSessionManager?
    private var webRTCService: WebRTCService?
    private var activeCalls: [String: CallInfo] = [:]
    private var pushRegistry: PKPushRegistry?
    private var cxoneSDK: CXONEVoiceSDK?
    
    public override func load() {
        super.load()
        setupCallKit()
        setupAudioSession()
        setupWebRTC()
    }
    
    private func setupCallKit() {
        callManager = CallManager { [weak self] in
            self?.notifyListeners("callStateChanged", data: $0)
        }
    }
    
    private func setupAudioSession() {
        audioSession = AudioSessionManager()
    }
    
    private func setupWebRTC() {
        webRTCService = WebRTCService()
    }
    
    @objc func initialize(_ call: CAPPluginCall) {
        guard let agentId = call.getString("agentId"),
              let apiKey = call.getString("apiKey"),
              let environment = call.getString("environment") else {
            call.reject("Missing required parameters")
            return
        }
        
        let enableCallKit = call.getBool("enableCallKit", true)
        let enablePushNotifications = call.getBool("enablePushNotifications", true)
        
        // Initialize CXONE SDK
        cxoneSDK = CXONEVoiceSDK(
            agentId: agentId,
            apiKey: apiKey,
            environment: environment
        )
        
        // Configure CallKit if enabled
        if enableCallKit {
            callManager?.configure()
        }
        
        // Setup push notifications if enabled
        if enablePushNotifications {
            setupPushNotifications()
        }
        
        call.resolve()
    }
    
    @objc func makeCall(_ call: CAPPluginCall) {
        guard let phoneNumber = call.getString("phoneNumber") else {
            call.reject("Phone number is required")
            return
        }
        
        let callerId = call.getString("callerId")
        let displayName = call.getString("displayName")
        let metadata = call.getObject("metadata")
        
        // Generate call ID
        let callId = UUID().uuidString
        
        // Create call info
        let callInfo = CallInfo(
            callId: callId,
            phoneNumber: phoneNumber,
            displayName: displayName,
            direction: .outbound,
            state: .dialing
        )
        
        activeCalls[callId] = callInfo
        
        // Start outgoing call with CallKit
        callManager?.startCall(callInfo) { [weak self] error in
            if let error = error {
                call.reject("Failed to start call: \(error.localizedDescription)")
                return
            }
            
            // Setup WebRTC connection
            self?.webRTCService?.makeCall(to: phoneNumber) { success in
                if success {
                    call.resolve([
                        "callId": callId,
                        "state": "dialing"
                    ])
                } else {
                    call.reject("Failed to establish WebRTC connection")
                }
            }
        }
    }
    
    @objc func answerCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId") else {
            call.reject("Call ID is required")
            return
        }
        
        guard let callInfo = activeCalls[callId] else {
            call.reject("Call not found")
            return
        }
        
        // Answer call with CallKit
        callManager?.answerCall(callInfo) { [weak self] error in
            if let error = error {
                call.reject("Failed to answer call: \(error.localizedDescription)")
                return
            }
            
            // Setup WebRTC connection
            self?.webRTCService?.answerCall(callId: callId) { success in
                if success {
                    self?.updateCallState(callId: callId, state: .connected)
                    call.resolve()
                } else {
                    call.reject("Failed to establish WebRTC connection")
                }
            }
        }
    }
    
    @objc func endCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId") else {
            call.reject("Call ID is required")
            return
        }
        
        guard let callInfo = activeCalls[callId] else {
            call.reject("Call not found")
            return
        }
        
        // End call with CallKit
        callManager?.endCall(callInfo) { [weak self] error in
            if let error = error {
                call.reject("Failed to end call: \(error.localizedDescription)")
                return
            }
            
            // Cleanup WebRTC
            self?.webRTCService?.endCall(callId: callId)
            
            // Remove from active calls
            self?.activeCalls.removeValue(forKey: callId)
            
            call.resolve()
        }
    }
    
    @objc func muteCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId"),
              let muted = call.getBool("muted") else {
            call.reject("Missing required parameters")
            return
        }
        
        webRTCService?.setMute(callId: callId, muted: muted)
        
        if var callInfo = activeCalls[callId] {
            callInfo.isMuted = muted
            activeCalls[callId] = callInfo
        }
        
        call.resolve()
    }
    
    @objc func playRecording(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId"),
              let recordingUrl = call.getString("recordingUrl") else {
            call.reject("Missing required parameters")
            return
        }
        
        let volume = call.getFloat("volume", 0.5)
        let loop = call.getBool("loop", false)
        
        audioSession?.playRecording(
            url: recordingUrl,
            volume: volume,
            loop: loop
        ) { [weak self] success in
            if success {
                self?.notifyListeners("recordingPlaybackStateChanged", data: [
                    "callId": callId,
                    "state": "started",
                    "recordingUrl": recordingUrl
                ])
                call.resolve()
            } else {
                call.reject("Failed to play recording")
            }
        }
    }
    
    @objc func stopRecording(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId") else {
            call.reject("Call ID is required")
            return
        }
        
        audioSession?.stopRecording()
        
        notifyListeners("recordingPlaybackStateChanged", data: [
            "callId": callId,
            "state": "stopped"
        ])
        
        call.resolve()
    }
    
    @objc func getActiveCall(_ call: CAPPluginCall) {
        let activeCall = activeCalls.values.first { $0.state == .connected }
        
        if let activeCall = activeCall {
            call.resolve(activeCall.toDictionary())
        } else {
            call.resolve([:])
        }
    }
    
    @objc func getActiveCalls(_ call: CAPPluginCall) {
        let calls = activeCalls.values.map { $0.toDictionary() }
        call.resolve(["calls": calls])
    }
    
    @objc func holdCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId") else {
            call.reject("Call ID is required")
            return
        }
        
        guard var callInfo = activeCalls[callId] else {
            call.reject("Call not found")
            return
        }
        
        callManager?.setHeld(callInfo, onHold: true) { [weak self] error in
            if let error = error {
                call.reject("Failed to hold call: \(error.localizedDescription)")
                return
            }
            
            callInfo.isOnHold = true
            self?.activeCalls[callId] = callInfo
            self?.updateCallState(callId: callId, state: .held)
            
            call.resolve()
        }
    }
    
    @objc func resumeCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId") else {
            call.reject("Call ID is required")
            return
        }
        
        guard var callInfo = activeCalls[callId] else {
            call.reject("Call not found")
            return
        }
        
        callManager?.setHeld(callInfo, onHold: false) { [weak self] error in
            if let error = error {
                call.reject("Failed to resume call: \(error.localizedDescription)")
                return
            }
            
            callInfo.isOnHold = false
            self?.activeCalls[callId] = callInfo
            self?.updateCallState(callId: callId, state: .connected)
            
            call.resolve()
        }
    }
    
    @objc func checkPermissions(_ call: CAPPluginCall) {
        var permissions: [String: String] = [:]
        
        // Check microphone permission
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            permissions["microphone"] = "granted"
        case .denied:
            permissions["microphone"] = "denied"
        case .undetermined:
            permissions["microphone"] = "prompt"
        @unknown default:
            permissions["microphone"] = "prompt"
        }
        
        // Check notification permission
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized:
                permissions["notifications"] = "granted"
            case .denied:
                permissions["notifications"] = "denied"
            case .notDetermined:
                permissions["notifications"] = "prompt"
            default:
                permissions["notifications"] = "prompt"
            }
            
            call.resolve(permissions)
        }
    }
    
    @objc func requestPermissions(_ call: CAPPluginCall) {
        var permissions: [String: String] = [:]
        let group = DispatchGroup()
        
        // Request microphone permission
        group.enter()
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            permissions["microphone"] = granted ? "granted" : "denied"
            group.leave()
        }
        
        // Request notification permission
        group.enter()
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            permissions["notifications"] = granted ? "granted" : "denied"
            group.leave()
        }
        
        group.notify(queue: .main) {
            call.resolve(permissions)
        }
    }
    
    @objc func registerForPushNotifications(_ call: CAPPluginCall) {
        setupPushNotifications()
        
        // Return cached push token if available
        if let pushToken = UserDefaults.standard.string(forKey: "voipPushToken") {
            call.resolve(["pushToken": pushToken])
        } else {
            call.reject("Push token not available yet")
        }
    }
    
    // MARK: - Private Methods
    
    private func setupPushNotifications() {
        pushRegistry = PKPushRegistry(queue: DispatchQueue.main)
        pushRegistry?.delegate = self
        pushRegistry?.desiredPushTypes = [.voIP]
    }
    
    private func updateCallState(callId: String, state: CallState) {
        guard var callInfo = activeCalls[callId] else { return }
        
        let previousState = callInfo.state
        callInfo.state = state
        activeCalls[callId] = callInfo
        
        notifyListeners("callStateChanged", data: [
            "callId": callId,
            "previousState": previousState.rawValue,
            "currentState": state.rawValue
        ])
    }
}

// MARK: - PKPushRegistryDelegate

extension CXONEVoicePlugin: PKPushRegistryDelegate {
    public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        if type == .voIP {
            let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
            UserDefaults.standard.set(token, forKey: "voipPushToken")
            
            // Send token to CXONE server
            cxoneSDK?.registerPushToken(token)
        }
    }
    
    public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType) {
        if type == .voIP {
            handleIncomingCall(payload: payload)
        }
    }
    
    private func handleIncomingCall(payload: PKPushPayload) {
        guard let callData = payload.dictionaryPayload as? [String: Any],
              let callId = callData["callId"] as? String,
              let phoneNumber = callData["phoneNumber"] as? String else {
            return
        }
        
        let displayName = callData["displayName"] as? String
        
        let callInfo = CallInfo(
            callId: callId,
            phoneNumber: phoneNumber,
            displayName: displayName,
            direction: .inbound,
            state: .ringing
        )
        
        activeCalls[callId] = callInfo
        
        // Report incoming call to CallKit
        callManager?.reportIncomingCall(callInfo) { [weak self] error in
            if error == nil {
                self?.notifyListeners("incomingCall", data: [
                    "callId": callId,
                    "phoneNumber": phoneNumber,
                    "displayName": displayName ?? "",
                    "hasVideo": false
                ])
            }
        }
    }
}

// MARK: - Supporting Types

struct CallInfo {
    let callId: String
    let phoneNumber: String
    let displayName: String?
    let direction: CallDirection
    var state: CallState
    var isMuted: Bool = false
    var isOnHold: Bool = false
    let startTime: Date = Date()
    
    func toDictionary() -> [String: Any] {
        return [
            "callId": callId,
            "phoneNumber": phoneNumber,
            "displayName": displayName ?? "",
            "direction": direction.rawValue,
            "state": state.rawValue,
            "isMuted": isMuted,
            "isOnHold": isOnHold,
            "startTime": ISO8601DateFormatter().string(from: startTime),
            "duration": Int(Date().timeIntervalSince(startTime))
        ]
    }
}

enum CallDirection: String {
    case inbound = "inbound"
    case outbound = "outbound"
}

enum CallState: String {
    case idle = "idle"
    case dialing = "dialing"
    case ringing = "ringing"
    case connecting = "connecting"
    case connected = "connected"
    case holding = "holding"
    case held = "held"
    case resuming = "resuming"
    case disconnecting = "disconnecting"
    case disconnected = "disconnected"
    case failed = "failed"
}