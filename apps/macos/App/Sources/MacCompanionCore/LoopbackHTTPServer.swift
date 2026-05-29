import Foundation
import Network

public enum LoopbackHTTPServerError: Error, Equatable {
    case invalidBindAddress(String)
}

public final class LoopbackHTTPServer {
    private let bindHost: String
    private let codec: BridgeHTTPCodec
    private let port: NWEndpoint.Port
    private var listener: NWListener?

    public init(
        codec: BridgeHTTPCodec,
        port: UInt16 = 17666,
        bindHost: String = "127.0.0.1"
    ) {
        self.bindHost = bindHost
        self.codec = codec
        self.port = NWEndpoint.Port(rawValue: port) ?? 17666
    }

    public func start() throws {
        guard let bindAddress = IPv4Address(bindHost) else {
            throw LoopbackHTTPServerError.invalidBindAddress(bindHost)
        }

        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(
            host: .ipv4(bindAddress),
            port: port
        )

        let listener = try NWListener(using: parameters)
        listener.newConnectionHandler = { [codec] connection in
            connection.start(queue: .global(qos: .userInitiated))
            Self.receiveRequest(on: connection, codec: codec, buffer: Data())
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

    private static func receiveRequest(
        on connection: NWConnection,
        codec: BridgeHTTPCodec,
        buffer: Data
    ) {
        connection.receive(
            minimumIncompleteLength: 1,
            maximumLength: 65_536
        ) { data, _, isComplete, _ in
            var nextBuffer = buffer
            if let data {
                nextBuffer.append(data)
            }

            guard !nextBuffer.isEmpty else {
                connection.cancel()
                return
            }

            guard isComplete || isCompleteHTTPRequest(nextBuffer) else {
                receiveRequest(on: connection, codec: codec, buffer: nextBuffer)
                return
            }

            let request = String(data: nextBuffer, encoding: .utf8) ?? ""
            let response = Self.render(
                response: Self.route(request: request, codec: codec)
            )
            connection.send(content: response, completion: .contentProcessed { _ in
                connection.cancel()
            })
        }
    }

    private static func isCompleteHTTPRequest(_ data: Data) -> Bool {
        let separator = Data("\r\n\r\n".utf8)

        guard let headerRange = data.range(of: separator) else {
            return false
        }

        let headerText = String(
            data: data[..<headerRange.lowerBound],
            encoding: .utf8
        ) ?? ""
        let contentLength = headerText
            .components(separatedBy: "\r\n")
            .compactMap { line -> Int? in
                let parts = line.split(separator: ":", maxSplits: 1)
                guard parts.count == 2,
                      parts[0].trimmingCharacters(in: .whitespaces)
                          .lowercased() == "content-length"
                else {
                    return nil
                }

                return Int(parts[1].trimmingCharacters(in: .whitespaces))
            }
            .first ?? 0

        let bodyLength = data.count - headerRange.upperBound
        return bodyLength >= contentLength
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
