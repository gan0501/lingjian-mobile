package com.lingjianai.baidu

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class BaiduSpeechModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "BaiduSpeechModule"
        private const val SAMPLE_RATE = 16000
        private const val BAIDU_API_KEY = "5VOFETujF0WOSmt33ozs1Sq5"
        private const val BAIDU_SECRET_KEY = "JKBiAl4CzFOvbjKBMzDI1ySFgnd3wUrA"
    }

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var isStopping = false
    private var recordingThread: Thread? = null
    private var audioData: ByteArrayOutputStream? = null
    
    private var accessToken: String? = null
    private var tokenExpireTime: Long = 0

    override fun getName(): String = "BaiduSpeechModule"

    private fun getAccessToken(): String? {
        if (accessToken != null && System.currentTimeMillis() < tokenExpireTime) {
            return accessToken
        }
        
        try {
            val url = URL("https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=$BAIDU_API_KEY&client_secret=$BAIDU_SECRET_KEY")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            val response = connection.inputStream.bufferedReader().readText()
            val json = JSONObject(response)
            
            accessToken = json.getString("access_token")
            tokenExpireTime = System.currentTimeMillis() + (json.getInt("expires_in") - 300) * 1000
            
            return accessToken
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get access token: ${e.message}")
            return null
        }
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        if (isRecording) {
            promise.reject("ALREADY_RECORDING", "Already recording")
            return
        }

        if (isStopping) {
            promise.reject("STOPPING", "Previous recording is still stopping, please wait")
            return
        }

        if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            promise.reject("NO_PERMISSION", "No audio permission")
            return
        }

        try {
            val minBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            val bufferSize = maxOf(minBufferSize * 4, SAMPLE_RATE * 2)
            
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                audioRecord?.release()
                audioRecord = null
                promise.reject("AUDIO_INIT_ERROR", "AudioRecord not initialized")
                return
            }
            
            audioData = ByteArrayOutputStream()
            audioRecord?.startRecording()
            isRecording = true

            recordingThread = Thread {
                android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)
                val buffer = ShortArray(1024)
                
                while (isRecording) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        for (i in 0 until read) {
                            val byte1 = (buffer[i].toInt() and 0xFF).toByte()
                            val byte2 = ((buffer[i].toInt() shr 8) and 0xFF).toByte()
                            audioData?.write(byte1.toInt())
                            audioData?.write(byte2.toInt())
                        }
                    }
                }
            }
            recordingThread?.start()
            
            Log.d(TAG, "Started recording")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Start recording error: ${e.message}", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopRecordingAndRecognize(promise: Promise) {
        if (!isRecording) {
            promise.reject("NOT_RECORDING", "Not recording")
            return
        }

        isRecording = false
        isStopping = true
        
        try {
            recordingThread?.join(3000)
            recordingThread = null
            
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            val pcmData = audioData?.toByteArray()
            audioData = null
            
            if (pcmData == null || pcmData.isEmpty()) {
                isStopping = false
                promise.reject("NO_DATA", "No audio data recorded")
                return
            }

            Log.d(TAG, "Recorded ${pcmData.size} bytes of audio")

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val result = recognizeWithBaidu(pcmData)
                    withContext(Dispatchers.Main) {
                        isStopping = false
                        promise.resolve(result)
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        isStopping = false
                        promise.reject("RECOGNIZE_ERROR", e.message)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Stop recording error: ${e.message}", e)
            isStopping = false
            promise.reject("STOP_ERROR", e.message)
        }
    }

    private fun recognizeWithBaidu(pcmData: ByteArray): String {
        val token = getAccessToken()
            ?: throw Exception("Failed to get Baidu access token")

        val wavData = createWavHeader(pcmData.size) + pcmData
        
        val base64Audio = Base64.encodeToString(wavData, Base64.NO_WRAP)
        
        val url = URL("https://vop.baidu.com/server_api")
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        connection.doOutput = true
        connection.connectTimeout = 30000
        connection.readTimeout = 30000

        val jsonBody = JSONObject().apply {
            put("format", "wav")
            put("rate", SAMPLE_RATE)
            put("channel", 1)
            put("cuid", "lingjianai-app")
            put("token", token)
            put("speech", base64Audio)
            put("len", wavData.size)
            put("dev_pid", 1537)
        }

        connection.outputStream.use { os ->
            os.write(jsonBody.toString().toByteArray(Charsets.UTF_8))
        }

        val responseCode = connection.responseCode
        if (responseCode != 200) {
            throw Exception("HTTP error: $responseCode")
        }

        val response = connection.inputStream.bufferedReader().readText()
        val jsonResponse = JSONObject(response)
        
        val errNo = jsonResponse.optInt("err_no", -1)
        if (errNo != 0) {
            val errMsg = jsonResponse.optString("err_msg", "Unknown error")
            throw Exception("Baidu API error: $errMsg (code: $errNo)")
        }

        val resultArray = jsonResponse.optJSONArray("result")
        if (resultArray != null && resultArray.length() > 0) {
            return resultArray.getString(0)
        }
        
        return ""
    }

    private fun createWavHeader(dataLength: Int): ByteArray {
        val totalLength = 36 + dataLength
        val byteRate = SAMPLE_RATE * 2
        
        return ByteArrayOutputStream().apply {
            write("RIFF".toByteArray())
            write(intToBytes(totalLength, 4))
            write("WAVE".toByteArray())
            write("fmt ".toByteArray())
            write(intToBytes(16, 4))
            write(intToBytes(1, 2))
            write(intToBytes(1, 2))
            write(intToBytes(SAMPLE_RATE, 4))
            write(intToBytes(byteRate, 4))
            write(intToBytes(2, 2))
            write(intToBytes(16, 2))
            write("data".toByteArray())
            write(intToBytes(dataLength, 4))
        }.toByteArray()
    }

    private fun intToBytes(value: Int, size: Int): ByteArray {
        val bytes = ByteArray(size)
        for (i in 0 until size) {
            bytes[i] = ((value shr (8 * i)) and 0xFF).toByte()
        }
        return bytes
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
