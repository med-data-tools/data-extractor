import { Constants } from "src/app/classes/constants";
import { Component, ElementRef, ViewChild, Output, EventEmitter, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Criterion, DataSource, Guideline, Range, NumericalCriterion, CategoricalCriterion, CriteriaValues } from "src/app/classes/model";
import { Document } from "src/app/classes/document";
import { MatDialog } from "@angular/material/dialog";
import { AddDocumentDialogComponent, AddDocumentDialogData } from "src/app/dialogs/add-document-dialog/add-document-dialog.component";
import { DocumentsComponent } from "../documents/documents.component";
import { MatSelectChange } from "@angular/material/select";
import { TextExtractionService } from "src/app/services/text-extraction.service";
import { FileTextExtractionService } from "src/app/services/file-text-extraction.service";
import { ImageDialogComponent } from "src/app/dialogs/image-dialog/image-dialog.component";
import { AudioRecordingService } from "src/app/services/audio-recording.service";


export interface Message {
  text: string;
  sender: string;
  tag?: string;
  buttonText?: string;
  extractedValues?: CriteriaValues;
  fileUrl?: string;
  fileType?: 'image' | 'pdf' | 'audio' | 'unknown';
  fileName?: string;
}

@Component({
  selector: 'app-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.css']
})
export class InputComponent {
  @ViewChild('fileInput', { static: false }) private fileInput: any;
  @ViewChild('chatWindow') private chatWindow!: ElementRef;
  @ViewChild('inputField') private inputField: any;
  @Input() public documentsComponent?: DocumentsComponent;
  @Output() public setCriterionValueInDocument: EventEmitter<any> = new EventEmitter<any>();
  @Output() public updateCriterionEvent: EventEmitter<any> = new EventEmitter<any>();



  public messages: Message[] = [
    // { text: 'Hello!', sender: 'me' },
    // { text: 'Hi! How are you?', sender: 'them' },
    // { text: 'I am good, thanks!', sender: 'me' }
  ];

  public newMessage: Message = { text: '', sender: 'me', tag: undefined};

  private fileToTextServerAddress = Constants.DEFAULT_FILE_TEXT_EXTRACTION_URL;
  private llmServerAddress: string = Constants.DEFAULT_LLM_URL;
  private key: string = '';
  private showTrials: boolean = false;
  public capShotSrc: string | null = null;
  public micMode: 'audio' | 'text' = 'text';
  private guideline?: Guideline;
  private mostRecentAudioFile?: File;


  constructor(private httpClient: HttpClient, public dialog: MatDialog, private textExtractionService: TextExtractionService, private fileTextExtractionService: FileTextExtractionService, private audioRecordingService: AudioRecordingService) { 

  }

  public getActiveDocument(): Document | undefined {
    return this.documentsComponent?.getActiveDocument();
  }
  
  public getActiveDocumentAndUpdateChat(): Document | undefined {
    const activeDocument = this.documentsComponent?.getActiveDocument();
    if (activeDocument !== undefined && this.messages !== activeDocument.chat) {
      this.messages = activeDocument.chat;
    }
    return activeDocument;
  }

  public getDocuments(): Document[] {
    return this.documentsComponent?.documents ?? [];
  }


  public onDocChange(event: MatSelectChange) {
    if (event.value instanceof Document && this.documentsComponent !== undefined) {
      this.documentsComponent.activeDocument = event.value.id;
    }
    else if (event.value === undefined) {
      this.documentsComponent?.changeActiveDocument(-1);
    }
    this.messages = this.getActiveDocument()?.chat ?? [];
  }

  public pingGuideline(guideline: Guideline) {
    this.guideline = guideline;
  }

  public pingSettings(fileToTextServerAddress: string, llmServerAddress: string, key: string, showTrials: boolean): void {
    this.fileToTextServerAddress = fileToTextServerAddress;
    this.llmServerAddress = llmServerAddress;
    this.key = key;
    this.showTrials = showTrials;
  }


