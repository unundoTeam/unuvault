import Foundation
import Network

public enum LoopbackHTTPServerError: Error, Equatable {
    case invalidLoopbackAddress
}

public final class LoopbackHTTPServer {
    private let codec: BridgeHTTPCodec
    private let port: NWEndpoint.Port
    private var listener: NWListener?

    public init(codec: BridgeHTTPCodec, port: UInt16 = 17666) {
        self.codec = codec
        self.port = NWEndpoint.Port(rawValue: port) ?? 17666
    }

    public func start() throws {
        guard let loopbackAddress = IPv4Address("127.0.0.1") else {
            throw LoopbackHTTPServerError.invalidLoopbackAddress
        }

        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(
            host: .ipv4(loopbackAddress),
            port: port
        )

        let listener = try NWListener(using: parameters, on: port)
        listener.newConnectionHandler = { [codec] connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(
                minimumIncompleteLength: 1,
                maximumLength: 65_536
            ) { data, _, _, _ in
                guard let data else {
                    connection.cancel()
                    return
                }

                let request = String(data: data, encoding: .utf8) ?? ""
                let response = Self.render(
                    response: Self.route(request: request, codec: codec)
                )
                connection.send(content: response, completion: .contentProcessed { _ in
                    connection.cancel()
                })
            }
        }
        listener.start(queue: .global(qos: .userInitiated))
        self.listener = listener
    }

    public func stop() {
        listener?.cancel()
        listener = nil
    }

    private static func route(request: String, codec: BridgeHTTPCodec) -> BridgeHTTPResponse {
        let headerAndBody = request.components(separatedBy: "\r\n\r\n")
        let headerText = headerAndBody.first ?? ""
        let bodyText = headerAndBody.dropFirst().joined(separator: "\r\n\r\n")
        let headerLines = headerText.components(separatedBy: "\r\n")
        let requestLine = headerLines.first?.split(separator: " ") ?? []
        let method = requestLine.first.map(String.init) ?? "GET"
        let path = requestLine.dropFirst().first.map(String.init) ?? "/"
        var headers: [String: String] = [:]

        for line in headerLines.dropFirst() {
            guard let range = line.range(of: ":") else {
                continue
            }

            let key = String(line[..<range.lowerBound]).lowercased()
            let value = String(line[range.upperBound...])
                .trimmingCharacters(in: .whitespaces)
            headers[key] = value
        }

        return codec.handle(
            method: method,
            path: path,
            headers: headers,
            body: Data(bodyText.utf8)
        )
    }

    private static func render(response: BridgeHTTPResponse) -> Data {
        let reason = reasonPhrase(for: response.statusCode)
        var lines = ["HTTP/1.1 \(response.statusCode) \(reason)"]

        for (key, value) in response.headers.sorted(by: { $0.key < $1.key }) {
            lines.append("\(key): \(value)")
        }

        lines.append("content-length: \(response.body.count)")
        lines.append("")
        lines.append("")

        var data = Data(lines.joined(separator: "\r\n").utf8)
        data.append(response.body)
        return data
    }

    private static func reasonPhrase(for statusCode: Int) -> String {
        switch statusCode {
        case 200:
            return "OK"
        case 204:
            return "No Content"
        case 400:
            return "Bad Request"
        case 401:
            return "Unauthorized"
        case 404:
            return "Not Found"
        case 409:
            return "Conflict"
        case 423:
            return "Locked"
        default:
            return "OK"
        }
    }
}
