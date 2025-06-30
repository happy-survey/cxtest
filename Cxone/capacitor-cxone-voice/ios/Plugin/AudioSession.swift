import Foundation
import AVFoundation

class AudioSessionManager {
    private var audioPlayer: AVAudioPlayer?
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var mixerNode: AVAudioMixerNode?
    private var recordingFile: AVAudioFile?
    
    init() {
        setupAudioEngine()
    }
    
    private func setupAudioEngine() {
        audioEngine = AVAudioEngine()
        playerNode = AVAudioPlayerNode()
        mixerNode = audioEngine?.mainMixerNode
        
        guard let audioEngine = audioEngine,
              let playerNode = playerNode else { return }
        
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: mixerNode!, format: nil)
    }
    
    func configureForVoiceCall() throws {
        let session = AVAudioSession.sharedInstance()
        
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [
            .defaultToSpeaker,
            .allowBluetooth,
            .allowBluetoothA2DP,
            .mixWithOthers
        ])
        
        // Configure for low latency
        try session.setPreferredSampleRate(48000)
        try session.setPreferredIOBufferDuration(0.005) // 5ms buffer
        
        try session.setActive(true)
    }
    
    func playRecording(url: String, volume: Float, loop: Bool, completion: @escaping (Bool) -> Void) {
        guard let audioURL = URL(string: url) else {
            completion(false)
            return
        }
        
        // Download or access the audio file
        if audioURL.isFileURL {
            playLocalRecording(url: audioURL, volume: volume, loop: loop, completion: completion)
        } else {
            downloadAndPlayRecording(url: audioURL, volume: volume, loop: loop, completion: completion)
        }
    }
    
    private func playLocalRecording(url: URL, volume: Float, loop: Bool, completion: @escaping (Bool) -> Void) {
        do {
            // Use AVAudioPlayer for simple playback
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.volume = volume
            audioPlayer?.numberOfLoops = loop ? -1 : 0
            audioPlayer?.prepareToPlay()
            
            // For mixing with call audio, use audio engine
            if let audioEngine = audioEngine, let playerNode = playerNode {
                recordingFile = try AVAudioFile(forReading: url)
                
                if !audioEngine.isRunning {
                    try audioEngine.start()
                }
                
                playerNode.scheduleFile(recordingFile!, at: nil) {
                    if loop {
                        self.playLocalRecording(url: url, volume: volume, loop: loop, completion: { _ in })
                    }
                }
                
                playerNode.volume = volume
                playerNode.play()
            }
            
            audioPlayer?.play()
            completion(true)
        } catch {
            print("Error playing recording: \(error)")
            completion(false)
        }
    }
    
    private func downloadAndPlayRecording(url: URL, volume: Float, loop: Bool, completion: @escaping (Bool) -> Void) {
        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data, error == nil else {
                DispatchQueue.main.async {
                    completion(false)
                }
                return
            }
            
            // Save to temporary file
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("recording_\(UUID().uuidString).m4a")
            
            do {
                try data.write(to: tempURL)
                DispatchQueue.main.async {
                    self?.playLocalRecording(url: tempURL, volume: volume, loop: loop, completion: completion)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(false)
                }
            }
        }
        task.resume()
    }
    
    func stopRecording() {
        audioPlayer?.stop()
        playerNode?.stop()
    }
    
    func setMicrophoneMute(_ muted: Bool) {
        if let inputs = audioEngine?.inputNode {
            inputs.volume = muted ? 0.0 : 1.0
        }
    }
    
    func setupAudioRouting(toSpeaker: Bool) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.overrideOutputAudioPort(toSpeaker ? .speaker : .none)
        } catch {
            print("Failed to change audio route: \(error)")
        }
    }
    
    func startAudioLevelMonitoring(callback: @escaping (Float, Float) -> Void) {
        guard let audioEngine = audioEngine else { return }
        
        let inputNode = audioEngine.inputNode
        let outputNode = audioEngine.outputNode
        
        // Install tap on input node for local audio level
        let inputFormat = inputNode.inputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { buffer, _ in
            self.processAudioLevel(buffer: buffer, isLocal: true, callback: callback)
        }
        
        // Install tap on output node for remote audio level
        let outputFormat = outputNode.outputFormat(forBus: 0)
        outputNode.installTap(onBus: 0, bufferSize: 1024, format: outputFormat) { buffer, _ in
            self.processAudioLevel(buffer: buffer, isLocal: false, callback: callback)
        }
    }
    
    private func processAudioLevel(buffer: AVAudioPCMBuffer, isLocal: Bool, callback: @escaping (Float, Float) -> Void) {
        guard let channelData = buffer.floatChannelData else { return }
        
        let channelCount = Int(buffer.format.channelCount)
        let frameLength = Int(buffer.frameLength)
        
        var sum: Float = 0
        for channel in 0..<channelCount {
            for frame in 0..<frameLength {
                let sample = channelData[channel][frame]
                sum += sample * sample
            }
        }
        
        let rms = sqrt(sum / Float(channelCount * frameLength))
        let db = 20 * log10(rms)
        let normalizedLevel = (db + 60) / 60 // Normalize from -60dB to 0dB
        
        DispatchQueue.main.async {
            if isLocal {
                callback(max(0, min(1, normalizedLevel)), 0)
            } else {
                callback(0, max(0, min(1, normalizedLevel)))
            }
        }
    }
    
    func stopAudioLevelMonitoring() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.outputNode.removeTap(onBus: 0)
    }
    
    deinit {
        stopRecording()
        stopAudioLevelMonitoring()
        audioEngine?.stop()
    }
}