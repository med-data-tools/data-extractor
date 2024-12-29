import { EventEmitter } from '@angular/core';
import { CategoricalCriterion, NumericalCriterion, Criterion, Visibility, BooleanOrUndef, Guideline, ConditionalNumerical, ValueExclusion, Numerical, Range, CriteriaValues, DataSource } from './model';
import { Constants } from './constants';
import { AbstractInferencer } from './abstract-inferencer';
import * as moment from 'moment';

export class CriterionStatus {
  public isNumerical: boolean;
  public isMultiSelect: boolean;
  public selectedDate: Date | undefined;
  public selectedTime: string | undefined;
  private timeOfMeasurement: Date | undefined;
  public minValue: number;
  public maxValue: number;
  public stepWidth: number;
  public nextTimeAllowOverwritingOldValue: boolean | undefined;

  public selectedValue: number | Range | string | string[] | undefined;
  public selectedValueOfSlider?: string;

  public conditionalValue?: ConditionalNumerical;
  private categoricalExclusions: ValueExclusion[];

  public readonly MANUAL = DataSource.MANUAL;

  //@Output() TODO: solve this differently
  ping: EventEmitter<[Criterion, string[] | Range, DataSource, boolean, Date?]> = new EventEmitter<[Criterion, string[] | Range, DataSource, boolean, Date?]>(); //see method this.changeCheck for the meaning of each of these entries

  constructor(public criterion: Criterion, public guideline: Guideline, public parentCriterionQuery: AbstractInferencer) {
    this.criterion = new CategoricalCriterion("DummyCriterion", "", [""], Visibility.NEVER);
    this.isNumerical = false;
    this.isMultiSelect = false;
    this.categoricalExclusions = [];
    this.minValue = Constants.CRITERION_DEFAULT_MIN;
    this.maxValue = Constants.CRITERION_DEFAULT_MAX;
    this.stepWidth = 1;

    this.selectedValue = undefined;

    this.init();
  }

  public getCategoricalCriterion() {
    return this.criterion instanceof CategoricalCriterion ? this.criterion : undefined;
  }
  
  public init() {
    if (this.criterion instanceof NumericalCriterion) {
      this.isNumerical = true;
      //extract conditional value
      if (this.guideline != undefined) {
        for (let numericalDependency of this.guideline.numericalDependencies) {
          if (numericalDependency.criterion == this.criterion) {
            this.conditionalValue = numericalDependency.conditionalNumerical;
          }
        }
      }

      //find inital min and max
      this.minValue = this.criterion.minValue.getValueLow(this.parentCriterionQuery.getCriteriaValues()) ?? Constants.CRITERION_DEFAULT_MIN;
      this.maxValue = this.criterion.maxValue.getValueHigh(this.parentCriterionQuery.getCriteriaValues()) ?? Constants.CRITERION_DEFAULT_MAX;
      if (this.criterion.integral) {
        this.stepWidth = 1.0;
        // this.initialValue = this.minValue + Math.round((this.maxValue - this.minValue) / 2.0);
      }
      else {
        this.stepWidth = (this.maxValue - this.minValue) / 100.0;
        // this.initialValue = this.minValue + (this.maxValue - this.minValue) / 2.0;
      }
      if (this.minValue == this.maxValue) {
        this.selectedValue = this.minValue;
        //trigger update of criteria values
        this.changeCheck(this.selectedValue, DataSource.UNKNOWN);
      }
    }
    else if (this.criterion instanceof CategoricalCriterion) {
      this.isNumerical = false;
      this.isMultiSelect = this.criterion.values.length > 2;
      this.categoricalExclusions = [];
      //extract exclusion values
      if (this.guideline != undefined) {
        for (let categoricalDependency of this.guideline.categoricalDependencies) {
          if (categoricalDependency.criterion == this.criterion) {
            this.categoricalExclusions = this.categoricalExclusions.concat(categoricalDependency.valueExclusions);
          }
        }
      }
    }
  }
  
