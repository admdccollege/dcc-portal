// swift-tools-version:5.9
// Lets the platform-independent logic (portal address rules) be tested with
// `swift test` on macOS or Linux, without Xcode. The app itself is built from
// project.yml (XcodeGen) in Xcode.
import PackageDescription

let package = Package(
    name: "PortalCore",
    targets: [
        .target(name: "PortalCore", path: "DCCPortal/Core"),
        .testTarget(name: "PortalCoreTests", dependencies: ["PortalCore"], path: "DCCPortalTests"),
    ]
)
