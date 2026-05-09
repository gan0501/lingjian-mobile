import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {

    let delegate = ReactNativeDelegate()
    delegate.setup()
    self.reactNativeDelegate = delegate

    self.window = UIWindow(frame: UIScreen.main.bounds)
    self.window?.rootViewController = delegate.rootViewController
    self.window?.makeKeyAndVisible()

    AssetServerBridge.startServer()

    return true
  }

  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    IncomingShareBridge.handleURL(url)
    return true
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {

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

  override func customRCTBridgeDelegate() -> RCTBridgeDelegate? {
    return self
  }
}
