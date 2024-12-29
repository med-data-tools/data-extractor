import { Document } from "../../classes/document";
import { Component, Output, EventEmitter } from '@angular/core';
import { BooleanOrUndef, Tag, Taggable, Criterion, DataSource, Guideline, NumericalOrCategoricalCriterion, StateGroup, Visibility, Range, NumericalCriterion, CategoricalCriterion, State, Trial, CriteriaValues, DataSelection } from "src/app/classes/model";
import { NotificationService } from "src/app/services/notification.service";
import { MatDialog } from "@angular/material/dialog";
import { CriterionStatus } from "src/app/classes/criterion-status";
import { AddDocumentDialogComponent, AddDocumentDialogData, AddDocumentDialogResult } from "src/app/dialogs/add-document-dialog/add-document-dialog.component";
import { Message } from "src/app/view/input/input.component";
import { StateDialogComponent, StateDialogData } from "src/app/dialogs/state-dialog/state-dialog.component";
import { TrialDialogComponent, TrialDialogData } from "src/app/dialogs/trial-dialog/trial-dialog.component";
import { Constants } from "src/app/classes/constants";


@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent {
  public documents: Document[] = []; // each document has an id that shall be > 0
  public combinedDocument?: Document; // id === 0 is reserved for the combined document!
  public activeDocument: number = -1;
  private largestId = 0;
  private isEditing: Map<number, boolean> = new Map();
  private selectedTab: Map<number, StateGroup> = new Map();
  private visibleTabs: Map<number, StateGroup[]> = new Map();
  private selectedTrialTag: Map<number, Tag> = new Map();
  private guideline?: Guideline;
  public fileToTextServerAddress: string = Constants.DEFAULT_FILE_TEXT_EXTRACTION_URL;
  public llmServerAddress: string = Constants.DEFAULT_LLM_URL;
  private key: string = '';
  public trialsSetting: boolean = false;
  public selectedTagName: string = "";
  public stateGroupTags: Tag[] = [];
  

  constructor(private notificationService: NotificationService, public dialog: MatDialog) { 

  }

  private reset() {
    this.isEditing = new Map();
    this.selectedTab = new Map();
    this.selectedTrialTag = new Map();
    this.activeDocument = -1;
    this.trialsSetting = false;
    this.selectedTagName = "";
  }

  @Output() public changeTab: EventEmitter<number> = new EventEmitter<number>();

  public pingGuideline(guideline: Guideline) {
    if (this.guideline !== guideline) {
      this.guideline = guideline;
      //clear old documents
      for (let doc of this.documents) {
        this.deleteDocument(doc);
      }
      //clear old tags
      this.stateGroupTags = [];
      //find new tags
      this.extractTags(this.guideline.mainGroup == undefined ? this.guideline.sideGroups : [this.guideline.mainGroup, ...this.guideline.sideGroups], this.stateGroupTags);
      if (this.stateGroupTags[0] !== undefined) {
        this.selectedTagName = this.stateGroupTags[0].name;
      }
      else {
        this.selectedTagName = "";
      }
      //init document with the new guideline
      this.initDocuments();
    }
  }

  public getDocumentsAndCombinedDocument(): Document[] {
    if (this.combinedDocument !== undefined) {
      return [...this.documents, this.combinedDocument];
    }
    return this.documents;
  }


  public pingSettings(fileToTextServerAddress: string, llmServerAddress: string, key: string, trialsSetting: boolean): void {
    this.fileToTextServerAddress = fileToTextServerAddress;
    this.llmServerAddress = llmServerAddress;
    this.key = key;
    if (trialsSetting !== this.trialsSetting) {
      if (trialsSetting == false){
        if (this.stateGroupTags[0] !== undefined) {
          this.selectedTagName = this.stateGroupTags[0].name;
        } else {
          this.selectedTagName = "";
        }
        for (let i=0; i<this.documents.length; i++) {
          this.selectTab(this.documents[i].id, this.getVisibleStateGroups()[0]);
        }
      } else {
        this.selectedTagName=this.getParentTagsOfTrials()[0]?.name;
        for (let i=0;i<this.documents.length;i++){
          this.selectTrialTab(this.documents[i].id, this.getVisibleTrialTags()[0]);
        } 
      }
    }
    this.trialsSetting = trialsSetting;
  }

  private extractTags(tagged: Taggable[], addToFirst: Tag[]) {
    for (let taggable of tagged) {
      if (taggable.tags != undefined) {
        for (let tag of taggable.tags) {
          var checkedTag: Tag | undefined = tag;
          while (checkedTag != undefined) {
            if (!addToFirst.includes(checkedTag)) {
              addToFirst.push(checkedTag);
            }
            checkedTag = checkedTag.parentTag;
          }
        }
      }
    }
  }

  private initDocuments() {
    //Create some initial chat messages for Document 1
    let initialChat: Message[] = [
      { text: 'Welcome to the CDE-based data extractor and analyzer.\n\nInsert plain text 📝, audio 🎵 or an image 🌆 or upload a file 📤 for data extraction. \n\n➤ Data values will be added to the currently selected document. \n➤ An overview of the documents can be found in the next tab.', sender: 'them' },
      // { text: 'What can I do?', sender: 'me' },
      // { text: 'Insert plain text, audio or a file such that I can extract known common data elements with AI methods for you. They will be added to the currently selected document.', sender: 'them' },
      // { text: 'Where are my documents?', sender: 'me' },
      // { text: 'You can find an overview of the documents in the next tab.', sender: 'them' },
    ];

    const id = this.getNextFreeId();
    this.addDocument("Document " + id, id, initialChat);
  }

  public getDocumentById(id: number): Document | undefined {
    //special case: id === 0 means combined document
    if (id === 0) {
      return this.combinedDocument;
    }
    return this.documents.find(document => document.id === id);
  }

  public onStateGroupTagChange(){
    for(let i=0;i<this.documents.length;i++){
      this.selectTab(this.documents[i].id, this.getVisibleStateGroups()[0]);
    }
  }

  public onTrialTagChange(){
    for(let i=0;i<this.documents.length;i++){
      this.selectTrialTab(this.documents[i].id, this.getVisibleTrialTags()[0]);
    }
  }

  public getActiveDocument(): Document | undefined {
    return this.getDocumentById(this.activeDocument);
  }

  public deleteDocumentWithConfirmation(id: number) {
    const docToDelete = this.getDocumentById(id);
    if (docToDelete != undefined) {
      this.notificationService.confirm("Do you really want to delete \"" + docToDelete.title + "\"?").then(result => {
        if (result) {
          this.deleteDocument(docToDelete);
        }
      });
    }
  }

  private deleteDocument(docToBeDeleted: Document) {
    this.documents = this.documents.filter(document => document.id !== docToBeDeleted.id);
    if (this.activeDocument === docToBeDeleted.id) {
      if (this.documents.length > 0) {
        this.activeDocument = this.documents[0].id;
      }
      else {
        this.activeDocument = -1;
      }
    }
    this.updateCombinedDocument();
  }

  emptyDocument(id: number) {
    const doc = this.getDocumentById(id);
    if (doc != undefined) {
      doc.emptyDocument();
      this.updateCombinedDocument();
    }
  }
  
  /**
   * returns id (if successful) or -1 if unsuccessful
   */
  addDocument(documentTitle: string, id: number, initialChat?: Message[]): number {
    if (this.guideline != undefined) {
      const newDocument = new Document(id, documentTitle, new Date(), this.guideline);
      if (initialChat != undefined) {
        newDocument.chat = initialChat;
      }
      this.documents.push(newDocument);
      this.isEditing.set(id, false);
      this.selectTab(id, this.getVisibleStateGroups()[0]);

      if (this.activeDocument < 0) {
        this.activeDocument = id;
      }
      this.updateCombinedDocument();
      return id;
    }
    return -1;
  }



  openAddDocumentDialog(id?: number): void {
    let title = "";
    let files: {file: File, values: CriteriaValues}[] = [];
    var createNewDocument = false;
    if (id === undefined) {
      createNewDocument = true;
      id = this.getNextFreeId();
      title = "Document " + id;
    }
    else {
      const doc = this.getDocumentById(id);
      if (doc !== undefined){
        title = doc.title;
        if(doc.files !== undefined){
          files = doc.files;
        }
      }
    }

    // if (doc != undefined) {
    const dialogRef = this.dialog.open(AddDocumentDialogComponent, {
      width: '360px',
      data: new AddDocumentDialogData(title, this.guideline, this.fileToTextServerAddress, this.llmServerAddress, files, id, createNewDocument)
    });

    dialogRef.afterClosed().subscribe((result: AddDocumentDialogResult) => {
      //if nothing has been selected -> abort
      if (result === undefined) {
        //if we have reserved an id, free the taken id
        if (createNewDocument) {
          this.revertAssigningId();
        }
        return;
      }
      //otherwise check for the chosen option
      if (result.type === "empty") {
        this.addDocument(result.title, id ?? -1, [{ text: 'You have created the empty document \"' + result.title + '\". Insert data for extraction.', sender: 'them' }]);
      } else {
        var doc = this.getDocumentById(id ?? -1);
        if (doc == undefined) {
          this.addDocument(result.title, id ?? -1);
          doc = this.getDocumentById(id ?? -1);
        } else {
          /* TODO: JZ to FD: I think adding the data is much more intuitive than deleting the existing data. I have commented it out for now, but we should discuss this later! */
          // this.emptyDocument(result.docID); //clear the document, since it is going to be filled with the new data 
        }


        if(doc != undefined){
          if (doc.title !== result.title) {
            doc.chat.push({ text: 'You have changed the name of the document from \"' + doc.title + '\" to \"' + result.title + '\".', sender: 'them' })
            doc.title = result.title;
          }

          for (let criterion of result.criteriaValues.getAllSetCriteria()) {
            for (let entry of result.criteriaValues.getAllEntries(criterion)) {
              this.updateCriterion(doc, criterion, entry.getValue(), entry.dataSource);
            }
          }

          doc.files = result.files;
        }
      }
      // doc.updateCriterionValue(criterion, CriterionStatus.transformToCriterionValue(criterion, result, doc.getCriteriaValues()), doc.guideline.criteriaByPriority?.map(val => { return val instanceof NumericalOrCategoricalCriterion ? val.getCriterion() : val}) ?? doc.criteria, doc.getAllCriterionQueries(), DataSource.MANUAL, true);
    });
    // }
  }



  openChatOfDoc(): void {
    this.changeTab.emit(0);
  }


  changeActiveDocument(id: number, event?: Event) {
    event?.stopPropagation(); //only if the click is not the top-level element, we change the active document
    
    //if the click is on the combined document, which has id === 0, we don't change the active document
    if (id > 0) {
      this.activeDocument = id;
    }
  }

  getNextFreeId(): number {
    return ++this.largestId;
  }

  revertAssigningId() {
    --this.largestId;
  }

  getVisibleStateGroups(): StateGroup[] {
    const visibleStateGroups = [];
    if (this.guideline != undefined) {
      for (let stateGroup of this.guideline.mainGroup == undefined ? this.guideline.sideGroups : [this.guideline.mainGroup, ...this.guideline.sideGroups]) {
        if (stateGroup.visibility !== Visibility.NEVER) {
          if(stateGroup.tags == undefined || this.selectedTagName === "") {
            visibleStateGroups.push(stateGroup);
          }
          else {
            for(let i=0;i<stateGroup.tags.length;i++){
              if(stateGroup.tags[i].name==this.selectedTagName){
                visibleStateGroups.push(stateGroup);
                break;
              }
            }
          }
        }
      }
    }
    return visibleStateGroups;
  }

  getVisibleTrialTags(): Tag[] {
    const visibleTrialTags:any = [];
    if (this.guideline != undefined) {
      for(let i=0;i<this.guideline.knowledgeEntities.length;i++){
        if(this.guideline.knowledgeEntities[i] instanceof Trial){
          let tags=this.guideline.knowledgeEntities[i].tags;
          if(tags!==undefined){
            for(let j=0;j<tags.length;j++){
              let tmpParentTag=tags[j].parentTag;
              if(tmpParentTag!==undefined){
                if(tmpParentTag.name==this.selectedTagName){
                  if(!visibleTrialTags.includes(tags[j])){
                    visibleTrialTags.push(tags[j]);
                  }
                }
              }
            }
          }
        }
      }
    }
    return visibleTrialTags;
  }

  getParentTagsOfTrials(): Tag[]{
    const parentTags: Tag[]=[];
    if (this.guideline != undefined) {
      for(let i=0;i<this.guideline.knowledgeEntities.length;i++){
        if(this.guideline.knowledgeEntities[i] instanceof Trial){
          let tags=this.guideline.knowledgeEntities[i].tags;
          if(tags!==undefined){
            for(let j=0;j<tags.length;j++){
              let tmpParentTag=tags[j].parentTag;
              if(tmpParentTag!==undefined){
                if(!parentTags.includes(tmpParentTag)){
                  parentTags.push(tmpParentTag);
                }
              }
            }
          }
        }
      }
    }
    return parentTags;
  }


  getSelectedTab(id: number) {
    return this.selectedTab.get(id);
  }

  selectTab(id: number, group: StateGroup) {
    return this.selectedTab.set(id, group);
  }


  toggleTabContent(docId: number, group: StateGroup) {
    var visibleTabs = this.visibleTabs.get(docId);
    if (visibleTabs == undefined) {
      visibleTabs = [];
      this.visibleTabs.set(docId, visibleTabs);
    }
    if (visibleTabs.includes(group)) {
      visibleTabs.splice(visibleTabs.indexOf(group), 1); //hide content
    }
    else {
      visibleTabs.push(group); //show content
    }
  }

  isTabContentVisible(docId: number, group: StateGroup): boolean {
    return this.visibleTabs.get(docId)?.includes(group) ?? false;
  }

  getTrialsWithTag(tag:Tag){
    let trialsWithTag: Trial[]=[];
    if(this.guideline!==undefined){
      if(this.guideline.knowledgeEntities!==undefined){
        for(let i=0;i<this.guideline?.knowledgeEntities.length;i++){
          if(this.guideline?.knowledgeEntities[i] instanceof Trial){
            let trial=this.guideline?.knowledgeEntities[i] as Trial;
            if(trial.tags!=undefined){
              for(let j=0;j<trial.tags.length;j++){
                if(trial.tags[j].name==tag.name){
                  trialsWithTag.push(trial);
                  break;
                }
              }
            }
          }
        }
      }
    }
    return trialsWithTag;
  }


  getAllTrials() {
    const allTrials: Trial[] = [];
    if(this.guideline!==undefined){
      if (this.guideline.knowledgeEntities != undefined) {
        for (let knowledgeEntity of this.guideline.knowledgeEntities) {
          if (knowledgeEntity instanceof Trial) {
            allTrials.push(knowledgeEntity);
          }
        }
      }
    }
    return allTrials;
  }




  getSelectedTrialTag(id: number) {
    return this.selectedTrialTag.get(id);
  }

  selectTrialTab(id: number, tag: Tag) {
    return this.selectedTrialTag.set(id, tag);
  }


  getRelevantCriteria(doc: Document, group: StateGroup) {
    const gatheredCritera: Criterion[] = [];
    for (let state of group.states) {
      for (let criterion of state.condition.getDependingCriteria(doc.getCriteriaValues())) {
        if (!gatheredCritera.includes(criterion)) {
          gatheredCritera.push(criterion);
        }
      }
    }
    return gatheredCritera;
  }

  getRelevantCriteriaForTrialTag(doc: Document, tag: Tag){
    const gatheredCritera: Criterion[] = [];
    for (let trial of this.getTrialsWithTag(tag)) {
      if(trial.mainCriteriaFulfilledCondition!==undefined){
        for (let criterion of trial.mainCriteriaFulfilledCondition.getDependingCriteria(doc.getCriteriaValues())) {
          if (!gatheredCritera.includes(criterion)) {
            gatheredCritera.push(criterion);
          }
        }
      }
    }
    return gatheredCritera;
  }

  isConfirmed(docId: number, group: StateGroup, state: State) {
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      return this.guideline?.mainGroup === group ? doc.mainGroupStatus?.confirmedStates.includes(state) : doc.sideGroupStatuses.get(group)?.confirmedStates.includes(state) ?? false;
    }
    return false;
  }

  isImpossible(docId: number, group: StateGroup, state: State) {
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      return state.condition.evaluate(doc.getCriteriaValues()) === BooleanOrUndef.FALSE;
    }
    return false;
  }

  trialIsConfirmed(docId:number, trial: Trial){
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      if(trial.mainCriteriaFulfilledCondition!==undefined){
        return trial.mainCriteriaFulfilledCondition.evaluate(doc.getCriteriaValues()) === BooleanOrUndef.TRUE;
      }
    }
    return false;
  }

  trialIsImpossible(docId:number, trial: Trial){
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      if(trial.mainCriteriaFulfilledCondition!==undefined){
        return trial.mainCriteriaFulfilledCondition.evaluate(doc.getCriteriaValues()) === BooleanOrUndef.FALSE;
      }
    }
    return false;
  }

  openStateDialog(docId:number, state: State, group: StateGroup): void {
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      const dialogRef = this.dialog.open(StateDialogComponent, {
        width: '360px',
        data: new StateDialogData(doc, state, group, doc.getCriteriaValues())
      });

      dialogRef.afterClosed().subscribe((result?: any) => {
        // alert("State Dialog closed");
      });
    }
  }

  openTrialDialog(docId:number, trial: Trial){
    const doc = this.getDocumentById(docId);
    if (doc != undefined) {
      const dialogRef = this.dialog.open(TrialDialogComponent, {
        width: '360px',
        data: new TrialDialogData(trial, this.getAllTrials(), doc),
      });

      dialogRef.afterClosed().subscribe((result?: any) => {
        // alert("State Dialog closed");
      });
    }
  }

  private updateCombinedDocument() {
    if (this.documents.length <= 1) {
      this.combinedDocument = undefined;
      return;
    }
    if (this.documents.length > 1 && this.combinedDocument === undefined && this.guideline !== undefined) {
      // no combined document created but we need one
      this.combinedDocument = new Document(0, "All documents combined", new Date(), this.guideline);
      this.selectTab(0, this.getVisibleStateGroups()[0]);
    }
    //fill document with a combination of all criteria values from all documents
    const combinedValues = new CriteriaValues();
    for (let doc of this.documents) {
      this.extractAndAddAllCriteriaValues(doc.getCriteriaValues(), combinedValues);
    }
    this.combinedDocument?.setCriteriaValues(combinedValues);
  }


  private extractAndAddAllCriteriaValues(valuesToBeExtracted: CriteriaValues, addThemHere: CriteriaValues) {
    for (let criterionAndList of valuesToBeExtracted.getAllAvailableCategoricalLists()) {
      const criterion = criterionAndList[0];
      const list = criterionAndList[1];
      // if in the old document, there are undefined entries, remove them
      for (let entry of [...addThemHere.getAllCategoricalEntries(criterion)]) {
        if (entry.getValue().length <= 0) {
          addThemHere.getAllCategoricalEntries(criterion).remove(entry);
        }
      }
      // now add the new entries if they are not undefined
      for (let entry of list) {
        if (entry.getValue().length > 0) {
          addThemHere.addCategoricalEntry(criterion, entry);
        }
      }
    }
    for (let criterionAndList of valuesToBeExtracted.getAllAvailableNumericalLists()) {
      const criterion = criterionAndList[0];
      const list = criterionAndList[1];
      // if in the old document, there are undefined entries, remove them
      for (let entry of [...addThemHere.getAllNumericalEntries(criterion)]) {
        if (entry.getValue().equals(CriteriaValues.getUndefinedRange(criterion, addThemHere))) {
          addThemHere.getAllNumericalEntries(criterion).remove(entry);
        }
      }
      // now add the new entries if they are not undefined
      for (let entry of list) {
        if (!entry.getValue().equals(CriteriaValues.getUndefinedRange(criterion, valuesToBeExtracted))) {
          addThemHere.addNumericalEntry(criterion, entry);
        }
      }
    }
  }

  public updateCriterion(doc: Document, criterion: Criterion, result: string[] | Range | undefined, dataSource: DataSource, overwriteValue?: boolean) {
    if (result === undefined) {
      result = CriterionStatus.transformToCriterionValue(criterion, result, doc.getCriteriaValues());
    }
    // update criterion value of a document, which may trigger further updates
    doc.updateCriterionValue(criterion, result, doc.guideline.criteriaByPriority?.map(val => { return val instanceof NumericalOrCategoricalCriterion ? val.getCriterion() : val}) ?? doc.criteria, doc.getAllCriterionQueries(), dataSource, overwriteValue ?? false);
    // if the new value is now "undefined" and in the list of criteria values -> remove it
    if (overwriteValue) {
      if (criterion instanceof CategoricalCriterion) {
        const latestEntry = doc.getCriteriaValues().getCategoricalEntry(criterion, DataSelection.LATEST_ENTRY_CREATED_TIME);
        if (latestEntry?.getValue().length === 0) { //length 0 means no string in it -> undefined
          doc.getCriteriaValues().removeEntry(criterion, latestEntry);
        }
      }
      else if (criterion instanceof NumericalCriterion) {
        const latestEntry = doc.getCriteriaValues().getNumericalEntry(criterion, DataSelection.LATEST_ENTRY_CREATED_TIME);
        if (latestEntry?.getValue().equals(CriteriaValues.getUndefinedRange(criterion, doc.getCriteriaValues()))) {
          doc.getCriteriaValues().removeEntry(criterion, latestEntry);
        }
      }
    }
    // apply changes to the combined document
    this.updateCombinedDocument();
  }

  /* Drag and drop for merging documents */

  onDragStart(event: DragEvent, documentId: number): void {
    event.dataTransfer?.setData('documentId', documentId.toString());
  }
  
  onDragOver(event: DragEvent): void {
    event.preventDefault(); // This allows the drop event to be triggered.
  }
  
  onDrop(event: DragEvent, targetDocumentId: number): void {
    event.preventDefault();
    const draggedDocumentId = parseInt(event.dataTransfer?.getData('documentId') || '', 10);
  
    // Ensure that the dropped document and target document are different
    if (draggedDocumentId && draggedDocumentId !== targetDocumentId) {
      const draggedDoc = this.getDocumentById(draggedDocumentId);
      const targetDoc = this.getDocumentById(targetDocumentId);
      //and they exist
      if (draggedDoc != undefined && targetDoc != undefined) {
        this.notificationService.confirm("Do you want to merge \"" + draggedDoc.title + "\" into \"" + targetDoc.title + "\"?").then(result => {
          if (result) {
            this.mergeDocuments(draggedDoc, targetDoc);
          }
        });
      }
    }
  }
  
  mergeDocuments(sourceDoc: Document, targetDoc: Document): void {
    //move sourceDoc's entries into targetDoc and delete it afterwards
    this.extractAndAddAllCriteriaValues(sourceDoc.getCriteriaValues(), targetDoc.getCriteriaValues());
    const sourceDocId = sourceDoc.id;
    this.deleteDocument(sourceDoc);
    //adjust active document if necessary
    if (this.activeDocument === sourceDocId) {
      this.activeDocument = targetDoc.id;
    }
  }  

}
