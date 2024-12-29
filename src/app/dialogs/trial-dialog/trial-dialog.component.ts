
import { Component, Inject } from '@angular/core';
import { Publication, Trial } from 'src/app/classes/model';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Document } from 'src/app/classes/document';
import { PublicationDialogComponent, PublicationDialogData } from '../publication-dialog/publication-dialog.component';



export class TrialDialogData {
  constructor(
    public trial: Trial,
    public allTrials: Trial[],
    public document: Document,
  ) {}
}





@Component({
  selector: 'app-trial-dialog',
  templateUrl: './trial-dialog.component.html',
  styleUrls: ['./trial-dialog.component.css']
})
export class TrialDialogComponent {


  constructor(
    public dialogRef: MatDialogRef<TrialDialogComponent>,
    public publicationInfoDialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: TrialDialogData
  ){

  }


  ngAfterViewInit() {
    //make all xml elements that refer to a knowledge entity clickable to open a dialog
    // this.data.parent.findKnowledgeEntityReferences(this.descriptionElementRef?.nativeElement);
  }
  
  onNoClick(): void {
    this.dialogRef.close();
  }

  public switchToShowPublicationInfoDialog(publication: Publication, allTrials:Trial[], document: Document): void {

    this.publicationInfoDialog.open(PublicationDialogComponent, {
        width: '320px',
        data: new PublicationDialogData(publication, allTrials, document),
    });
    this.dialogRef.close();
  }



}
