import Foundation
import CallKit
import AVFoundation

class CallManager: NSObject {
    private let callController = CXCallController()
    private let provider: CXProvider
    private var callStateHandler: ([String: Any]) -> Void
    
    init(callStateHandler: @escaping ([String: Any]) -> Void) {
        self.callStateHandler = callStateHandler
        
        // Configure provider
        let providerConfiguration = CXProviderConfiguration(localizedName: "CXONE Voice")
        providerConfiguration.supportsVideo = false
        providerConfiguration.maximumCallsPerCallGroup = 1
        providerConfiguration.supportedHandleTypes = [.phoneNumber]
        
        // Set icon if available
        if let iconImage = UIImage(named: "cxone-icon") {
            providerConfiguration.iconTemplateImageData = iconImage.pngData()
        }
        
        provider = CXProvider(configuration: providerConfiguration)
        
        super.init()
        
        provider.setDelegate(self, queue: nil)
    }
    
    func configure() {
        // Additional configuration if needed
    }
    
    func startCall(_ callInfo: CallInfo, completion: @escaping (Error?) -> Void) {
        let handle = CXHandle(type: .phoneNumber, value: callInfo.phoneNumber)
        let startCallAction = CXStartCallAction(call: UUID(uuidString: callInfo.callId)!, handle: handle)
        startCallAction.isVideo = false
        startCallAction.contactIdentifier = callInfo.displayName
        
        let transaction = CXTransaction(action: startCallAction)
        
        callController.request(transaction) { error in
            if let error = error {
                print("Error starting call: \(error)")
                completion(error)
            } else {
                print("Call started successfully")
                completion(nil)
            }
        }
    }
    
    func answerCall(_ callInfo: CallInfo, completion: @escaping (Error?) -> Void) {
        let answerCallAction = CXAnswerCallAction(call: UUID(uuidString: callInfo.callId)!)
        let transaction = CXTransaction(action: answerCallAction)
        
        callController.request(transaction) { error in
            if let error = error {
                print("Error answering call: \(error)")
                completion(error)
            } else {
                print("Call answered successfully")
                completion(nil)
            }
        }
    }
    
    func endCall(_ callInfo: CallInfo, completion: @escaping (Error?) -> Void) {
        let endCallAction = CXEndCallAction(call: UUID(uuidString: callInfo.callId)!)
        let transaction = CXTransaction(action: endCallAction)
        
        callController.request(transaction) { error in
            if let error = error {
                print("Error ending call: \(error)")
                completion(error)
            } else {
                print("Call ended successfully")
                completion(nil)
            }
        }
    }
    
    func setHeld(_ callInfo: CallInfo, onHold: Bool, completion: @escaping (Error?) -> Void) {
        let setHeldCallAction = CXSetHeldCallAction(call: UUID(uuidString: callInfo.callId)!, onHold: onHold)
        let transaction = CXTransaction(action: setHeldCallAction)
        
        callController.request(transaction) { error in
            if let error = error {
                print("Error setting call hold state: \(error)")
                completion(error)
            } else {
                print("Call hold state changed successfully")
                completion(nil)
            }
        }
    }
    
    func reportIncomingCall(_ callInfo: CallInfo, completion: @escaping (Error?) -> Void) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .phoneNumber, value: callInfo.phoneNumber)
        update.localizedCallerName = callInfo.displayName
        update.hasVideo = false
        update.supportsDTMF = true
        update.supportsHolding = true
        update.supportsGrouping = false
        update.supportsUngrouping = false
        
        provider.reportNewIncomingCall(with: UUID(uuidString: callInfo.callId)!, update: update) { error in
            if let error = error {
                print("Error reporting incoming call: \(error)")
                completion(error)
            } else {
                print("Incoming call reported successfully")
                completion(nil)
            }
        }
    }
    
    func reportCallEnded(_ callId: String, reason: CXCallEndedReason) {
        guard let uuid = UUID(uuidString: callId) else { return }
        provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
    }
}

// MARK: - CXProviderDelegate

extension CallManager: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        // Handle provider reset
        print("Provider did reset")
    }
    
    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        // Configure audio session
        configureAudioSession()
        
        // Notify that call is starting
        callStateHandler([
            "callId": action.callUUID.uuidString,
            "action": "startCall"
        ])
        
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Configure audio session
        configureAudioSession()
        
        // Notify that call is being answered
        callStateHandler([
            "callId": action.callUUID.uuidString,
            "action": "answerCall"
        ])
        
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // Notify that call is ending
        callStateHandler([
            "callId": action.callUUID.uuidString,
            "action": "endCall"
        ])
        
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        // Notify that call hold state is changing
        callStateHandler([
            "callId": action.callUUID.uuidString,
            "action": "setHeld",
            "onHold": action.isOnHold
        ])
        
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        // Notify that call mute state is changing
        callStateHandler([
            "callId": action.callUUID.uuidString,
            "action": "setMuted",
            "muted": action.isMuted
        ])
        
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Audio session activated
        print("Audio session activated")
    }
    
    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        // Audio session deactivated
        print("Audio session deactivated")
    }
    
    // MARK: - Private Methods
    
    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }
}