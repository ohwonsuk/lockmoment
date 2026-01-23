#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (LockControlModule, NSObject)

RCT_EXTERN_METHOD(requestAuthorization : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(checkAuthorization : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(presentFamilyActivityPicker : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(startLock : (double)duration resolve : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopLock : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
