#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(CXONEVoicePlugin, "CXONEVoice",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(makeCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(answerCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(endCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(muteCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(playRecording, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopRecording, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getActiveCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getActiveCalls, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(holdCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(resumeCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(transferCall, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(checkPermissions, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(registerForPushNotifications, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(removeAllListeners, CAPPluginReturnPromise);
)