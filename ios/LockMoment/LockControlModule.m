#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (LockControl, NSObject)

RCT_EXTERN_METHOD(requestAuthorization : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(checkAuthorization : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(presentFamilyActivityPicker : (NSString *)lockType resolve : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(startLock : (double)duration lockType : (
    NSString *)lockType name : (NSString *)name packagesJson : (NSString *)
                      packagesJson preventAppRemoval : (BOOL)
                          preventAppRemoval resolve : (RCTPromiseResolveBlock)
                              resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopLock : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(openNotificationSettings : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isLocked : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getRemainingTime : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restoreLockState : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(checkAccessibilityPermission : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getInstalledApps : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(
    scheduleAlarm : (NSString *)scheduleId startTime : (
        NSString *)startTime endTime : (NSString *)endTime days : (NSArray *)
        days lockType : (NSString *)lockType name : (NSString *)name
            allowedPackage : (NSString *)allowedPackage preventAppRemoval : (
                BOOL)preventAppRemoval preLockMinutes : (double)
                preLockMinutes resolve : (RCTPromiseResolveBlock)
                    resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelAlarm : (NSString *)scheduleId resolve : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(openDefaultDialer : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(openDefaultMessages : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(requestNotificationPermission : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getSelectedAppCount : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getNativeHistory : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
