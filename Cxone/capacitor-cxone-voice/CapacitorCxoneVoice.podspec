require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapacitorCxoneVoice'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url']
  s.author = package['author']
  s.source = { :git => package['repository']['url'], :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target  = '13.0'
  s.dependency 'Capacitor'
  s.dependency 'GoogleWebRTC', '~> 1.1'
  s.swift_version = '5.1'
  s.pod_target_xcconfig = {
    'SWIFT_OBJC_BRIDGING_HEADER' => '$(PODS_TARGET_SRCROOT)/ios/Plugin/Plugin-Bridging-Header.h'
  }
  
  # Required for CallKit and PushKit
  s.frameworks = [
    'Foundation',
    'CallKit',
    'PushKit',
    'AVFoundation',
    'CoreAudio',
    'AudioToolbox',
    'SystemConfiguration'
  ]
  
  # Background modes
  s.info_plist = {
    'UIBackgroundModes' => ['voip', 'audio'],
    'NSMicrophoneUsageDescription' => 'This app requires microphone access for voice calls.'
  }
end