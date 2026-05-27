// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "UnuVaultMacCompanion",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "MacCompanionCore", targets: ["MacCompanionCore"]),
        .executable(name: "UnuVaultMacCompanion", targets: ["UnuVaultMacCompanion"])
    ],
    targets: [
        .target(
            name: "MacCompanionCore",
            path: "Sources/MacCompanionCore"
        ),
        .executableTarget(
            name: "UnuVaultMacCompanion",
            dependencies: ["MacCompanionCore"],
            path: "Sources/UnuVaultMacCompanion"
        ),
        .testTarget(
            name: "MacCompanionCoreTests",
            dependencies: ["MacCompanionCore"],
            path: "Tests/MacCompanionCoreTests"
        )
    ]
)
