// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "App",
    platforms: [
        .iOS(.v18)
    ],
    products: [
        .library(name: "App", targets: ["App"])
    ],
    targets: [
        .target(
            name: "App",
            path: "Sources"
        ),
        .testTarget(
            name: "AppTests",
            dependencies: ["App"],
            path: "Tests"
        )
    ]
)
