import Foundation
import GCDWebServer

@objc(AssetServerModule)
class AssetServerModule: RCTEventEmitter {

  private static var webServer: GCDWebServer?

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return []
  }

  @objc(start:withRejecter:)
  func start(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    if AssetServerModule.webServer != nil {
      resolve("http://localhost:\(AssetServerModule.webServer!.port)")
      return
    }

    guard let resourcePath = Bundle.main.resourcePath else {
      reject("ERR_NO_PATH", "Cannot find resource path", nil)
      return
    }

    let server = GCDWebServer()

    server.addGETHandler(
      forBasePath: "/",
      directoryPath: resourcePath,
      indexFilename: nil,
      cacheAge: 0,
      allowRangeRequests: true
    )

    do {
      try server.start(options: [
        GCDWebServerOption_Port: 38080,
        GCDWebServerOption_BindToLocalhost: true
      ])
      AssetServerModule.webServer = server
      resolve("http://localhost:\(server.port)")
    } catch {
      reject("ERR_SERVER", error.localizedDescription, nil)
    }
  }

  @objc(stop:withRejecter:)
  func stop(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    AssetServerModule.webServer?.stop()
    AssetServerModule.webServer = nil
    resolve(nil)
  }

  @objc(addListener:)
  override func addListener(_ eventName: String!) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Int) {
    super.removeListeners(count)
  }
}

@objc(AssetServerBridge)
class AssetServerBridge: NSObject {
  @objc static func startServer() {
    let module = AssetServerModule()
    module.start({ _ in }, reject: { _, _, _ in })
  }
}
