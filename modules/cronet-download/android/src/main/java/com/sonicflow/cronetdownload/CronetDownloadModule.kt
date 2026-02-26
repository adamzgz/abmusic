package com.sonicflow.cronetdownload

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.chromium.net.CronetEngine
import org.chromium.net.UrlRequest
import org.chromium.net.UrlResponseInfo
import org.chromium.net.CronetException
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import android.os.Bundle

class CronetDownloadModule : Module() {
    private val executor = Executors.newCachedThreadPool()

    @Volatile
    private var cronetEngine: CronetEngine? = null

    private fun getEngine(): CronetEngine {
        cronetEngine?.let { return it }
        synchronized(this) {
            cronetEngine?.let { return it }
            val ctx = appContext.reactContext?.applicationContext
                ?: throw Exception("No application context")
            val engine = CronetEngine.Builder(ctx)
                .enableHttp2(true)
                .enableQuic(true)
                .build()
            cronetEngine = engine
            return engine
        }
    }

    companion object {
        private const val CHUNK_SIZE = 1L * 1024 * 1024 // 1 MB
        private const val USER_AGENT =
            "Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
    }

    override fun definition() = ModuleDefinition {
        Name("CronetDownload")

        Events("onDownloadProgress")

        // Chunked range-request download.
        // totalSize: pass contentLength from InnerTube (0 = unknown → single request fallback).
        // downloadId: opaque ID forwarded in progress events so JS can match them.
        AsyncFunction("download") { url: String, destPath: String, totalSize: Double, downloadId: String, promise: Promise ->
            try {
                val engine = getEngine()
                val total = totalSize.toLong()

                if (total > 0) {
                    downloadChunked(engine, url, destPath, total, downloadId, promise)
                } else {
                    downloadSingle(engine, url, destPath, downloadId, promise)
                }
            } catch (e: Exception) {
                promise.reject(
                    "INIT_ERROR",
                    e.message ?: "Failed to start download",
                    e
                )
            }
        }
    }

    // ── Chunked range-request download ──────────────────────────────────
    // Downloads in CHUNK_SIZE pieces. Each piece is a separate HTTP request
    // with a Range header. YouTube CDN doesn't throttle range requests the
    // way it throttles full-file downloads.
    private fun downloadChunked(
        engine: CronetEngine,
        url: String,
        destPath: String,
        totalSize: Long,
        downloadId: String,
        promise: Promise
    ) {
        val destFile = File(destPath)
        destFile.parentFile?.mkdirs()
        val raf = RandomAccessFile(destFile, "rw")
        raf.setLength(totalSize) // pre-allocate

        downloadNextChunk(engine, url, raf, destFile, totalSize, 0L, downloadId, promise)
    }

