import Foundation
import UIKit
import React

@objc(IncomingShareModule)
class IncomingShareModule: RCTEventEmitter {

  fileprivate static var pendingFiles: [[String: String]] = []
  fileprivate static var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["IncomingShareFiles"]
  }

  override func startObserving() {
    IncomingShareModule.hasListeners = true
    super.startObserving()

    if !IncomingShareModule.pendingFiles.isEmpty {
      sendPendingFiles()
    }
  }

  override func stopObserving() {
    IncomingShareModule.hasListeners = false
    super.stopObserving()
  }

  @objc(getInitialSharedFiles:withRejecter:)
  func getInitialSharedFiles(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    resolve(IncomingShareModule.pendingFiles)
    IncomingShareModule.pendingFiles = []
  }

  @objc(addListener:)
  override func addListener(_ eventName: String!) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Double) {
    super.removeListeners(count)
  }

  private func sendPendingFiles() {
    let files = IncomingShareModule.pendingFiles
    IncomingShareModule.pendingFiles = []

    guard !files.isEmpty else { return }

    if self.bridge != nil {
      let params: [[String: String]] = files.map { file in
        return [
          "uri": file["uri"] ?? "",
          "name": file["name"] ?? "file",
          "mimeType": file["mimeType"] ?? "application/octet-stream"
        ]
      }
      self.sendEvent(withName: "IncomingShareFiles", body: params)
    }
  }
}

@objc(IncomingShareBridge)
class IncomingShareBridge: NSObject {
  @objc static func handleURL(_ url: URL) {
    let fileName = url.lastPathComponent
    let mimeType = mimeTypeForPath(path: fileName)

    let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("incoming_share")
    try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

    let destURL = tempDir.appendingPathComponent("\(Int(Date().timeIntervalSince1970))_\(fileName)")

    do {
      let data = try Data(contentsOf: url)
      try data.write(to: destURL)

      let fileInfo: [String: String] = [
        "uri": destURL.absoluteString,
        "name": fileName,
        "mimeType": mimeType
      ]

      IncomingShareModule.pendingFiles.append(fileInfo)

      if IncomingShareModule.hasListeners {
        DispatchQueue.main.async {
          NotificationCenter.default.post(name: NSNotification.Name("IncomingShareFilesReceived"), object: nil)
        }
      }
    } catch {
      print("[IncomingShare] Failed to copy shared file: \(error)")
    }
  }

  private static func mimeTypeForPath(path: String) -> String {
    let ext = (path as NSString).pathExtension.lowercased()
    let mimeTypes: [String: String] = [
      "pdf": "application/pdf",
      "doc": "application/msword",
      "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "xls": "application/vnd.ms-excel",
      "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "gif": "image/gif",
      "txt": "text/plain",
      "dwg": "application/dwg",
    ]
    return mimeTypes[ext] ?? "application/octet-stream"
  }
}