  /**
   * return if value has changed (not if bounds have changed!)
   */
  private updateBounds(criteriaValues: CriteriaValues): boolean | { start: boolean; end: boolean; } {
    if (!(this.criterion instanceof NumericalCriterion) || Array.isArray(this.selectedValue) || typeof this.selectedValue === 'string') {
      return false;
    }

    var valueHasChanged: boolean | { start: boolean; end: boolean; } = false;
    let oldMinValue = this.minValue;
    let oldMaxValue = this.maxValue;
    this.minValue = this.criterion.minValue.getValueLow(criteriaValues) ?? Constants.CRITERION_DEFAULT_MIN;
    this.maxValue = this.criterion.maxValue.getValueHigh(criteriaValues) ?? Constants.CRITERION_DEFAULT_MAX;

    //check if something has changed and apply changes
    if (this.isMultiSelect) {
      // a range because of multiselect -- exclude the case undefined and number
      if (this.selectedValue == undefined) {
        this.selectedValue = CriteriaValues.getUndefinedRange(this.criterion, criteriaValues);
      }
      else if (typeof this.selectedValue === 'number') {
        this.selectedValue = new Range(this.selectedValue, this.selectedValue);
      }
      valueHasChanged = { start: false, end: false };

      if (oldMinValue != this.minValue) {
        if (this.selectedValue != undefined && this.selectedValue.start < this.minValue) {
          this.selectedValue.start = this.minValue;
          valueHasChanged.start = true;
        }
        if (this.selectedValue != undefined && this.selectedValue.end < this.minValue) {
          this.selectedValue.end = this.minValue;
          valueHasChanged.end = true;
        }
      }
      if (oldMaxValue != this.maxValue) {
        if (this.selectedValue != undefined && this.selectedValue.start > this.maxValue) {
          this.selectedValue.start = this.maxValue;
          valueHasChanged.start = true;
        }
        if (this.selectedValue != undefined && this.selectedValue.end > this.maxValue) {
          this.selectedValue.end = this.maxValue;
          valueHasChanged.end = true;
        }
      }
    }
    else {
      // a single number (or undefined) because no multiselect -- exclude the case Range
      if (this.selectedValue instanceof Range) {
        this.selectedValue = this.selectedValue.getMean();
      }

      if (oldMinValue != this.minValue) {
        if (this.selectedValue != undefined && this.selectedValue < this.minValue) {
          this.selectedValue = this.minValue;
          valueHasChanged = true;
        }
      }
      if (oldMaxValue != this.maxValue) {
        if (this.selectedValue != undefined && this.selectedValue > this.maxValue) {
          this.selectedValue = this.maxValue;
          valueHasChanged = true;
        }
      }
      //if there is only one possible value left after the bounds have changed -> confirm it
      if ((this.minValue != oldMinValue || this.maxValue != oldMaxValue) && this.minValue == this.maxValue) {
        this.selectedValue = this.minValue;
        valueHasChanged = true;
      }
    }

    return valueHasChanged;
  }

