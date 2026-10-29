import XCTest
#if canImport(PortalCore)
@testable import PortalCore
#else
@testable import DCCPortal
#endif

final class PortalURLTests: XCTestCase {
    private let portal = "https://portal.example.edu.in"

    func testAcceptsAndNormalisesToOrigin() {
        let cases: [(String, Bool, String)] = [
            ("https://portal.example.edu.in", false, portal),
            ("portal.example.edu.in", false, portal),
            ("  HTTPS://Portal.Example.edu.in/dashboard?x=1#top ", false, portal),
            ("https://portal.example.edu.in:443/", false, portal),
            ("https://portal.example.edu.in:8443", false, "https://portal.example.edu.in:8443"),
            ("http://10.0.2.2:3000", true, "http://10.0.2.2:3000"),
            ("http://192.168.1.20:3000/login", true, "http://192.168.1.20:3000"),
            ("http://172.20.0.5", true, "http://172.20.0.5"),
            ("http://localhost:3000", true, "http://localhost:3000"),
            ("http://dev-mac.local:3000", true, "http://dev-mac.local:3000"),
        ]
        for (input, debug, expected) in cases {
            let r = PortalURL.normalize(input, allowPrivateHTTP: debug)
            XCTAssertEqual(r.origin, expected, "input: \(input), error: \(r.error ?? "-")")
            XCTAssertNil(r.error)
        }
    }

    func testRejectsUnsafeOrInvalidAddresses() {
        let cases: [(String, Bool)] = [
            ("", false),
            ("   ", false),
            ("http://portal.example.edu.in", false),   // plain HTTP in release
            ("http://portal.example.edu.in", true),    // plain HTTP to a public host, even in debug
            ("http://10.0.2.2:3000", false),           // private HTTP not allowed in release
            ("http://172.32.0.1", true),               // outside 172.16/12
            ("http://10.0.0.1.example.com", true),     // looks like an IP, isn't
            ("ftp://portal.example.edu.in", false),
            ("javascript:alert(1)", false),
            ("file:///var/mobile/x.html", false),
            ("https://user:pass@portal.example.edu.in", false),
            ("https://", false),
            ("https://exa mple.com", false),
            ("https://.example.com", false),
        ]
        for (input, debug) in cases {
            let r = PortalURL.normalize(input, allowPrivateHTTP: debug)
            XCTAssertNil(r.origin, "should reject: \(input)")
            XCTAssertNotNil(r.error, "missing error for: \(input)")
        }
    }

    func testSameOrigin() {
        XCTAssertTrue(PortalURL.isSameOrigin(URL(string: "https://portal.example.edu.in/api/pdf/receipt/1"), portal))
        XCTAssertTrue(PortalURL.isSameOrigin(URL(string: "https://PORTAL.example.edu.in:443/x"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "http://portal.example.edu.in/x"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "https://portal.example.edu.in.evil.example/x"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "https://evil.example/?u=https://portal.example.edu.in"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "https://portal.example.edu.in:8443/"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "data:text/csv,a,b"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(URL(string: "about:blank"), portal))
        XCTAssertFalse(PortalURL.isSameOrigin(nil, portal))
    }
}
