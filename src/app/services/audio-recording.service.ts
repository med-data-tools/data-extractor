import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {}

  // Start recording
  startRecording(): Promise<File> {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.mediaRecorder = new MediaRecorder(stream);
          this.audioChunks = [];

          this.mediaRecorder.ondataavailable = event => {
            this.audioChunks.push(event.data);
          };

          this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
            this.audioChunks = [];
            resolve(file); // Resolve with the File object
          };

          this.mediaRecorder.start();
        })
        .catch(err => reject(err));
    });
  }

  // Stop recording
  stopRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }
}
