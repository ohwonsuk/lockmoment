import Foundation

import FamilyControls
import SwiftUI
import UIKit
import React

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
  func presentFamilyActivityPicker(_ lockType: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      DispatchQueue.main.async {
        let type = lockType ?? "app"
        LockModel.shared.currentType = type
        
        guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }),
              let rootViewController = window.rootViewController else {
          reject("UI_ERROR", "Could not find key window or root view controller", nil)
          return
        }
        
        var topController = rootViewController
        while let presented = topController.presentedViewController, !presented.isBeingDismissed {
            topController = presented
        }
        
        let pickerView = PickerView {
            topController.dismiss(animated: true) {
                let sel = LockModel.shared.currentType == "phone" ? LockModel.shared.phoneSelection : LockModel.shared.appSelection
                let count = sel.applicationTokens.count + sel.categoryTokens.count
                resolve(count)
            }
        }
        let hostingController = UIHostingController(rootView: pickerView)
        hostingController.modalPresentationStyle = .formSheet
        topController.present(hostingController, animated: true, completion: nil)
      }
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(startLock:lockType:name:packagesJson:preventAppRemoval:resolve:rejecter:)
  func startLock(_ duration: Double, lockType: String, name: String, packagesJson: String?, preventAppRemoval: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      LockModel.shared.startLock(duration: duration, type: lockType, name: name, preventRemoval: preventAppRemoval)
      resolve(true)
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(stopLock:rejecter:)
  func stopLock(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      LockModel.shared.stopLock(status: "중단")
      resolve(true)
    } else {
      reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
    }
  }

  @objc(openNotificationSettings:rejecter:)
  func openNotificationSettings(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if #available(iOS 16.0, *) {
        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
          UIApplication.shared.open(url, options: [:]) { success in
            resolve(success)
          }
          return
        }
      }
      
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

  @objc(scheduleAlarm:startTime:endTime:days:lockType:name:allowedPackage:preventAppRemoval:preLockMinutes:resolve:rejecter:)
  func scheduleAlarm(_ scheduleId: String, startTime: String, endTime: String, days: [String], lockType: String, name: String, allowedPackage: String?, preventAppRemoval: Bool, preLockMinutes: Double, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    
    let center = UNUserNotificationCenter.current()
    
    // First cancel any existing notifications for this schedule
    let baseId = "prelock_\(scheduleId)"
    let startBaseId = "start_\(scheduleId)"
    center.removePendingNotificationRequests(withIdentifiers: days.flatMap { ["\(baseId)_\($0)", "\(startBaseId)_\($0)"] })

    let timeParts = startTime.split(separator: ":")
    guard timeParts.count == 2,
          let hour = Int(timeParts[0]),
          let minute = Int(timeParts[1]) else {
      reject("INVALID_TIME", "Invalid start time format", nil)
      return
    }

    let dayMap: [String: Int] = [
        "일": 1, "월": 2, "화": 3, "수": 4, "목": 5, "금": 6, "토": 7
    ]

    for day in days {
        guard let weekday = dayMap[day] else { continue }
        
        var dateComponents = DateComponents()
        dateComponents.weekday = weekday
        dateComponents.hour = hour
        dateComponents.minute = minute
        dateComponents.second = 0
        
        let calendar = Calendar.current
        
        // 1. Schedule Actual Start Notification
        if let startDate = calendar.date(from: dateComponents) {
            let startComponents = calendar.dateComponents([.weekday, .hour, .minute, .second], from: startDate)
            let startContent = UNMutableNotificationContent()
            startContent.title = "예약 잠금 시작"
            startContent.body = "'\(name)' 예약 잠금 시간이 되었습니다. 앱을 열어 잠금을 활성화해주세요."
            startContent.sound = .default
            
            let startTrigger = UNCalendarNotificationTrigger(dateMatching: startComponents, repeats: true)
            let startRequest = UNNotificationRequest(identifier: "\(startBaseId)_\(day)", content: startContent, trigger: startTrigger)
            center.add(startRequest)
        }
        
        // 2. Schedule Pre-Lock Notification if needed
        if preLockMinutes > 0, let startDate = calendar.date(from: dateComponents),
           let triggerDate = calendar.date(byAdding: .minute, value: -Int(preLockMinutes), to: startDate) {
            
            let triggerComponents = calendar.dateComponents([.weekday, .hour, .minute, .second], from: triggerDate)
            let content = UNMutableNotificationContent()
            content.title = "잠금 시작 예고"
            content.body = "\(Int(preLockMinutes))분 뒤에 '\(name)'이 시작됩니다."
            content.sound = .default
            
            let trigger = UNCalendarNotificationTrigger(dateMatching: triggerComponents, repeats: true)
            let request = UNNotificationRequest(identifier: "\(baseId)_\(day)", content: content, trigger: trigger)
            center.add(request)
        }
    }
    
    resolve(true)
  }

  @objc(cancelAlarm:resolve:rejecter:)
  func cancelAlarm(_ scheduleId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let center = UNUserNotificationCenter.current()
    let baseId = "prelock_\(scheduleId)"
    
    // We don't know exactly which days were scheduled, so we might need a better way or just remove by prefix if possible?
    // Actually center doesn't support removal by prefix easily without fetching all pending.
    // However, since we use "prelock_{scheduleId}_{day}", we can just fetch all and filter.
    
    center.getPendingNotificationRequests { requests in
        let idsToRemove = requests.filter { $0.identifier.hasPrefix(baseId) }.map { $0.identifier }
        center.removePendingNotificationRequests(withIdentifiers: idsToRemove)
        resolve(true)
    }
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
    if #available(iOS 15.0, *) {
        resolve(LockModel.shared.getHistoryJson())
    } else {
        resolve("[]")
    }
  }
}
