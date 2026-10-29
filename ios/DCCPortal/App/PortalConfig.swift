import Foundation
import WebKit

/// Stores the portal origin chosen on first launch (or the build-time default).
enum PortalConfig {
    private static let key = "portal_url"

    static var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// The configured portal origin, or nil if the app has not been set up.
    static var origin: String? {
        if let saved = UserDefaults.standard.string(forKey: key) {
            let r = PortalURL.normalize(saved, allowPrivateHTTP: isDebugBuild)
            if let origin = r.origin { return origin }
        }
        return defaultOrigin
    }

    /// The address baked in at build time (PORTAL_URL build setting), if valid.
    static var defaultOrigin: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "DCCDefaultPortalURL") as? String,
              !value.isEmpty else { return nil }
        return PortalURL.normalize(value, allowPrivateHTTP: isDebugBuild).origin
    }

    static func save(_ origin: String) {
        UserDefaults.standard.set(origin, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// Removes cookies, storage and caches (used when switching to a different portal).
    static func clearWebsiteData(completion: @escaping () -> Void) {
        let store = WKWebsiteDataStore.default()
        store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast, completionHandler: completion)
    }
}
