import { CriteriaValues, State, StateGroup } from './../../classes/model';
import { Component, Inject } from '@angular/core';
import { Document } from 'src/app/classes/document';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';



export class StateDialogData {
  constructor(
    public document: Document,
    public state: State,
    public group: StateGroup,
    public criteriaValues: CriteriaValues
  ) {}
}



@Component({
  selector: 'app-state-dialog',
  templateUrl: './state-dialog.component.html',
  styleUrls: ['./state-dialog.component.css']
})
export class StateDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<StateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StateDialogData
  ){

  }


  onNoClick(): void {
    this.dialogRef.close();
  }
}
