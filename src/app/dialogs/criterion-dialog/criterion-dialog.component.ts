import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Constants } from 'src/app/classes/constants';
import { CriterionStatus } from 'src/app/classes/criterion-status';
import { BooleanOrUndef, CategoricalCriterion, CriteriaValues, Criterion, Guideline, Numerical, NumericalCriterion, Range, ValueExclusion } from 'src/app/classes/model';

export class CriterionDialogData {
  constructor(
    public criterion: Criterion,
    public values: CriteriaValues,
    public canChangeEntry: boolean,
    public viewHistory: boolean,
    public guideline?: Guideline,
    public updateValuesImmediately: boolean = false
  ) {}
}

@Component({
  selector: 'app-criterion-dialog',
  templateUrl: './criterion-dialog.component.html',
  styleUrls: ['./criterion-dialog.component.css']
})
export class CriterionDialogComponent {
  public CRITERION_SHORT_DESCRIPTION_MAX_LENGTH() { return Constants.CRITERION_SHORT_DESCRIPTION_MAX_LENGTH; }
  public STRING_FOR_UNDEFINED_CRITERION_VALUE() { return Constants.STRING_FOR_UNDEFINED_CRITERION_VALUE; }
  public isNumerical: boolean = false;
  public isMultiSelect: boolean;

  public selectedValue: number | Range | string | string[] | undefined = undefined;
  // public numberStartControl?: FormControl;
  // public numberEndControl?: FormControl;

  public minValue: number = Constants.CRITERION_DEFAULT_MIN;
  public maxValue: number = Constants.CRITERION_DEFAULT_MAX;
  public stepWidth: number = 1.0;
  public categoricalValues: string[] = [];
  private categoricalExclusions: ValueExclusion[] = [];
  private oldValue: Range | string[] = [];

  constructor(
    public dialogRef: MatDialogRef<CriterionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CriterionDialogData
  ) {
    this.isMultiSelect = data.criterion instanceof CategoricalCriterion && data.criterion.values.length > 2 ? true : false;
    const criterion = data.criterion;
    if (criterion instanceof NumericalCriterion) {
      this.oldValue = data.values.getNumerical(criterion).clone();
      this.isNumerical = true;
      this.minValue = criterion.minValue.getValueLow(data.values) ?? this.minValue;
      this.maxValue = criterion.maxValue.getValueHigh(data.values) ?? this.maxValue;
      if (criterion.integral) {
        this.stepWidth = 1.0;
      }
      else {
        this.stepWidth = (this.maxValue - this.minValue) / 100.0;
      }
      // this.numberStartControl = new FormControl("number-start-input");
      // this.numberEndControl = new FormControl("number-end-input");
      const range = this.data.values.getNumerical(criterion);
      if (range.start < this.minValue) {
        range.start = this.minValue;
      }
      if (range.end > this.maxValue) {
        range.end = this.maxValue;
      }
      if (range.start === range.end) {
        this.selectedValue = range.start;
      }
      else if (!data.values.isUndefined(data.criterion)) {
        this.isMultiSelect = true;
        this.selectedValue = range;
      }
    }
    else if (criterion instanceof CategoricalCriterion) {
      this.isNumerical = false;
      this.oldValue = [...data.values.getCategorical(criterion)];
      //extract exclusion values
      if (this.data.guideline != undefined) {
        for (let categoricalDependency of this.data.guideline.categoricalDependencies) {
          if (categoricalDependency.criterion === criterion) {
            this.categoricalExclusions = this.categoricalExclusions.concat(categoricalDependency.valueExclusions);
          }
        }
      }
      //find available criteria values
      for (let v of criterion.valueNames ?? []) {
        if (!this.valueIsExcluded(v, data.values)) {
          this.categoricalValues.push(v);
        }
      }
      if (this.isMultiSelect) {
        this.selectedValue = this.data.values.getCategorical(criterion);
      }
      else {
        this.selectedValue = this.data.values.getCategorical(criterion)[0] ?? "";
      }
    }
  }

