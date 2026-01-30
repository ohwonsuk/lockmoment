import Foundation

import FamilyControls
import SwiftUI
import UIKit

@objc(LockControl)
class LockControl: NSObject {
  
  @objc static func moduleName() -> String {
    return "LockControl"
  }
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      DispatchQueue.main.async {
        Task {
          do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            resolve(true)
          } catch {
            reject("AUTH_ERROR", "Failed to request authorization: \(error.localizedDescription)", error)
          }
        }
      }
    } else {
      reject("OS_VERSION_ERROR", "FamilyControls requires iOS 15.0+", nil)
    }
  }
  
  @objc(checkAuthorization:rejecter:)
  func checkAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      let status = AuthorizationCenter.shared.authorizationStatus
      resolve(status.rawValue)
    } else {
      resolve(0)
    }
  }

  @objc(presentFamilyActivityPicker:resolve:rejecter:)
  func presentFamilyActivityPicker(_ lockType: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      DispatchQueue.main.async {
        LockModel.shared.currentType = lockType // Set the target selection type
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
          reject("UI_ERROR", "Could not find root view controller", nil)
          return
        }
        
        var topController = rootViewController
        while let presented = topController.presentedViewController {
            topController = presented
        }
        
        // If we are already presenting a Picker (unlikely but possible), dismiss it? 
        // Or if the topController IS the QuickLockPicker modal, we present on top of it.
        
        let pickerView = PickerView {
            topController.dismiss(animated: true) {
                let sel = lockType == "phone" ? LockModel.shared.phoneSelection : LockModel.shared.appSelection
                let count = sel.applicationTokens.count + sel.categoryTokens.count
                resolve(count)
            }
        }
        let hostingController = UIHostingController(rootView: pickerView)
        hostingController.modalPresentationStyle = .formSheet
        topController.present(hostingController, animated: true)
      }
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(startLock:lockType:name:packagesJson:resolve:rejecter:)
  func startLock(_ duration: Double, lockType: String, name: String, packagesJson: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      // TODO: Handle lockType ('app' vs 'phone') logic here or in LockModel
      // For now, we utilize the existing startLock which likely uses LockModel.shared.selection
      // Pass duration and lockType to LockModel (duration is in ms)
      LockModel.shared.startLock(duration: duration, type: lockType)
      resolve(true)
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(stopLock:rejecter:)
  func stopLock(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      LockModel.shared.stopLock()
      resolve(true)
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(openNotificationSettings:rejecter:)
  func openNotificationSettings(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if let url = URL(string: UIApplication.openSettingsURLString) {
        if UIApplication.shared.canOpenURL(url) {
          UIApplication.shared.open(url, options: [:], completionHandler: { success in
            resolve(success)
          })
        } else {
          reject("URL_ERROR", "Cannot open settings URL", nil)
        }
      } else {
        reject("URL_ERROR", "Invalid settings URL", nil)
      }
    }
  }

  @objc(getSelectedAppCount:rejecter:)
  func getSelectedAppCount(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      let sel = LockModel.shared.selection // This returns based on currentType
      let count = sel.applicationTokens.count + sel.categoryTokens.count
      resolve(count)
    } else {
      resolve(0)
    }
  }

  @objc(isLocked:rejecter:)
  func isLocked(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
        _ = LockModel.shared.checkExpiration()
        resolve(LockModel.shared.isLocked)
    } else {
        resolve(false)
    }
  }

  @objc(getRemainingTime:rejecter:)
  func getRemainingTime(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
        _ = LockModel.shared.checkExpiration()
        if let endTime = LockModel.shared.endTime {
            let remaining = endTime.timeIntervalSince(Date()) * 1000 // Convert to ms
            resolve(max(0, remaining))
        } else {
            resolve(0)
        }
    } else {
        resolve(0)
    }
  }

  @objc(restoreLockState:rejecter:)
  func restoreLockState(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc(checkAccessibilityPermission:rejecter:)
  func checkAccessibilityPermission(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc(getInstalledApps:rejecter:)
  func getInstalledApps(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve([])
  }

  @objc(scheduleAlarm:startTime:endTime:days:lockType:name:allowedPackage:resolve:rejecter:)
  func scheduleAlarm(_ scheduleId: String, startTime: String, endTime: String, days: [String], lockType: String, name: String, allowedPackage: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc(cancelAlarm:resolve:rejecter:)
  func cancelAlarm(_ scheduleId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc(openDefaultDialer:rejecter:)
  func openDefaultDialer(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let schemes = ["contacts://", "mobilephone-contacts://", "tel:"]
      
      func tryOpen(index: Int) {
        guard index < schemes.count else {
          resolve(false)
          return
        }
        
        if let url = URL(string: schemes[index]) {
          UIApplication.shared.open(url, options: [:]) { success in
            if success {
              resolve(true)
            } else {
              tryOpen(index: index + 1)
            }
          }
        } else {
          tryOpen(index: index + 1)
        }
      }
      
      tryOpen(index: 0)
    }
  }

  @objc(openDefaultMessages:rejecter:)
  func openDefaultMessages(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if let url = URL(string: "sms:") {
        UIApplication.shared.open(url, options: [:]) { success in
          resolve(success)
        }
      } else {
        resolve(false)
      }
    }
  }

  @objc(requestNotificationPermission:rejecter:)
  func requestNotificationPermission(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc(getNativeHistory:rejecter:)
  func getNativeHistory(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve("[]")
  }
}
