import UIKit
import React
import React_RCTAppDelegate

@main
class AppDelegate: RCTAppDelegate {

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.moduleName = "LingjianAI"
    self.initialProps = [:]

    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    AssetServerBridge.startServer()

    return result
  }

  override func sourceURL(for bridge: RCTBridge) -> URL {
    self.bundleURL()
  }

  override func bundleURL() -> URL {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")!
    #endif
  }

  override func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    IncomingShareBridge.handleURL(url)
    return true
  }
}