  /**
   * returns if the value has changed
   */
  private updateValue(criteriaValues: CriteriaValues, valueHasChangedJustBefore?: boolean, dontUpdateRange?: Criterion[], supressSwitchFromRangeToNumber?: Criterion[]): boolean | { start: boolean; end: boolean; } {
    if (!(this.criterion instanceof NumericalCriterion) || Array.isArray(this.selectedValue) || typeof this.selectedValue === 'string') {
      return false;
    }

    //special case: if this criterion is set to undefined and at least one criterion its value depends on is undefined, too, then keep it undefined
    if (this.selectedValue == undefined && criteriaValues.isUndefined(this.criterion)) {
      for (let dependingCriterion of this.conditionalValue?.getDependingCriteria(criteriaValues) ?? []) {
        if (criteriaValues.isUndefined(dependingCriterion)) {
          return false;
        }
      }
    }

    let oldValue = this.selectedValue instanceof Range ? new Range(this.selectedValue.start, this.selectedValue.end, this.selectedValue.integral) : this.selectedValue; //create a copy of the current selected value
    let candidateValue = this.conditionalValue?.getValue(criteriaValues) ?? (valueHasChangedJustBefore ? this.selectedValue : criteriaValues.isUndefined(this.criterion) && this.selectedValue == undefined ? undefined : criteriaValues.getNumericalAsCopy(this.criterion));
    if (candidateValue instanceof Range) {
      //leave candidate as a single number if start and end of a range are the same and it has not been a range before
      if (candidateValue.start === candidateValue.end && !this.isMultiSelect) {
        candidateValue = candidateValue.start; //set to a single number again
      }
      else {
        if (dontUpdateRange != undefined && dontUpdateRange.includes(this.criterion)) {
          //we don't update this value to a range (because an earlier value producing a range depends on this number, don't create circular growing ranges)
          return { start: false, end: false };
        }

        if (!this.isMultiSelect) {
          //we need to update from a single number to a range -> switch mode
          this.isMultiSelect = true;
          if (this.selectedValue == undefined) {
            this.selectedValue = new Range(this.minValue, this.maxValue, (<NumericalCriterion> this.criterion).integral);
          }
          else if (typeof this.selectedValue === 'number') {
            this.selectedValue = new Range(this.selectedValue, this.selectedValue, (<NumericalCriterion> this.criterion).integral);
          }
        }
      }
    }
    if (Number.isFinite(candidateValue)) {
      if (this.isMultiSelect && !supressSwitchFromRangeToNumber?.includes(this.criterion)) {
        this.isMultiSelect = false;
      }
    }
    
    if (candidateValue == undefined) {
      if (oldValue != undefined) {
        if (this.isMultiSelect) {
          if (this.selectedValue instanceof Range) { //should always be true
            this.selectedValue.start = this.minValue;
            this.selectedValue.end = this.maxValue;
          }
          return { start: true, end: true};
        }
        else {
          this.selectedValue = candidateValue;
          return true;
        }
      }        
      return false;
    }
    if (this.criterion.integral) {
      if (candidateValue instanceof Range) {
        candidateValue.start = Math.round(candidateValue.start);
        candidateValue.end = Math.round(candidateValue.end);
      }
      else {
        candidateValue = Math.round(candidateValue);
      }
    }
    if (candidateValue instanceof Range) {
      if (candidateValue.start < this.minValue) {
        candidateValue.start = this.minValue;
      }
      else if (candidateValue.start > this.maxValue) {
        candidateValue.start = this.maxValue;
      }
      if (candidateValue.end > this.maxValue) {
        candidateValue.end = this.maxValue;
      }
      else if (candidateValue.end < this.minValue) {
        candidateValue.end = this.minValue;
      }
      if (candidateValue.start > candidateValue.end) {
        candidateValue.end = candidateValue.start;
      }
    }
    else {
      if (candidateValue < this.minValue) {
        candidateValue = this.minValue;
      }
      if (candidateValue > this.maxValue) {
        candidateValue = this.maxValue;
      }
    }

    if (this.isMultiSelect) {
      if (this.selectedValue instanceof Range) { //should always be true
        this.selectedValue.start = candidateValue instanceof Range ? candidateValue.start : candidateValue;
        this.selectedValue.end = candidateValue instanceof Range ? candidateValue.end : candidateValue;
      }
      //only if this is a range depending on other (values), do not update the values it depends on
      //Note that inconsistencies can occur if we reach the max/min of this value and lock the other depending criteria;
      //maybe consider this case as TODO later; for now there does not seem to be an obvious solution
      //(an obvious solution, not locking all other depending criteria, lets the ranges grow too much).
      dontUpdateRange?.push(...(this.conditionalValue?.getDependingCriteria(criteriaValues) ?? []));
      var hasChanged = { start: false, end: false };
      if (this.selectedValue instanceof Range) { //should always be true
        if (oldValue == undefined || (oldValue instanceof Range ? oldValue.start : oldValue) != this.selectedValue.start) {
          hasChanged.start = true;
        }
        if (oldValue == undefined || (oldValue instanceof Range ? oldValue.end : oldValue) != this.selectedValue.end) {
          hasChanged.end = true;
        }
      }
      return hasChanged;
    }
    else {
      this.selectedValue = candidateValue instanceof Range ? candidateValue.getMean() : candidateValue;
      if (oldValue != this.selectedValue) {
        return true;
      }
    }
    return false;
  }


