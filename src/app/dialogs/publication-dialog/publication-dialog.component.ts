import { Component, Inject } from '@angular/core';
import { CriteriaValues, Publication, Trial } from 'src/app/classes/model';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TrialDialogComponent, TrialDialogData } from '../trial-dialog/trial-dialog.component';
import { Document } from 'src/app/classes/document';



export class PublicationDialogData {
  constructor(
    public publication: Publication,
    public allTrials: Trial[],
    public document: Document,
  ) {}
}




@Component({
  selector: 'app-publication-dialog',
  templateUrl: './publication-dialog.component.html',
  styleUrls: ['./publication-dialog.component.css']
})
export class PublicationDialogComponent {


  constructor(
    public dialogRef: MatDialogRef<PublicationDialogComponent>,
    public trialInfoDialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: PublicationDialogData,
  ) {}

  ngAfterViewInit() {
    //make all xml elements that refer to a knowledge entity clickable to open a dialog
    //this.data.parent.findKnowledgeEntityReferences(this.descriptionElementRef?.nativeElement); WAS NOT COMMENTED INITIALLY
  }
  
  onNoClick(): void {
    this.dialogRef.close();
  }

  public switchToAssociatedTrialInfoDialog(trial: Trial, allTrials: Trial[], document: Document): void {


    this.trialInfoDialog.open(TrialDialogComponent, {
      width: '320px',
      data: new TrialDialogData(trial, allTrials, document),
    });
    this.dialogRef.close();
  }

 

  public getAssociatedTrialsOfPublication(publication: Publication, allTrials:Trial[]): Trial[] {
    let associatedTrials: Trial[] = [];
    for(let trial of allTrials){
      if(trial.mainPublication!==undefined){
        if(trial.mainPublication.name==publication.name){
          associatedTrials.push(trial);
        }
      }
    }
    return associatedTrials;
  }



}
