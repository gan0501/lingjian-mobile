import Foundation
import Speech

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {

  private var audioEngine: AVAudioEngine?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["onSpeechResults", "onSpeechError"]
  }

  override func startObserving() {
    hasListeners = true
    super.startObserving()
  }

  override func stopObserving() {
    hasListeners = false
    super.stopObserving()
  }

  @objc(startRecording:withRejecter:)
  func startRecording(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    let authStatus = SFSpeechRecognizer.authorizationStatus()
    guard authStatus == .authorized else {
      if authStatus == .notDetermined {
        SFSpeechRecognizer.requestAuthorization { status in
          if status == .authorized {
            DispatchQueue.main.async {
              self.doStartRecording(resolve, reject)
            }
          } else {
            reject("PERMISSION_DENIED", "语音识别权限未授权", nil)
          }
        }
        return
      }
      reject("PERMISSION_DENIED", "语音识别权限未授权", nil)
      return
    }

    AVAudioSession.sharedInstance().requestRecordPermission { granted in
      if granted {
        DispatchQueue.main.async {
          self.doStartRecording(resolve, reject)
        }
      } else {
        reject("MIC_PERMISSION_DENIED", "麦克风权限未授权", nil)
      }
    }
  }

  private func doStartRecording(_ resolve: RCTPromiseResolveBlock, _ reject: RCTPromiseRejectBlock) {
    if audioEngine != nil && audioEngine!.isRunning {
      reject("ALREADY_RECORDING", "Already recording", nil)
      return
    }

    let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    guard speechRecognizer != nil else {
      reject("INIT_ERROR", "语音识别器初始化失败", nil)
      return
    }

    audioEngine = AVAudioEngine()
    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

    guard let recognitionRequest = recognitionRequest else {
      reject("INIT_ERROR", "无法创建识别请求", nil)
      return
    }

    recognitionRequest.shouldReportPartialResults = true

    let inputNode = audioEngine!.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
      self.recognitionRequest?.append(buffer)
    }

    audioEngine!.prepare()

    do {
      try audioEngine!.start()
    } catch {
      reject("AUDIO_ERROR", "音频引擎启动失败: \(error.localizedDescription)", nil)
      return
    }

    recognitionTask = speechRecognizer!.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self = self else { return }

      if let result = result {
        let transcript = result.bestTranscription.formattedString
        if self.hasListeners {
          self.sendEvent(withName: "onSpeechResults", body: ["value": transcript])
        }

        if result.isFinal {
          resolve(transcript)
          self.cleanup()
        }
      }

      if let error = error {
        if self.hasListeners {
          self.sendEvent(withName: "onSpeechError", body: ["error": error.localizedDescription])
        }
        resolve("")
        self.cleanup()
      }
    }

    resolve(true)
  }

  @objc(stopRecordingAndRecognize:withRejecter:)
  func stopRecordingAndRecognize(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    if audioEngine == nil || !audioEngine!.isRunning {
      resolve("")
      return
    }

    audioEngine?.stop()
    recognitionRequest?.endAudio()

    if recognitionTask == nil {
      resolve("")
      cleanup()
    }
  }

  private func cleanup() {
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine = nil
    recognitionRequest = nil
    recognitionTask = nil
  }

  @objc(addListener:)
  override func addListener(_ eventName: String!) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Int) {
    super.removeListeners(count)
  }
}
