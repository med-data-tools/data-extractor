import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CategoricalCriterion, CriteriaValues, Criterion, DataRecord, DataSelection, DataSource, NumericalCriterion, Range } from 'src/app/classes/model';
import { CriterionDialogComponent, CriterionDialogData } from 'src/app/dialogs/criterion-dialog/criterion-dialog.component';
import { Document } from 'src/app/classes/document';
import { CriterionStatus } from 'src/app/classes/criterion-status';

@Component({
  selector: 'app-criteria-listing',
  templateUrl: './criteria-listing.component.html',
  styleUrls: ['./criteria-listing.component.css']
})
export class CriteriaListingComponent {
  @Input() criteriaValues?: CriteriaValues;
  @Input() document?: Document;
  @Input() criteria?: Criterion[];
  @Input() isInChatWindow: boolean = false;

  @Output() updateCriterion = new EventEmitter<[document: Document, criterion: Criterion, result: string[] | Range, dataSource: DataSource, removeValueIfItBecomesUndefined?: boolean]>(); 

  constructor(public dialog: MatDialog) {}

  public isSet(criterion: Criterion): boolean {
    if (this.criteriaValues !== undefined) {
      return !this.criteriaValues.isUndefined(criterion);
    }
    return false;
  }


  getCriterionValueAsString(criterion: Criterion): string {
    if (this.criteriaValues !== undefined) {
      if (criterion instanceof NumericalCriterion) {
        const value = this.criteriaValues.getNumerical(criterion);
        return "" + (value.start === value.end ? value.start : value);
      }
      else if (criterion instanceof CategoricalCriterion) {
        return this.criteriaValues.getCategorical(criterion).toString();
      }
    }
    return "";
  }

  public openCriterionDialog(criterion: Criterion): void {
    const dialogRef = this.dialog.open(CriterionDialogComponent, {
      width: '360px',
      data: new CriterionDialogData(criterion, this.criteriaValues ?? new CriteriaValues(), (this.document?.id ?? 1) !== 0, !this.isInChatWindow, this.document?.guideline, this.isInChatWindow)
    });

    dialogRef.afterClosed().subscribe((result?: string[] | Range | undefined) => {
      if (result !== undefined && this.document !== undefined && this.updateCriterion !== undefined) {
        this.updateCriterion.emit([this.document, criterion, result, DataSource.MANUAL, true]);
        if (this.isInChatWindow) {
          const toBeRemoved = this.criteriaValues?.getEntry(criterion, DataSelection.LATEST_ENTRY_CREATED_TIME);
          if (toBeRemoved !== undefined) {
            this.criteriaValues?.getAllEntries(criterion).remove(toBeRemoved);
          }
          this.criteriaValues?.add(criterion, result, DataSource.MANUAL, toBeRemoved?.getTime());
        }
      }
    });
  }

  public unsetCriterion(criterion: Criterion, event?: Event): void {
    event?.stopPropagation(); //do not open criterion selection dialog

    if (this.document !== undefined && this.updateCriterion !== undefined) {
      this.updateCriterion.emit([this.document, criterion, CriterionStatus.transformToCriterionValue(criterion, undefined, this.criteriaValues), DataSource.MANUAL, true]);
    }
    //remove from the list of criteria if in chat window
    if (this.isInChatWindow) {
      this.criteriaValues?.getAllEntries(criterion).remove(this.criteriaValues.getEntry(criterion, DataSelection.LATEST_ENTRY_CREATED_TIME));
      this.criteria?.splice(this.criteria.indexOf(criterion), 1);
    }
  }

  public getNumberOfEntriesInHistory(criterion: Criterion): number {
    return this.criteriaValues?.getAllEntries(criterion).size() ?? 0;
  }

  public getDotClass(criterion: Criterion): string {
    if (this.criteriaValues != undefined) {
      let dataRecord: DataRecord<any> | undefined;
      if (criterion instanceof NumericalCriterion) {
        dataRecord = this.criteriaValues.getNumericalEntry(criterion);
      }
      else if (criterion instanceof CategoricalCriterion) {
        dataRecord = this.criteriaValues.getCategoricalEntry(criterion);
      }

      if (dataRecord !== undefined) {
        switch(dataRecord.dataSource){
          case DataSource.UNKNOWN:
            return 'dot-unknown';
          case DataSource.MANUAL:
            return 'dot-manual';
          case DataSource.AUDIO:
            return 'dot-audio';
          case DataSource.IMAGE:
            return 'dot-image';
          case DataSource.TEXT:
            return 'dot-text';
          case DataSource.INFERRED:
            return 'dot-inferred';
          case DataSource.COMBINED:
            return 'dot-combined';
          case DataSource.PDF:
            return 'dot-pdf';
        }
      }
    }
    return 'dot-unknown';
  }
}
