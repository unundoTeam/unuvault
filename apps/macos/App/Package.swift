// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "UnuVaultMacCompanion",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "MacCompanionCore", targets: ["MacCompanionCore"]),
        .executable(name: "UnuVaultMacCompanion", targets: ["UnuVaultMacCompanion"]),
        .executable(
            name: "MacCompanionSmokeHost",
            targets: ["MacCompanionSmokeHost"]
        )
    ],
    targets: [
        .target(
            name: "MacCompanionCore",
            path: "Sources/MacCompanionCore"
        ),
        .executableTarget(
            name: "UnuVaultMacCompanion",
            dependencies: ["MacCompanionCore"],
            path: "Sources/UnuVaultMacCompanion",
            resources: [
                .process("Resources")
            ]
        ),
        .executableTarget(
            name: "MacCompanionSmokeHost",
            dependencies: ["MacCompanionCore"],
            path: "Sources/MacCompanionSmokeHost"
        ),
        .testTarget(
            name: "MacCompanionCoreTests",
            dependencies: ["MacCompanionCore", "UnuVaultMacCompanion"],
            path: "Tests/MacCompanionCoreTests"
        )
    ]
)
