import Foundation
import React

@objc(AssetServerModule)
class AssetServerModule: RCTEventEmitter {

  private static var webServerPort: UInt = 0

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return []
  }

  @objc(start:withRejecter:)
  func start(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    if AssetServerModule.webServerPort > 0 {
      resolve("http://localhost:\(AssetServerModule.webServerPort)")
      return
    }

    guard let resourcePath = Bundle.main.resourcePath else {
      reject("ERR_NO_PATH", "Cannot find resource path", nil)
      return
    }

    let port = AssetServerBridge.startServer(withResourcePath: resourcePath)
    if port > 0 {
      AssetServerModule.webServerPort = port
      resolve("http://localhost:\(port)")
    } else {
      reject("ERR_SERVER", "Failed to start server", nil)
    }
  }

  @objc(stop:withRejecter:)
  func stop(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    AssetServerBridge.stopServer()
    AssetServerModule.webServerPort = 0
    resolve(NSNull())
  }

  @objc(addListener:)
  override func addListener(_ eventName: String!) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Double) {
    super.removeListeners(count)
  }
}
