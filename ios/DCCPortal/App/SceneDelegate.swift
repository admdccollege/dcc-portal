import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    static let changeAddressShortcut = "com.damdeichristiancollege.portal.change-address"

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        self.window = window
        if connectionOptions.shortcutItem?.type == Self.changeAddressShortcut {
            showSetup()
        } else {
            showStart()
        }
        window.makeKeyAndVisible()
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        guard shortcutItem.type == Self.changeAddressShortcut else { return completionHandler(false) }
        showSetup()
        completionHandler(true)
    }

    func showStart() {
        if let origin = PortalConfig.origin {
            showPortal(origin: origin)
        } else {
            showSetup()
        }
    }

    func showPortal(origin: String) {
        window?.rootViewController = PortalViewController(origin: origin) { [weak self] in
            self?.showSetup()
        }
    }

    func showSetup() {
        let previous = PortalConfig.origin
        let setup = SetupViewController(currentOrigin: previous) { [weak self] newOrigin in
            guard let self = self else { return }
            guard let newOrigin = newOrigin else {
                // Cancelled: return to the existing portal, if any.
                self.showStart()
                return
            }
            if let previous = previous, previous != newOrigin {
                // A different portal: drop the old session and cached data first.
                PortalConfig.clearWebsiteData { self.showPortal(origin: newOrigin) }
            } else {
                self.showPortal(origin: newOrigin)
            }
        }
        window?.rootViewController = setup
    }
}