  /**
   * return if value has changed
   * 
   */
  private updateCurrentCategoricalValue(criteriaValues: CriteriaValues) {
    if (!(this.criterion instanceof CategoricalCriterion) || this.selectedValue instanceof Range || typeof this.selectedValue === 'number') {
      return false;
    }

    var selectedValueAsArray = CriterionStatus.transformToCriterionValue(this.criterion, this.selectedValue, criteriaValues);
    if (selectedValueAsArray instanceof Range) { //should never be true
      selectedValueAsArray = [];
    }
    const currentValue = criteriaValues.getCategoricalAsCopy(this.criterion);
    if (!CriteriaValues.categoricalValuesAreTheSame(selectedValueAsArray, currentValue)) {
      return true;
    }
    return false;
  }

  /**
   * returns if the value has changed
   * 
   * @param criteriaValues 
   */
  public updateBoundsAndValue(criteriaValues: CriteriaValues, dontUpdateRange?: Criterion[], supressSwitchFromRangeToNumber?: Criterion[]): boolean {
    var hasChanged: boolean | { start: boolean; end: boolean; } = false; //if the value is a range, then it says whether start and end have changed
    if (this.criterion instanceof NumericalCriterion) {
      hasChanged = this.updateHasChangedVar(hasChanged,
        this.updateBounds(criteriaValues)
      );
      // if the value has changed while we have updated the bounds, this means, if this.updateValue does not set this to any sensible value, it will be set to the value determined by this.updateBounds
      const valueHasChangedJustBefore: boolean = typeof hasChanged === "boolean" ? hasChanged : (hasChanged.start || hasChanged.end) ? true : false;
      hasChanged = this.updateHasChangedVar(hasChanged, 
        this.updateValue(criteriaValues, valueHasChangedJustBefore, dontUpdateRange, supressSwitchFromRangeToNumber)
      );
    }
    else if (this.criterion instanceof CategoricalCriterion) {
      hasChanged = this.updateHasChangedVar(hasChanged,
        this.updateCurrentCategoricalValue(criteriaValues)
      );
    }

    return typeof hasChanged === "boolean" ? hasChanged : (hasChanged.start || hasChanged.end);
  }

  /**
   * hasChangedVar tells by a boolean (value or multiple criteria values) or a boolean assigned to a start and an end (range of numerial values) whether the value has changed.
   * However merging these values is a bit mor complicated because we don't know if it is just a boolean or a pair of booleans
   * 
   * @param oldHasChangedVar 
   * @param newHasChangedVar 
   * @returns 
   */
  private updateHasChangedVar(oldHasChangedVar: boolean | { start: boolean; end: boolean; }, newHasChangedVar: boolean | { start: boolean; end: boolean; }): boolean | { start: boolean; end: boolean; } {
    if (typeof oldHasChangedVar === "boolean") {
      if (typeof newHasChangedVar === "boolean") {
        return oldHasChangedVar || newHasChangedVar;
      }
      else {
        newHasChangedVar.start = newHasChangedVar.start || oldHasChangedVar;
        newHasChangedVar.end = newHasChangedVar.end || oldHasChangedVar;
        return newHasChangedVar;
      }
    }
    else {
      if (typeof newHasChangedVar === "boolean") {
        oldHasChangedVar.start = oldHasChangedVar.start || newHasChangedVar;
        oldHasChangedVar.end = oldHasChangedVar.end || newHasChangedVar;
        return oldHasChangedVar;
      }
      else {
        newHasChangedVar.start = newHasChangedVar.start || oldHasChangedVar.start;
        newHasChangedVar.end = newHasChangedVar.end || oldHasChangedVar.end;
        return newHasChangedVar;
      }
    }
  }