  getResult() {
    //check if the value is the same as before and if yes do nothing (i.e., return undefined)
    if (
      (this.oldValue instanceof Range &&  this.oldValue.equals(this.selectedValue)) || // same numerical values
      (Array.isArray(this.oldValue) && Array.isArray(this.selectedValue) && this.areArraysEqual(this.oldValue, this.selectedValue)) || // same categorical values
      (Array.isArray(this.oldValue) && this.oldValue.length === 0 && (this.selectedValue === undefined || this.selectedValue === '')) // same categorical values (still nothing chosen)
    ){
      return undefined;
    }
    const changedValue = CriterionStatus.transformToCriterionValue(this.data.criterion, this.selectedValue, this.data.values);
    if (this.data.updateValuesImmediately) {
      if (this.data.criterion instanceof NumericalCriterion && changedValue instanceof Range) {
        //adjust entry, delete old entry, enter updated entry
        const oldEntry = this.data.values.getNumericalEntry(this.data.criterion);
        const adjustedEntry = oldEntry.copy(changedValue);
        this.data.values.removeEntry(this.data.criterion, oldEntry);
        this.data.values.addEntry(this.data.criterion, adjustedEntry);
      }
      else if (this.data.criterion instanceof CategoricalCriterion && Array.isArray(changedValue)) {
        //adjust entry, delete old entry, enter updated entry
        const oldEntry = this.data.values.getCategoricalEntry(this.data.criterion);
        const adjustedEntry = oldEntry.copy(changedValue);
        this.data.values.removeEntry(this.data.criterion, oldEntry);
        this.data.values.addEntry(this.data.criterion, adjustedEntry);
      }
    }
    this.dialogRef.close(changedValue);
  }

  private areArraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }
  
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();
  
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  public selectedValueAsRange(): Range {
    if (this.selectedValue instanceof Range) {
      return this.selectedValue;
    }
    if (typeof this.selectedValue === 'number') {
      return new Range(this.selectedValue, this.selectedValue);
    }
    if (this.data.criterion instanceof NumericalCriterion) {
      return CriteriaValues.getUndefinedRange(this.data.criterion);
    }
    return new Range(Constants.CRITERION_DEFAULT_MIN, Constants.CRITERION_DEFAULT_MAX);
  }

  public formatLabel(value: number | undefined): string {
    if (value == undefined) return "";
    return Numerical.round(value, Constants.ROUNDING_DECIMAL_PRECISION) + "";
  }

  public toggleMultiSelect(): void {
    this.isMultiSelect = !this.isMultiSelect;
    if (this.isMultiSelect) {
      if (this.selectedValue == undefined) {
        this.selectedValue = new Range(this.minValue, this.maxValue, (<NumericalCriterion> this.data.criterion).integral);
      }
      else {
        if (typeof this.selectedValue === 'number') { //should always be true
          this.selectedValue = new Range(this.selectedValue, this.selectedValue, (<NumericalCriterion> this.data.criterion).integral);
        }
      }
    }
    else {
      if (this.selectedValue instanceof Range) {
        if (this.selectedValue.start == this.minValue && this.selectedValue.end == this.maxValue) {
          //if full range -> value can be anything and is hence undefined
          this.selectedValue = undefined;
        }
        else {
          //otherwise take the mean of the current range
          this.selectedValue = Number.parseFloat(this.formatLabel(this.selectedValue.getMean()));
        }
      }
    }
  }

  private valueIsExcluded(value: string, criteriaValues: CriteriaValues) {
    for (let values2exclusions of this.categoricalExclusions) {
      if (values2exclusions.values.includes(value) && values2exclusions.excludingCondition.evaluate(criteriaValues) === BooleanOrUndef.TRUE) {
        return true;
      }
    }
    return false;
  }
}
