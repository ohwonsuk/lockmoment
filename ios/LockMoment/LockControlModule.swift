import Foundation

import FamilyControls
import SwiftUI
import UIKit
import React
import DeviceActivity
import ManagedSettings

extension DeviceActivityName {
    static func schedule(_ id: String) -> DeviceActivityName {
        // 64자 제한을 위해 접두사를 최대한 짧게 유지 (lms = LockMoment Schedule)
        return DeviceActivityName("lms.\(id)")
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
      // CRITICAL: Check authorization FIRST before attempting to present picker
      let authStatus = AuthorizationCenter.shared.authorizationStatus
      
      if authStatus != .approved {
        // Authorization not granted - reject immediately
        reject("AUTH_REQUIRED", "Screen Time authorization is required. Please grant permission in Settings.", nil)
        return
      }
      
      DispatchQueue.main.async {
        let type = lockType ?? "app"
        LockModel.shared.currentType = type
        
        // Find the key window and root view controller in a standard way
        var keyWindow: UIWindow?
        if #available(iOS 13.0, *) {
            keyWindow = UIApplication.shared.connectedScenes
                .filter({ $0.activationState == .foregroundActive })
                .map({ $0 as? UIWindowScene })
                .compactMap({ $0 })
                .first?.windows
                .filter({ $0.isKeyWindow }).first
        }
        
        if keyWindow == nil {
            keyWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow })
        }

        guard let rootViewController = keyWindow?.rootViewController else {
          reject("UI_ERROR", "Could not find root view controller", nil)
          return
        }
        
        var topController = rootViewController
        while let presented = topController.presentedViewController {
             if presented.isBeingDismissed { break }
             topController = presented
        }
        
        // Get current selection based on type
        let currentSelection = LockModel.shared.currentType == "phone" 
            ? LockModel.shared.phoneSelection 
            : LockModel.shared.appSelection
        
        let pickerView = PickerView(initialSelection: currentSelection) { newSelection in
             // Save the new selection back to the appropriate property
             if LockModel.shared.currentType == "phone" {
                 LockModel.shared.phoneSelection = newSelection
             } else {
                 LockModel.shared.appSelection = newSelection
             }
             
             topController.dismiss(animated: true) {
                 let count = newSelection.applicationTokens.count + newSelection.categoryTokens.count
                 resolve(count)
             }
        }
        
        let hostingController = UIHostingController(rootView: pickerView)
        hostingController.modalPresentationStyle = .formSheet
        topController.present(hostingController, animated: true, completion: nil)
      }
    }
 else {
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
      let sel = LockModel.shared.appSelection
      resolve(sel.applicationTokens.count)
    } else {
      resolve(0)
    }
  }

  @objc(getSelectedCategoryCount:rejecter:)
  func getSelectedCategoryCount(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      let sel = LockModel.shared.appSelection
      resolve(sel.categoryTokens.count)
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
        
        // Priority 1: Manual/Timed Lock
        if let endTime = LockModel.shared.endTime {
            let remaining = endTime.timeIntervalSince(Date()) * 1000
            resolve(max(0, remaining))
            return
        }
        
        // Priority 2: Scheduled Lock
        if let scheduledEnd = LockModel.shared.scheduledEndTime {
            let remaining = scheduledEnd.timeIntervalSince(Date()) * 1000
            resolve(max(0, remaining))
            return
        }
        
        resolve(0)
    } else {
        resolve(0)
    }
  }

  @objc(restoreLockState:rejecter:)
  func restoreLockState(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
        _ = LockModel.shared.checkExpiration()
    }
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
              "일": 1, "월": 2, "화": 3, "수": 4, "목": 5, "금": 6, "토": 7,
              "Sun": 1, "Mon": 2, "Tue": 3, "Wed": 4, "Thu": 5, "Fri": 6, "Sat": 7,
              "Sunday": 1, "Monday": 2, "Tuesday": 3, "Wednesday": 4, "Thursday": 5, "Friday": 6, "Saturday": 7
          ]

          var isCurrentlyInRange = false

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
                  warningTime: preLockMinutes > 0 ? DateComponents(minute: Int(preLockMinutes)) : nil
              )
              
              // 현재 시간이 이미 예약 범위 내인지 확인 (즉시 적용을 위함)
              let now = Date()
              let calendar = Calendar.current
              let currentWeekday = calendar.component(.weekday, from: now)
              let currentTotal = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
              let startTotal = startHour * 60 + startMinute
              let endTotal = endHour * 60 + endMinute
              
              if currentWeekday == weekday {
                  if isOvernight {
                      if currentTotal >= startTotal { isCurrentlyInRange = true }
                  } else {
                      if currentTotal >= startTotal && currentTotal < endTotal { isCurrentlyInRange = true }
                  }
              } else if isOvernight && currentWeekday == endWeekday {
                  if currentTotal < endTotal { isCurrentlyInRange = true }
              }

              do {
                  try center.startMonitoring(specificActivityName, during: schedule)
              } catch {
                  print("[LockControl] Failed to start monitoring: \(error)")
              }
              
              // (알림 및 공유 데이터 저장 로직은 이전과 동일...)
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
              let request = UNNotificationRequest(identifier: "start_\(scheduleId)_\(weekday)", content: content, trigger: trigger)
              notificationCenter.add(request)

              let defaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
              var normalizedType = (lockType == "APP_ONLY" || lockType.uppercased() == "APP") ? "APP" : "FULL"
              let sel = normalizedType == "APP" ? LockModel.shared.appSelection : LockModel.shared.phoneSelection
              
              let hasAppSelection = !sel.applicationTokens.isEmpty || !sel.categoryTokens.isEmpty
              if normalizedType == "APP" && !hasAppSelection {
                  normalizedType = "FULL"
              }
              
              let encodedSelection: Data? = normalizedType == "APP" ? (try? PropertyListEncoder().encode(sel)) : nil
              if normalizedType == "APP", let selData = encodedSelection {
                  defaults.set(selData, forKey: "selection_\(scheduleId)")
              }
              
              var policy: [String: Any] = [
                  "lockType": normalizedType,
                  "preventAppRemoval": preventAppRemoval,
                  "name": name,
                  "startHour": startHour,
                  "startMinute": startMinute,
                  "endHour": endHour,
                  "endMinute": endMinute
              ]
              if let selData = encodedSelection { policy["selection"] = selData }
              
              defaults.set(policy, forKey: "policy_\(scheduleId)_\(weekday)")
              defaults.synchronize()
          }
          
          // 현재 시간이 범위 내라면 즉시 잠금 실행 (Extension을 기다리지 않음)
          if isCurrentlyInRange {
              print("[LockControl] Currently in range, applying lock immediately.")
              LockModel.shared.checkScheduledLocks(apply: true)
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
          // Schedule별 selection 데이터도 삭제
          defaults.removeObject(forKey: "selection_\(scheduleId)")
          defaults.synchronize()
          
          resolve(true)
      } else {
          resolve(true)
      }
  }

  @objc(stopActiveSchedules:rejecter:)
  func stopActiveSchedules(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
        let defaults = UserDefaults(suiteName: "group.com.lockmoment") ?? UserDefaults.standard
        let now = Date()
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: now)
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        let totalMinutes = hour * 60 + minute
        
        let allKeys = defaults.dictionaryRepresentation().keys
        var stoppedIds: [String] = []
        let center = DeviceActivityCenter()
        
        for key in allKeys where key.hasPrefix("policy_") {
            if let policy = defaults.dictionary(forKey: key),
               let startH = policy["startHour"] as? Int,
               let startM = policy["startMinute"] as? Int,
               let endH = policy["endHour"] as? Int,
               let endM = policy["endMinute"] as? Int {
                
                let startTotal = startH * 60 + startM
                let endTotal = endH * 60 + endM
                
                let inRange = (startTotal <= endTotal) ? 
                    (totalMinutes >= startTotal && totalMinutes < endTotal) :
                    (totalMinutes >= startTotal || totalMinutes < endTotal)
                
                if inRange {
                    // key = "policy_{scheduleId}_{weekday}"
                    // scheduleId 추출: "policy_" 접두사 제거 후 마지막 "_weekday" 제거
                    let withoutPrefix = key.replacingOccurrences(of: "policy_", with: "")
                    let parts = withoutPrefix.split(separator: "_")
                    // 마지막 부분(weekday)을 제외한 나머지가 scheduleId
                    let scheduleId = parts.dropLast().joined(separator: "_")
                    
                    if !scheduleId.isEmpty && !stoppedIds.contains(scheduleId) {
                        stoppedIds.append(scheduleId)
                        
                        // Stop monitoring and remove policy
                        let days = [1,2,3,4,5,6,7]
                        let activityNames = [DeviceActivityName.schedule(scheduleId)] + days.map { DeviceActivityName.schedule("\(scheduleId)_\($0)") }
                        center.stopMonitoring(activityNames)
                        
                        for w in 1...7 {
                            defaults.removeObject(forKey: "policy_\(scheduleId)_\(w)")
                        }
                        // Schedule별 selection 데이터도 삭제
                        defaults.removeObject(forKey: "selection_\(scheduleId)")
                    }
                }
            }
        }
        
        LockModel.shared.stopLock(status: "중단")
        resolve(stoppedIds)
    } else {
        resolve([])
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