  /**
   * 
   * @param eventObject 
   * @param dataSource 
   * @param allowOverwritingOldValue 
   *    default is true
   */
  public changeCheck(eventObject: string[] | string | Range | number | undefined, dataSource: DataSource, allowOverwritingOldValue?: boolean): void {
    this.nextTimeAllowOverwritingOldValue = undefined;
    this.ping.emit([this.criterion, CriterionStatus.transformToCriterionValue(this.criterion, eventObject, this.parentCriterionQuery?.getCriteriaValues()), dataSource, allowOverwritingOldValue ?? true, this.timeOfMeasurement]);
  }

  public resetValue(dataSource: DataSource, allowOverwritingOldValue?: boolean): void {
    this.selectedDate = undefined;
    this.selectedTime = undefined;
    this.timeOfMeasurement = undefined;
    if (this.criterion instanceof NumericalCriterion) {
      this.isMultiSelect = false;
      this.selectedValue = undefined;

      this.changeCheck(undefined, dataSource, allowOverwritingOldValue); //shouldn't be done to avoid side effects //2024-04-29 jz: I think this should be done to update to the undefined range
    }
    else if (this.criterion instanceof CategoricalCriterion) {
      this.nextTimeAllowOverwritingOldValue = allowOverwritingOldValue;
      this.selectedValue = undefined;
      this.changeCheck(undefined, dataSource, allowOverwritingOldValue);
    }
    
  }

  public changedTime(): void {
    const timeParts = (this.selectedTime ?? Constants.DEFAULT_TIME_OF_INSERTED_CRITERION).split(':');
    if (timeParts.length != 2) {
      this.timeOfMeasurement = undefined;
      return ;
    }
    const [hoursStr, minutesStr] = timeParts;
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (isNaN(hours) || isNaN(minutes)) {
      this.timeOfMeasurement = undefined;
      return;
    }
    if (moment(this.selectedDate, 'DD.MM.YYYY', true).isValid()) {
      this.selectedDate = moment(this.selectedDate, 'DD.MM.YYYY').toDate();
    } else {
      this.selectedDate = undefined;
    }
    if (this.selectedDate != undefined) {
      const insertedTime = new Date();
      insertedTime.setFullYear(this.selectedDate.getFullYear());
      insertedTime.setMonth(this.selectedDate.getMonth());
      insertedTime.setDate(this.selectedDate.getDate());
      insertedTime.setHours(hours);
      insertedTime.setMinutes(minutes);
      insertedTime.setSeconds(0);
      insertedTime.setMilliseconds(0);

      //if the time has changed
      if (this.timeOfMeasurement == undefined || this.timeOfMeasurement.getTime() != insertedTime.getTime()) {
        this.timeOfMeasurement = insertedTime;
        //update to criteria values
        this.changeCheck(this.selectedValue, DataSource.MANUAL); //time of measurement will be read from the class variable when calling ping
      }
    }
  }

  public storeCurrentEntry(): void {
    this.resetValue(DataSource.MANUAL, false);
  }


  //helper methods

  public selectedValueAsRange(): Range {
    if (this.selectedValue instanceof Range) {
      return this.selectedValue
    }
    if (typeof this.selectedValue === 'number') {
      return new Range(this.selectedValue, this.selectedValue);
    }
    if (this.criterion instanceof NumericalCriterion) {
      return CriteriaValues.getUndefinedRange(this.criterion);
    }
    return new Range(Constants.CRITERION_DEFAULT_MIN, Constants.CRITERION_DEFAULT_MAX);
  }
  
  public static transformToCriterionValue(criterion: Criterion, value: Range | string[] | number | string | undefined, criteriaValues?: CriteriaValues): Range | string[] {
    //if it is not a range or string array -> transform it
    if (typeof value === 'string') {
      value = [value];
    }
    else if (typeof value === 'number') {
      value = new Range(value, value);
    }
    else if (value == undefined) {
      value = criterion instanceof NumericalCriterion ? CriteriaValues.getUndefinedRange(criterion, criteriaValues) : [];
    }

    return value;
  }
}
