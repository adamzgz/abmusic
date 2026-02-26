package com.sonicflow.cronetdownload

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.chromium.net.CronetEngine
import org.chromium.net.UrlRequest
import org.chromium.net.UrlResponseInfo
import org.chromium.net.CronetException
import java.io.File
import java.io.FileOutputStream
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

    override fun definition() = ModuleDefinition {
        Name("CronetDownload")

        AsyncFunction("download") { url: String, destPath: String, promise: Promise ->
            try {
                val engine = getEngine()
                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()
                val outputStream = FileOutputStream(destFile)
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

                engine.newUrlRequestBuilder(url, callback, executor).build().start()

            } catch (e: Exception) {
                promise.reject(
                    "INIT_ERROR",
                    e.message ?: "Failed to start download",
                    e
                )
            }
        }
    }
}
