import ExpoModulesCore
import Foundation

public class CronetDownloadModule: Module {
  private static let chunkSize = 1 * 1024 * 1024 // 1 MB
  private static let userAgent =
    "Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"

  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.default
    config.httpAdditionalHeaders = ["User-Agent": Self.userAgent]
    config.timeoutIntervalForResource = 300
    return URLSession(configuration: config)
  }()

  public func definition() -> ModuleDefinition {
    Name("CronetDownload")

    Events("onDownloadProgress")

    AsyncFunction("download") { (url: String, destPath: String, totalSize: Double, downloadId: String, promise: Promise) in
      guard let downloadUrl = URL(string: url) else {
        promise.reject("INVALID_URL", "Invalid URL: \(url)")
        return
      }

      let total = Int64(totalSize)

      if total > 0 {
        self.downloadChunked(url: downloadUrl, destPath: destPath, totalSize: total, downloadId: downloadId, promise: promise)
      } else {
        self.downloadSingle(url: downloadUrl, destPath: destPath, downloadId: downloadId, promise: promise)
      }
    }
  }

  // MARK: - Chunked range-request download

  private func downloadChunked(url: URL, destPath: String, totalSize: Int64, downloadId: String, promise: Promise) {
    let fileUrl = URL(fileURLWithPath: destPath)
    let dir = fileUrl.deletingLastPathComponent()

    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      // Pre-allocate file
      FileManager.default.createFile(atPath: destPath, contents: nil)
      let handle = try FileHandle(forWritingTo: fileUrl)
      try handle.truncate(atOffset: UInt64(totalSize))
      handle.closeFile()
    } catch {
      promise.reject("FILE_ERROR", "Failed to create file: \(error.localizedDescription)")
      return
    }

    downloadNextChunk(url: url, destPath: destPath, totalSize: totalSize, offset: 0, downloadId: downloadId, promise: promise)
  }

  private func downloadNextChunk(url: URL, destPath: String, totalSize: Int64, offset: Int64, downloadId: String, promise: Promise) {
    if offset >= totalSize {
      promise.resolve([
        "bytesWritten": totalSize,
        "path": destPath,
      ])
      return
    }

    let end = min(offset + Int64(Self.chunkSize) - 1, totalSize - 1)
    var request = URLRequest(url: url)
    request.addValue("bytes=\(offset)-\(end)", forHTTPHeaderField: "Range")
    request.addValue(Self.userAgent, forHTTPHeaderField: "User-Agent")

    let task = session.dataTask(with: request) { [weak self] data, response, error in
      guard let self = self else { return }

      if let error = error {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("DOWNLOAD_FAILED", error.localizedDescription)
        return
      }

      guard let httpResponse = response as? HTTPURLResponse else {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("DOWNLOAD_FAILED", "No HTTP response")
        return
      }

      let statusCode = httpResponse.statusCode
      guard statusCode == 206 || statusCode == 200 else {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("HTTP_ERROR", "HTTP \(statusCode) from YouTube CDN")
        return
      }

      guard let data = data else {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("DOWNLOAD_FAILED", "No data received")
        return
      }

      // Write chunk at correct offset
      do {
        let fileHandle = try FileHandle(forWritingTo: URL(fileURLWithPath: destPath))
        try fileHandle.seek(toOffset: UInt64(offset))
        fileHandle.write(data)
        fileHandle.closeFile()
      } catch {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("FILE_ERROR", "Failed to write chunk: \(error.localizedDescription)")
        return
      }

      let nextOffset = offset + Int64(data.count)
      let progress = Double(nextOffset) / Double(totalSize)

      self.sendEvent("onDownloadProgress", [
        "downloadId": downloadId,
        "progress": progress,
      ])

      self.downloadNextChunk(url: url, destPath: destPath, totalSize: totalSize, offset: nextOffset, downloadId: downloadId, promise: promise)
    }

    task.resume()
  }

  // MARK: - Single-request fallback

  private func downloadSingle(url: URL, destPath: String, downloadId: String, promise: Promise) {
    let fileUrl = URL(fileURLWithPath: destPath)
    let dir = fileUrl.deletingLastPathComponent()

    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    } catch {
      promise.reject("FILE_ERROR", "Failed to create directory: \(error.localizedDescription)")
      return
    }

    var request = URLRequest(url: url)
    request.addValue(Self.userAgent, forHTTPHeaderField: "User-Agent")

    let task = session.dataTask(with: request) { data, response, error in
      if let error = error {
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("DOWNLOAD_FAILED", error.localizedDescription)
        return
      }

      guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        try? FileManager.default.removeItem(atPath: destPath)
        promise.reject("HTTP_ERROR", "HTTP \(code) from YouTube CDN")
        return
      }

      guard let data = data else {
        promise.reject("DOWNLOAD_FAILED", "No data received")
        return
      }

      do {
        try data.write(to: fileUrl)
        promise.resolve([
          "bytesWritten": data.count,
          "path": destPath,
        ])
      } catch {
        promise.reject("FILE_ERROR", "Failed to write file: \(error.localizedDescription)")
      }
    }

    task.resume()
  }
}
