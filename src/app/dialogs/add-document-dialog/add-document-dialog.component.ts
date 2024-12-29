import { Component, Inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { CriteriaValues, Guideline } from 'src/app/classes/model';
import { HttpClient } from '@angular/common/http';
import { DataSource } from 'src/app/classes/model';
import { MediaViewerDialogComponent, MediaViewerDialogData } from '../media-viewer-dialog/media-viewer-dialog.component';
import { FileTextExtractionService } from 'src/app/services/file-text-extraction.service';
import { TextExtractionService } from 'src/app/services/text-extraction.service';
import { AudioRecordingService } from 'src/app/services/audio-recording.service';
import { NotificationService } from 'src/app/services/notification.service';



export class AddDocumentDialogData {

  constructor(
    public title: string,
    public guideline: Guideline | undefined,
    public fileToTextServerAddress: string,
    public llmServerAddress: string,
    public files: {file: File, values: CriteriaValues}[],
    public id: number,
    public createNewDocument: boolean,
    public goToCommand?: string,
    public filesForExtraction?: File[]
  ) {}
}

export class AddDocumentDialogResult {
  constructor(
    public docId: number | undefined,
    public type: string,
    public title: string,
    public files: {file: File, values: CriteriaValues}[],
    public criteriaValues: CriteriaValues
  ) {}
}



@Component({
  selector: 'app-add-document-dialog',
  templateUrl: './add-document-dialog.component.html',
  styleUrls: ['./add-document-dialog.component.css']
})
export class AddDocumentDialogComponent {
  @ViewChild('fileInput', { static: false }) fileInput: any;


  public selectedFiles: {file: File, values: CriteriaValues}[] = [];
  public micMode: 'audio' | 'text' = 'text';
  public title: string = "";
  public capShotSrc: string | null = null;
  public cameraFileName: string = "camshot.png";
  public guideline: Guideline|undefined
  private fileToTextServerAddress: string = '';
  private llmServerAddress: string = '';
  public documentType: string = "none";
  public recordingFile: any;
  public recordingFileName: string = "recording.wav";
  private mediaRecorder: any;
  private audioChunks: any;
  public audioRecorded: boolean = false;
  public textFileName: string = "text.txt";
  public lastKeystrokeTime = Date.now();
  public textToBeExtracted: string = "";
  public fileList: {file: File, values: CriteriaValues}[] = [];
  public docID: number|undefined;
  public loadingFiles: File[] = [];



  constructor(
    public dialogRef: MatDialogRef<AddDocumentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddDocumentDialogData,
    private httpClient: HttpClient,
    public mediaViewerDialog: MatDialog,
    private fileTextExtractionService: FileTextExtractionService,
    private textExtractionService: TextExtractionService,
    private audioRecordingService: AudioRecordingService,
    private notificationService: NotificationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.title = data.title;
    this.guideline = data.guideline;
    this.fileToTextServerAddress = data.fileToTextServerAddress;
    this.llmServerAddress = data.llmServerAddress;
    this.fileList = data.files;
    this.docID = data.id;

    if(data.goToCommand!==undefined){
      switch(data.goToCommand){
        // case "camCap":
        //   this.documentType=='camera';
        //   this.cameraButtonClicked();
        // break;
        case "mic":
          this.documentType='microphone';
          this.micButtonClicked(); 
          // this.recordButtonClicked();
        break;
      }
    }

    if (data.filesForExtraction) {
      this.extractTextFromFiles(data.filesForExtraction);
    }
  }




  onNoClick(): void {
    this.dialogRef.close();
  }


  public fileButtonClicked() {
    this.fileInput.nativeElement.click();
  }



  public cancelDocumentButtonClicked(){
    if(this.documentType==="microphone"){
      this.micMode="text";
      this.audioRecorded=false;
      this.recordingFile=undefined;
    }
    this.documentType="none";
  }
  

  public onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      this.extractTextFromFiles(Array.from(files));
    }
  }

  public extractText() {
    const blob = new Blob([this.textToBeExtracted], { type: 'text/plain' });
    const file = new File([blob], 'text.txt', { type: 'text/plain' });
    const fileWithValues = {file: file, values: new CriteriaValues()};
    this.selectedFiles.push(fileWithValues);
    this.loadingFiles.push(file);
    this.extractValuesFromText(this.textToBeExtracted, DataSource.TEXT, fileWithValues);
    this.textToBeExtracted = "";
  }

  private extractTextFromFiles(files: File[]) {
    this.documentType = "upload";
    const filesWithValues = files.map(item => {return {file: item, values: new CriteriaValues()};});
    this.selectedFiles.push(...filesWithValues);
    for (let fileWithValues of filesWithValues) {
      this.loadingFiles.push(fileWithValues.file);
      this.fileTextExtractionService.uploadFile(this.fileToTextServerAddress, fileWithValues.file)
      .subscribe((result: { extractedText: string, dataSource: DataSource, reachedServer: boolean }) => {
        if (result.reachedServer) {
          this.extractValuesFromText(result.extractedText, result.dataSource, fileWithValues);
        }
      });
    }
  }

  private extractValuesFromText(text: string, dataSource: DataSource, fileWithValues: {file: File, values: CriteriaValues}) {
    if (this.guideline) {
      this.textExtractionService.extracText(this.guideline, this.llmServerAddress, text, dataSource).subscribe((result: {extractedValues: CriteriaValues, reachedLLM: boolean}) => {
        if (!result.reachedLLM) {
          this.notificationService.notify("The large langue model could not be accessed. Did you insert a correct server address in the settings tab? A simple local text comparison (RegEx) is done instead.");
        }
        fileWithValues.values = result.extractedValues;
        this.loadingFiles.splice(this.loadingFiles.indexOf(fileWithValues.file), 1);
      });
    }
  }


  public getFileType(file: File): string {
    const imgTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    const textTypes = ['text/plain', 'application/pdf', 'text/txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (imgTypes.includes(file.type)) {
      return "Image";
    }
    if (audioTypes.includes(file.type)) {
      return "Audio";
    }
    if (textTypes.includes(file.type)) {
      return "Text";
    }
    return "Unknown";
  }



  // public cameraButtonClicked(){
  //   this.selectedFiles=[];
  //   this.camCap();
  // }



  // public async camCap(){
  //   try {
  //     // Use getUserMedia to capture from the webcam
  //     const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
  //     const video = document.createElement('video');
  //     video.srcObject = mediaStream;
  //     video.play();
  
  //     // Draw the video frame to canvas after it starts playing
  //     video.onloadedmetadata = () => {
  //       const canvas = document.createElement('canvas');
  //       canvas.width = video.videoWidth;
  //       canvas.height = video.videoHeight;
  
  //       const ctx = canvas.getContext('2d');
  //       ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  
  //       // Convert canvas to an image URL
  //       this.capShotSrc = canvas.toDataURL();
  //       this.documentType="camera";
  
  //       // Convert the data URL to a file
  //       this.dataUrlToFile(this.capShotSrc, 'camshot.png').then(file => {
  //         const formData: FormData = new FormData();
  //         formData.append('file', file, 'camshot.png');
  //         this.selectedFiles[0] = [file,[]];
  //         this.selectedFiles[0][1].loading=true;

  //         this.httpClient.post(`${this.fileToTextServerAddress}/upload_image`, formData, { responseType: 'blob' })
  //           .subscribe(data => {
  //             this.processBlob(this.selectedFiles[0],data);
  //           });
  //       });
  
  //       // Stop all video tracks to release the media stream
  //       mediaStream.getTracks().forEach(track => track.stop());
  //     };
  //   } catch (error) {
  //     console.error('Error capturing webcam image:', error);
  //   }
  
  
  // }

  public async dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    // Convert data URL to a blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Return the blob as a File object
    return new File([blob], filename, { type: 'image/png' });
  }
  
  public micButtonClicked() {
    this.documentType="microphone";
  }

  public recordingPressed() {
    if (this.micMode === 'text') {
      try {
        this.micMode = 'audio';
        this.audioRecordingService.startRecording().then(audioFile => {
          this.processAudioFile(audioFile)
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        this.micMode = 'text';
      }
    } else {
      this.audioRecordingService.stopRecording();
      this.micMode = 'text';
    }
  }

  private processAudioFile(audioFile: File) {
    const fileWithValues = {file: audioFile, values: new CriteriaValues()};
    this.selectedFiles.push(fileWithValues)
    // extract text from resulting audio
    this.fileTextExtractionService.uploadFile(this.fileToTextServerAddress, audioFile)
    .subscribe((result: { extractedText: string, dataSource: DataSource, reachedServer: boolean }) => {
      if (result.reachedServer) {
        this.extractValuesFromText(result.extractedText, result.dataSource, fileWithValues);
      }
    });
  }


  public textButtonClicked(){
    this.documentType="text";
  }


  public newEmptyFileButtonClicked(){
    this.dialogRef.close({type: "empty", title: this.title});
  }



  public openMediaViewerDialog(file: File){
    const dialogRef = this.mediaViewerDialog.open(MediaViewerDialogComponent, {
      width: '320px',
      data: new MediaViewerDialogData(file)
    });

    dialogRef.afterClosed().subscribe((result?: any) => {
      // doc.updateCriterionValue(criterion, CriterionStatus.transformToCriterionValue(criterion, result, doc.getCriteriaValues()), doc.guideline.criteriaByPriority?.map(val => { return val instanceof NumericalOrCategoricalCriterion ? val.getCriterion() : val}) ?? doc.criteria, doc.getAllCriterionQueries(), DataSource.MANUAL, true);
    });
  }

  public removeSelectedFileButtonClicked(file:any){
    this.selectedFiles=this.selectedFiles.filter(item => item !== file);
  }

  public removeFileButtonClicked(file:any){
    this.fileList=this.fileList.filter(item => item !== file);
  }


  public closeDialog(){
    this.dialogRef.close();
  }


  public confirmNewDocument(){
    var criteriaValues = new CriteriaValues();
    if (this.selectedFiles.length === 1) {
      criteriaValues = this.selectedFiles[0].values;
    }
    else {
      for (let file of this.selectedFiles) {
        for (let criterion of file.values.getAllSetCriteria()) {
          for (let entry of file.values.getAllEntries(criterion)) {
            criteriaValues.addEntry(criterion, entry);
          }
        }
      }
    }
    this.fileList.push(...this.selectedFiles);
    this.dialogRef.close(new AddDocumentDialogResult(this.docID, this.documentType, this.title, this.fileList, criteriaValues));
  }

}