    private fun downloadNextChunk(
        engine: CronetEngine,
        url: String,
        raf: RandomAccessFile,
        destFile: File,
        totalSize: Long,
        offset: Long,
        downloadId: String,
        promise: Promise
    ) {
        if (offset >= totalSize) {
            // All chunks done
            raf.close()
            val result = Bundle().apply {
                putLong("bytesWritten", totalSize)
                putString("path", destFile.absolutePath)
            }
            promise.resolve(result)
            return
        }

        val end = minOf(offset + CHUNK_SIZE - 1, totalSize - 1)
        val rangeHeader = "bytes=$offset-$end"

        val callback = object : UrlRequest.Callback() {
            private var chunkBytesRead = 0L

            override fun onRedirectReceived(
                request: UrlRequest,
                info: UrlResponseInfo,
                newLocationUrl: String
            ) {
                request.followRedirect()
            }

            override fun onResponseStarted(
                request: UrlRequest,
                info: UrlResponseInfo
            ) {
                val statusCode = info.httpStatusCode
                // 206 Partial Content is the expected response for range requests
                if (statusCode != 206 && statusCode != 200) {
                    raf.close()
                    destFile.delete()
                    promise.reject(
                        "HTTP_ERROR",
                        "HTTP $statusCode from YouTube CDN",
                        null
                    )
                    request.cancel()
                    return
                }
                request.read(ByteBuffer.allocateDirect(65536))
            }

            override fun onReadCompleted(
                request: UrlRequest,
                info: UrlResponseInfo,
                byteBuffer: ByteBuffer
            ) {
                byteBuffer.flip()
                val bytes = ByteArray(byteBuffer.remaining())
                byteBuffer.get(bytes)

                synchronized(raf) {
                    raf.seek(offset + chunkBytesRead)
                    raf.write(bytes)
                }
                chunkBytesRead += bytes.size

                // Report progress
                val totalDownloaded = offset + chunkBytesRead
                val progress = totalDownloaded.toDouble() / totalSize.toDouble()
                sendEvent("onDownloadProgress", mapOf(
                    "downloadId" to downloadId,
                    "progress" to progress
                ))

                byteBuffer.clear()
                request.read(byteBuffer)
            }

            override fun onSucceeded(
                request: UrlRequest,
                info: UrlResponseInfo
            ) {
                // Chunk complete — start next chunk
                val nextOffset = offset + chunkBytesRead
                downloadNextChunk(engine, url, raf, destFile, totalSize, nextOffset, downloadId, promise)
            }

            override fun onFailed(
                request: UrlRequest,
                info: UrlResponseInfo?,
                error: CronetException
            ) {
                raf.close()
                destFile.delete()
                promise.reject(
                    "DOWNLOAD_FAILED",
                    error.message ?: "Cronet download failed",
                    error
                )
            }

            override fun onCanceled(
                request: UrlRequest,
                info: UrlResponseInfo?
            ) {
                raf.close()
                destFile.delete()
            }
        }

        engine.newUrlRequestBuilder(url, callback, executor)
            .addHeader("Range", rangeHeader)
            .addHeader("User-Agent", USER_AGENT)
            .build()
            .start()
    }

    // ── Single-request fallback (no content-length known) ───────────────
    private fun downloadSingle(
        engine: CronetEngine,
        url: String,
        destPath: String,
        downloadId: String,
        promise: Promise
    ) {
        val destFile = File(destPath)
        destFile.parentFile?.mkdirs()
        val outputStream = java.io.FileOutputStream(destFile)
        var totalBytes = 0L

        val callback = object : UrlRequest.Callback() {
            override fun onRedirectReceived(
                request: UrlRequest,
                info: UrlResponseInfo,
                newLocationUrl: String
            ) {
                request.followRedirect()
            }

            override fun onResponseStarted(
                request: UrlRequest,
                info: UrlResponseInfo
            ) {
                val statusCode = info.httpStatusCode
                if (statusCode != 200) {
                    outputStream.close()
                    destFile.delete()
                    promise.reject(
                        "HTTP_ERROR",
                        "HTTP $statusCode from YouTube CDN",
                        null
                    )
                    request.cancel()
                    return
                }
                request.read(ByteBuffer.allocateDirect(65536))
            }

            override fun onReadCompleted(
                request: UrlRequest,
                info: UrlResponseInfo,
                byteBuffer: ByteBuffer
            ) {
                byteBuffer.flip()
                val bytes = ByteArray(byteBuffer.remaining())
                byteBuffer.get(bytes)
                outputStream.write(bytes)
                totalBytes += bytes.size

                byteBuffer.clear()
                request.read(byteBuffer)
            }

            override fun onSucceeded(
                request: UrlRequest,
                info: UrlResponseInfo
            ) {
                outputStream.close()
                val result = Bundle().apply {
                    putLong("bytesWritten", totalBytes)
                    putString("path", destFile.absolutePath)
                }
                promise.resolve(result)
            }

            override fun onFailed(
                request: UrlRequest,
                info: UrlResponseInfo?,
                error: CronetException
            ) {
                outputStream.close()
                destFile.delete()
                promise.reject(
                    "DOWNLOAD_FAILED",
                    error.message ?: "Cronet download failed",
                    error
                )
            }

            override fun onCanceled(
                request: UrlRequest,
                info: UrlResponseInfo?
            ) {
                outputStream.close()
                destFile.delete()
            }
        }

        engine.newUrlRequestBuilder(url, callback, executor)
            .addHeader("User-Agent", USER_AGENT)
            .build()
            .start()
    }
}
