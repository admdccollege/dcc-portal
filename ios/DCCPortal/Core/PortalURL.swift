import Foundation

/// Validation and same-origin checks for the portal address.
/// Foundation only, so it is unit-tested on macOS, iOS and Linux.
enum PortalURL {
    struct Result: Equatable {
        let origin: String?
        let error: String?
        var ok: Bool { origin != nil }
    }

    private static let invalid = Result(origin: nil, error: "That doesn't look like a web address.")

    /// Turns user input into a portal origin such as `https://portal.example.edu.in`.
    /// HTTPS is required; plain HTTP is accepted only when `allowPrivateHTTP` is set
    /// (debug builds) and the host is a private/local network address.
    static func normalize(_ input: String, allowPrivateHTTP: Bool) -> Result {
        var s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return Result(origin: nil, error: "Enter the portal address.") }
        if !s.contains("://") { s = "https://" + s }

        guard let c = URLComponents(string: s), let rawHost = c.host, !rawHost.isEmpty,
              !rawHost.hasPrefix("."), !rawHost.hasSuffix(".") else { return invalid }
        if c.user != nil || c.password != nil {
            return Result(origin: nil, error: "Remove the user name from the address.")
        }
        let scheme = (c.scheme ?? "").lowercased()
        let host = rawHost.lowercased()
        switch scheme {
        case "https":
            break
        case "http":
            if !allowPrivateHTTP || !isPrivateHost(host) {
                return Result(origin: nil, error: "The address must start with https:// for a secure connection.")
            }
        default:
            return Result(origin: nil, error: "The address must start with https://")
        }
        return Result(origin: makeOrigin(scheme: scheme, host: host, port: c.port), error: nil)
    }

    /// The origin (scheme://host[:port]) of a URL, or nil if it has none.
    static func origin(of url: URL?) -> String? {
        guard let url = url,
              let c = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = c.scheme?.lowercased(), let host = c.host?.lowercased(), !host.isEmpty
        else { return nil }
        return makeOrigin(scheme: scheme, host: host, port: c.port)
    }

    static func isSameOrigin(_ url: URL?, _ portalOrigin: String) -> Bool {
        guard let origin = origin(of: url) else { return false }
        return origin == portalOrigin
    }

    private static func makeOrigin(scheme: String, host: String, port: Int?) -> String {
        let isDefaultPort = port == nil || (scheme == "https" && port == 443) || (scheme == "http" && port == 80)
        let hostPart = host.contains(":") && !host.hasPrefix("[") ? "[\(host)]" : host
        return "\(scheme)://\(hostPart)" + (isDefaultPort ? "" : ":\(port!)")
    }

    static func isPrivateHost(_ host: String) -> Bool {
        if host == "localhost" || host.hasSuffix(".local") { return true }
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4 else { return false }
        var o: [Int] = []
        for p in parts {
            guard let n = Int(p), (0...255).contains(n), p.allSatisfy({ $0.isASCII && $0.isNumber }) else { return false }
            o.append(n)
        }
        return o[0] == 10
            || o[0] == 127
            || (o[0] == 192 && o[1] == 168)
            || (o[0] == 172 && (16...31).contains(o[1]))
    }
}
