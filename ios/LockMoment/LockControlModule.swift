import Foundation

import FamilyControls
import SwiftUI
import UIKit
import React
import DeviceActivity
import ManagedSettings

extension DeviceActivityName {
    static func schedule(_ id: String) -> DeviceActivityName {
        return DeviceActivityName("com.lockmoment.schedule.\(id)")
    }
}

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
      LockModel.shared.startLock(duration: duration, lockType: lockType, name: name, preventRemoval: preventAppRemoval)
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
      
      if #available(iOS 15.0, *) {
          let center = DeviceActivityCenter()
          let notificationCenter = UNUserNotificationCenter.current()
          
          let activityName = DeviceActivityName.schedule(scheduleId)
          
          // 1. Clean up existing (including weekday variants)
          let allPossibleActivities = [activityName] + (1...7).map { DeviceActivityName.schedule("\(scheduleId)_\($0)") }
          center.stopMonitoring(allPossibleActivities)
          
          let baseId = "prelock_\(scheduleId)"
          let startBaseId = "start_\(scheduleId)"
          // Remove old notifications (best effort)
          notificationCenter.getPendingNotificationRequests { requests in
              let ids = requests.filter { $0.identifier.contains(scheduleId) }.map { $0.identifier }
              notificationCenter.removePendingNotificationRequests(withIdentifiers: ids)
          }

          let timeParts = startTime.split(separator: ":")
          let endParts = endTime.split(separator: ":")
          
          guard timeParts.count == 2, endParts.count == 2,
                let startHour = Int(timeParts[0]), let startMinute = Int(timeParts[1]),
                let endHour = Int(endParts[0]), let endMinute = Int(endParts[1]) else {
            reject("INVALID_TIME", "Invalid time format", nil)
            return
          }

          let dayMap: [String: Int] = [
              "일": 1, "월": 2, "화": 3, "수": 4, "목": 5, "금": 6, "토": 7
          ]

          // Prepare DeviceActivitySchedule
          // DeviceActivitySchedule takes a single interval. If days differ, we might need multiple activities?
          // Actually DeviceActivitySchedule has `intervalStart` and `intervalEnd` which are DateComponents.
          // It repeats. But if we select specific days (Monday, Wednesday), we cannot express that in ONE DeviceActivitySchedule easily if simpler inputs.
          // DeviceActivitySchedule documentation says it repeats.
          // If we want Mon, Wed: we need separate schedules?
          
          // Strategy: Create one activity per day-schedule pair?
          // E.g. "schedule_ID_Mon", "schedule_ID_Wed".
          
          for day in days {
              guard let weekday = dayMap[day] else { continue }
              
              let specificActivityName = DeviceActivityName.schedule("\(scheduleId)_\(weekday)")
              
              let isOvernight = (startHour * 60 + startMinute) > (endHour * 60 + endMinute)
              let endWeekday = isOvernight ? (weekday % 7) + 1 : weekday
              
              let startComponents = DateComponents(hour: startHour, minute: startMinute, weekday: weekday)
              let endComponents = DateComponents(hour: endHour, minute: endMinute, weekday: endWeekday)
              
              let schedule = DeviceActivitySchedule(
                  intervalStart: startComponents,
                  intervalEnd: endComponents,
                  repeats: true,
                  warningTime: DateComponents(minute: Int(preLockMinutes))
              )
              
              do {
                  try center.startMonitoring(specificActivityName, during: schedule)
              } catch {
                  print("Failed to start monitoring for \(day): \(error)")
              }
              
              // Also schedule local notification as fallback/alert
              let content = UNMutableNotificationContent()
              content.title = "예약 잠금 시작"
              content.body = "'\(name)' 예약 잠금 시간이 되었습니다."
              content.sound = .default
              
              var notifComponents = DateComponents()
              notifComponents.weekday = weekday
              notifComponents.hour = startHour
              notifComponents.minute = startMinute
              notifComponents.second = 0
              
              let trigger = UNCalendarNotificationTrigger(dateMatching: notifComponents, repeats: true)
              let request = UNNotificationRequest(identifier: "\(startBaseId)_\(day)", content: content, trigger: trigger)
              notificationCenter.add(request)

              // Save policy per weekday activity to shared defaults
              let defaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
              
              let sel = lockType.uppercased() == "APP" ? LockModel.shared.appSelection : LockModel.shared.phoneSelection
              // Use PropertyListEncoder for native Apple types like FamilyActivitySelection
              let encodedSelection = try? PropertyListEncoder().encode(sel)

              let policy: [String: Any] = [
                  "lockType": lockType,
                  "preventAppRemoval": preventAppRemoval,
                  "name": name,
                  "selection": encodedSelection as Any,
                  "startHour": startHour,
                  "startMinute": startMinute,
                  "endHour": endHour,
                  "endMinute": endMinute
              ]
              
              defaults.set(policy, forKey: "policy_\(scheduleId)_\(weekday)")
          }
          
          resolve(true)
      } else {
          reject("OS_VERSION_ERROR", "Requires iOS 15.0+", nil)
      }
    }

  @objc(cancelAlarm:resolve:rejecter:)
  func cancelAlarm(_ scheduleId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
      if #available(iOS 15.0, *) {
          let center = DeviceActivityCenter()
          let notificationCenter = UNUserNotificationCenter.current()
          
          // Clear all potential activities for this schedule
          let days = [1,2,3,4,5,6,7]
          let baseActivity = DeviceActivityName.schedule(scheduleId)
          let activityNames = [baseActivity] + days.map { DeviceActivityName.schedule("\(scheduleId)_\($0)") }
          center.stopMonitoring(activityNames)
          
          // Remove notifications
          notificationCenter.getPendingNotificationRequests { requests in
              let ids = requests.filter { $0.identifier.contains(scheduleId) }.map { $0.identifier }
              notificationCenter.removePendingNotificationRequests(withIdentifiers: ids)
          }
          
          // Remove policy for all weekdays
          let defaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
          for weekday in 1...7 {
              defaults.removeObject(forKey: "policy_\(scheduleId)_\(weekday)")
          }
          
          resolve(true)
      } else {
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

  @objc(setPreventAppRemoval:resolve:rejecter:)
  func setPreventAppRemoval(_ enabled: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 16.0, *) {
      DispatchQueue.main.async {
        LockModel.shared.store.application.denyAppRemoval = enabled
        UserDefaults.standard.set(enabled, forKey: "preventAppRemovalSetting")
        resolve(true)
      }
    } else {
      resolve(false)
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