  getCriterionValueAsString(doc: Document, criterion: Criterion): string {
    if (doc != undefined) {
      if (criterion instanceof NumericalCriterion) {
        const value = doc.getCriteriaValues().getNumerical(criterion);
        if(value.start==criterion.minValue.getValueLow() && value.end==criterion.maxValue.getValueHigh()){
          return "";
        }else{
          return "" + (value.start === value.end ? value.start : value);
        }
      }
      else if (criterion instanceof CategoricalCriterion) {
        return doc.getCriteriaValues().getCategorical(criterion).toString();
      }
    }
    return "";
  }




  public callAPI(){
    let THIS=this;


    let docInfo = "";

    let activeDocument = this.getActiveDocument();
    if(activeDocument !== undefined){
      for (let criterion of activeDocument.criteria) {
        let critValue = this.getCriterionValueAsString(activeDocument, criterion);
        if (critValue.length === 0) {
          critValue = Constants.STRING_FOR_UNKNOWN;
        }
        if (critValue !== Constants.STRING_FOR_UNKNOWN) {
          docInfo += "criterion " + criterion.name+ ": " + critValue + ", ";
        }
      }
    }
    docInfo = docInfo + "all other criteria values are unknown.";


      // ng-container *ngFor="let criterion of getRelevantCriteria(doc.id, group)">
      // <button class="criterion" *ngIf="isSet(doc.id, criterion)" mat-button (click)="openCriterionDialog(doc.id, criterion)">{{ criterion.name }}: {{ getCriterionValueAsString(doc.id, criterion) }} <span [ngClass]="getDotClass(doc.id, criterion)">•</span></button>
      // </ng-container>

  //   mainGroupStatus?: StateGroupStatus;
  // sideGroupStatuses: Map<StateGroup, StateGroupStatus> = new Map();
  // private criteriaValues: CriteriaValues;
  // private criterionStatuses: Map<Criterion, CriterionStatus>;
  // criteria: Criterion[];
  // files?: any[]; //ADDED BY FABIO
  // chat?: Message[]; //ADDED BY FABIO

    let systemMessage = 'You are a helpful assistant for document analysis. The document contains criteria and possible values of these criteria. This information may or may not be helpful for answering questions. The criteria and values are: "' + docInfo + '".';


    let tmpChatMessages:any[]=[];
    tmpChatMessages.push({role: 'system', content: systemMessage});
    for(let i=0;i<this.messages.length;i++){
      if(this.messages[i].sender=="me"){
        tmpChatMessages.push({role: 'user', content: this.messages[i].text});
      }
      if(this.messages[i].sender=="them"){
        tmpChatMessages.push({role: 'assistant', content: this.messages[i].text});
      }
    }

  

  
    let authorization = 'Bearer ' + THIS.key;
    async function callTogetherAPI() {
      const url = 'https://api.together.xyz/v1/chat/completions';
      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          messages: tmpChatMessages,
          model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          max_tokens: 40,
          temperature: 0
        })
      };

      fetch(url, options)
          .then((res: Response) =>res.json())
          .then((json: any) => {
                    THIS.messages.push({ text: json.choices[0].message.content, sender: 'them' });
                    THIS.scrollToBottom();
                  })
          .catch((err: any) => console.error('error:' + err));
      }

      
    //   let authorization = 'Bearer 8bd0afe9e71c5fd955d5dedbc72c69c973cf283398a16e0a27890b96992057dc';// + THIS.key;
    //   const options = {
    //     method: 'POST',
    //     headers: {
    //       accept: 'application/json',
    //       'content-type': 'application/json',
    //       Authorization: authorization,
    //     },
    //     body: JSON.stringify({
    //       logit_bias: {'105': 21.4, '1024': -10.5},
    //       prompt: '<s>[INST]'+message+'[/INST]',
    //       model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    //       max_tokens: 0,
    //       stop: ['string'],
    //       temperature: 0,
    //       top_p: 0,
    //       top_k: 0,
    //       repetition_penalty: 0,
    //       stream: false,
    //       logprobs: 0,
    //       echo: true,
    //       n: 0,
    //       min_p: 0,
    //       presence_penalty: 0,
    //       frequency_penalty: 0
    //     })
    //   };
      
    //   fetch('https://api.together.xyz/v1/completions', options)
    //     .then(response => response.json())
    //     .then(response => {
    //       THIS.messages.push({ text: response.choices[0].text, sender: 'them' });
    //       THIS.scrollToBottom();
    //     })
    //       // console.log(response))
    //     .catch(err => console.error(err));
        
    // }
    callTogetherAPI();
  }


 

  public showChatButtonText(message: Message) {
    message.text=message.text+message.buttonText;
    message.buttonText = undefined;
  }



  public fileButtonClicked() {
    this.fileInput.nativeElement.click();
  }

  openImageDialog(imageUrl?: string): void {
    if (imageUrl) {
      this.dialog.open(ImageDialogComponent, {
        data: { imageUrl }
      });
    }
  }

  public onFileSelected(event: any) {
    const files: FileList = event.target.files;
    const activeDocument = this.getActiveDocument();
    if (files && activeDocument) {
      for (let file of Array.from(files)) {
        //add file to chat
        const fileReader = new FileReader();
        if (file.type.startsWith('image')) {
          fileReader.onload = () => {
            activeDocument.chat.push({
              sender: 'me',
              fileUrl: fileReader.result as string, // base64 encoded URL
              fileType: 'image',
              fileName: file.name,
              text: ''
            });
          };
          fileReader.readAsDataURL(file); // Convert image to base64 URL for preview
        } else if (file.type === 'application/pdf') {
          fileReader.onload = () => {
            activeDocument.chat.push({
              sender: 'me',
              fileUrl: fileReader.result as string, // base64 encoded URL
              fileType: 'pdf',
              fileName: file.name,
              text: ''
            });
          };
          fileReader.readAsDataURL(file); // Convert PDF to base64 URL for preview
        } else {
          fileReader.onload = () => {
            activeDocument.chat.push({
              sender: 'me',
              fileUrl: fileReader.result as string, // base64 encoded URL
              fileType: 'unknown',
              fileName: file.name,
              text: ''
            });
          };
          fileReader.readAsDataURL(file);
        }
        //extract txt from file
        this.fileTextExtractionService.uploadFile(this.fileToTextServerAddress, file)
        .subscribe((result: { extractedText: string, dataSource: DataSource, reachedServer: boolean }) => {
          if (result.reachedServer) {
            activeDocument.chat.push({text: "Text was extracted from the file:\n\n", sender: 'them', buttonText: result.extractedText});
            this.extractValuesFromText(result.extractedText, result.dataSource, file);
          }
          else {
            activeDocument.chat.push({text: "The server to process the file is currently unavailable. Please make sure that a correct server address is provided in the settings tab.", sender: 'them'});
            return;
          }
        });
      }
      // let filesArray = Array.from(files); // Convert FileList to an array
      // this.onUpload(filesArray);
    }
  }


  // public onUpload(files: File[]) {
  //   const activeDocument = this.getActiveDocument();
  //   if (activeDocument !== undefined) {
  //     for (let file of files) {
  //       this.getActiveDocument()?.files?.push([file, []]);
  //     }
  //     this.openAddDocumentDialog(activeDocument, "none", files);
  //   }



    // if(this.newMessage.tag=="textExtraction"){
    //   const blob = new Blob([this.newMessage.text], { type: 'text/plain' });
    //   const file = new File([blob], 'text.txt', { type: 'text/plain' });
    //   let tmpFileSave:any= [file,[]];
    //   this.selectedDoc?.files?.push(tmpFileSave);
    //   if(this.selectedDoc!==undefined){
    //     this.openAddDocumentDialog(this.selectedDoc,[tmpFileSave]);
    //   }
    // }



    // if (this.selectedFile) {
    //   const formData: FormData = new FormData();
    //   formData.append('file', this.selectedFile, this.selectedFile.name);
    //   const imgTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    //   const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
      
    //   // //Image
    //   // if (imgTypes.includes(this.selectedFile.type)) {
    //   //   this.httpClient.post(`${this.baseUrl}/upload_image`, formData, { responseType: 'blob' })
    //   //     .subscribe((data)=>{
    //   //     //    this.processBlob(data);
    //   //       }
    //   //     );
    //   // }
    //   // //Audio
    //   // if (audioTypes.includes(this.selectedFile.type)) {
      //   this.httpClient.post(`${this.baseUrl}/upload_audio`, formData, { responseType: 'blob' })
      //     .subscribe((data)=>{
      //         this.processBlob(data);
      //       }
      //     );
      // }
    // }
  // }


  public processBlob(blob: Blob) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataString = reader.result;
      let tmpJSON = JSON.parse(dataString as string);
      if(tmpJSON.type=="audio"){
       this.textExtraction(tmpJSON.transcription,DataSource.AUDIO);
      }
      if(tmpJSON.type=="img"){
        const labels = tmpJSON.ocr['<OCR_WITH_REGION>']['labels'];
       this.textExtraction(labels,DataSource.IMAGE);
      }
      
    }
    reader.readAsText(blob);
  }



  public textExtraction(text:string, dataSource:DataSource=DataSource.TEXT){
    if(this.guideline!==undefined){
      if(this.guideline.criteriaByDisplayOrder!==undefined){
        let requestForAllCriteria={
          requests:[""]
        };
        for(let criterionGroup of this.guideline.criteriaByDisplayOrder) {
          for(let criterion of criterionGroup.criteria) {
            const crit=criterion.getCriterion();
            let tmpPrompt=crit.regexRule;
            if(tmpPrompt!==undefined && tmpPrompt!=="" && tmpPrompt!==null){
              tmpPrompt=tmpPrompt.replace("[INFO]",text);        
              if(crit instanceof CategoricalCriterion){
                let tmpSelectOptions:any="";
                let tmpOptions=[];
                for(let i=0;i<crit.values.length;i++){
                  tmpOptions.push(crit.values[i].name);
                }
                tmpOptions.push('unknown');
                tmpSelectOptions = "[" + tmpOptions.map(item => `'${item}'`).join(", ") + "]";

                let tmp={
                  'criterion':crit.name,
                  'type':'c',
                  'prompt':tmpPrompt,
                  'selectOptions':tmpSelectOptions
                }
                requestForAllCriteria.requests.push(JSON.stringify(tmp));
              }
              if(crit instanceof NumericalCriterion){
                let tmp={
                  'criterion':crit.name,
                  'type':'n',
                  'prompt':tmpPrompt
                }
                requestForAllCriteria.requests.push(JSON.stringify(tmp));
              }
            }
          }
        }
        requestForAllCriteria.requests.splice(0,1);
        const LM=this.httpClient.post<any>(`${this.llmServerAddress}/api`,requestForAllCriteria);
        LM.subscribe((data)=>{
          for (let i=0;i<data.answers.length;i++){
            if(data.answers[i].value!=="unknown"){
              if(this.guideline!==undefined){
                if(this.guideline.criteriaByDisplayOrder!==undefined){
                  for(let criterionGroup of this.guideline.criteriaByDisplayOrder){
                    for(let criterion of criterionGroup.criteria) {
                      const crit=criterion.getCriterion();
                      if(crit.name==data.answers[i].criterion){
                        switch(data.answers[i].type){
                          case "c"://CategoricalCriterion
                            if(crit instanceof CategoricalCriterion){
                              // updateCriterionValue(criterion: Criterion, value: Range | string[], allCriteriaByPriority: Criterion[], allCriterionQueryComponents: Iterable<CriterionQueryComponent>, dataSource: DataSource, overwriteCurrentValue: boolean, remainingUpdateRounds?: number, dontUpdateRange?: Criterion[], supressSwitchFromRangeToNumber?: Criterion[], doHighlighting?: boolean, time?: Date, entryCreatedTime?: Date): void {
                              this.updateCriterionEvent.emit([crit,[data.answers[i].value],dataSource]);
                              // this.updateStatesAndCritList();
                              break;
                            }
                          break;
                          case "n"://NumericalCriteriona
                            if(crit instanceof NumericalCriterion){
                              let tmpValue=parseFloat(data.answers[i].value)
                              this.updateCriterionEvent.emit([crit,new Range(tmpValue,tmpValue),dataSource]);
                              // this.updateStatesAndCritList();
                              break;
                            }
                          break;
                        }
                      }
                    }
                  }
                }  
              }
            }
          }
        });
      }
    }
  }




  public cameraButtonClicked(){
    const activeDocument = this.getActiveDocument();
    if(activeDocument !== undefined) {
      this.openAddDocumentDialog(activeDocument, "camCap");
    }
  }




  public micButtonClicked(){
    // const activeDocument = this.getActiveDocument();
    // if(activeDocument !== undefined) {
    //   this.openAddDocumentDialog(activeDocument, "mic");
    // }
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
    const activeDocument = this.getActiveDocument();
    if (activeDocument) {
      const audioUrl = URL.createObjectURL(audioFile);
      activeDocument.chat.push({
        sender: 'me',
        fileUrl: audioUrl,
        fileType: 'audio',
        fileName: audioFile.name,
        text: ''
      });
      // extract text from resulting audio
      this.fileTextExtractionService.uploadFile(this.fileToTextServerAddress, audioFile)
      .subscribe((result: { extractedText: string, dataSource: DataSource, reachedServer: boolean }) => {
        if (result.reachedServer) {
          let tmpMessage:Message={text: "Text was extracted from the audio recording:\n\n", sender: 'them', buttonText: result.extractedText};
          activeDocument.chat.push(tmpMessage);
          // and extract criteria values from the text
          this.extractValuesFromText(result.extractedText, result.dataSource, audioFile);
        }
        else {
          activeDocument.chat.push({text: "The server to process the file is currently unavailable. Please make sure that a correct server address is provided in the settings tab.", sender: 'them'});
          return;
        }
      });
    }
  }


  onInputChange(value: string) {
    if (value.includes('#ext')) {
     this.newMessage.text = this.newMessage.text.replace('#ext', ''); // Clear #ext from input
     this.newMessage.tag="textExtraction";
     this.setCaretToEnd();
    }
  }


  setCaretToStart() {
    setTimeout(() => {
      const inputElement = this.inputField.nativeElement;
      inputElement.focus(); // Focus the input field
      inputElement.setSelectionRange(0,0); // Set the caret to the start
    }, 0);
  }

  setCaretToEnd() {
    setTimeout(() => {
      const inputElement = this.inputField.nativeElement;
      inputElement.focus(); // Focus the input field
      inputElement.setSelectionRange(this.newMessage.text.length, this.newMessage.text.length); // Set the caret to the end
    }, 0);
  }


  onKeydown(event: KeyboardEvent) {
    const inputElement = this.inputField.nativeElement;
    const caretPosition = inputElement.selectionStart;

    if (event.key === 'Backspace' && caretPosition === 0) {
      event.preventDefault(); // Prevent default backspace action
      this.newMessage.tag=undefined;
      this.setCaretToStart();
    }

    if (event.key === 'Enter' && event.shiftKey === false && event.ctrlKey === false) {
      event.preventDefault(); //prevent line break
    }
  }

  sendMessage() {
    this.newMessage.text = this.newMessage.text.trim();
    if (this.newMessage.text.length > 0) {
      const activeDocument = this.getActiveDocument();
      if(this.newMessage.text === "#new") {
        if(activeDocument !== undefined) {
          activeDocument.chat = [];
        }
        this.messages = activeDocument?.chat ?? [];
      } else { // Send the message
        activeDocument?.chat.push({text: this.newMessage.text, sender: 'me'})
        // if (this.newMessage.tag == "textExtraction"){
        //   const blob = new Blob([this.newMessage.text], { type: 'text/plain' });
        //   const file = new File([blob], 'text.txt', { type: 'text/plain' });
        //   activeDocument?.files?.push([file,[]]);
        //   if (activeDocument !== undefined) {
        //     this.openAddDocumentDialog(activeDocument, "none", [file]);
        //   }
        // }
        // activeDocument.chat.push(this.newMessage);
        // this.callAPI();

        // activeDocument?.chat.push({text: "The answer is processed by an extraction model. This may take a moment.", sender: 'them'})
        this.extractValuesFromText(this.newMessage.text, DataSource.TEXT);
      }
    }
    this.newMessage = { text: '', sender: 'me' }
    this.scrollToBottom();
  }

  private extractValuesFromText(text: string, dataSource: DataSource, associatedFile?: File) {
    const activeDocument = this.getActiveDocument();
    if (activeDocument) {
      if (this.guideline) {
        this.textExtractionService.extracText(this.guideline, this.llmServerAddress, text, dataSource).subscribe((result: {extractedValues: CriteriaValues, reachedLLM: boolean}) => {
          if (!result.reachedLLM) {
            activeDocument.chat.push({text: "The extraction model was not accessible. Please make sure that a correct server address is provided in the settings tab. A simple local text comparison (RegEx) will be performed instead.", sender: 'them'});
          }
          this.generateAnswerFromExtraction(result.extractedValues, activeDocument);
          if (associatedFile) {
            activeDocument.files.push({file: associatedFile, values: result.extractedValues});
          }
        });
      }
      else {
        activeDocument.chat.push({text: "No extraction possible since there is no guideline provided specifying data elements.", sender: 'them'})
      }
    }
  }

  private generateAnswerFromExtraction(extractedValues: CriteriaValues | undefined, document?: Document) {
    //extract values and push them
    for (let criterion of extractedValues?.getAllSetCriteria() ?? []) {
      const entry = extractedValues?.getEntry(criterion);
      this.updateCriterionEvent.emit([criterion, entry?.getValue(), entry?.dataSource]);
    }

    //chat answer
    var text = "";
    if (extractedValues == undefined || extractedValues.isEmpty()) {
      text = "No values were extracted from the input. Please insert them manually in the documents tab or try a different input."
      extractedValues = undefined;
    }
    else {
      text = "The following entries were added to " + (document?.title ?? 'an unknown document') + ":"
    }

    this.getActiveDocument()?.chat.push({text: text, sender: 'them', extractedValues: extractedValues});
    this.scrollToBottom();
  }
  

  

  scrollToBottom() {
    setTimeout(() => {
      const chatWindow = this.chatWindow.nativeElement;
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }, 0); // Timeout ensures DOM update before scrolling
  }

  openAddDocumentDialog(doc:Document, goToCommand?:string, filesForExtraction?:any[]): void {
    let tmpFilesList:any[]=[];
    if(doc.files!=undefined){
      tmpFilesList=doc?.files;
    }

    const dialogRef = this.dialog.open(AddDocumentDialogComponent, {
      width: '320px',
      data: new AddDocumentDialogData(doc.title,this.guideline, this.fileToTextServerAddress, this.llmServerAddress, tmpFilesList, doc.id, false, goToCommand, filesForExtraction)
    });

    dialogRef.afterClosed().subscribe((result?: any) => {

      this.emptyDocument(result.docID); //clear the document, since it is going to be filled with the new data

      for(let i=0;i<result.critVals.length;i++){
        for(let j=0;j<result.critVals[i].length;j++){
          this.setCriterionValueInDocument.emit([result.critVals[i][j][0],result.critVals[i][j][1],result.critVals[i][j][2],result.docID]);
        }
      }

      if(doc!==undefined){
        doc.title=result.title;
        if(doc?.files==undefined){
          doc.files=[];
        }
        for(let i=0;i<result.files.length;i++){
          doc?.files?.push(result.files[i]);
        }
      }
    });
  }


  emptyDocument(id: number) {
    const doc = this.documentsComponent?.getDocumentById(id);
    if (doc != undefined) {
      doc.emptyDocument();
    }
  }

}
