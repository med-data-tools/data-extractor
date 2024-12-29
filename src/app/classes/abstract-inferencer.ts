import { Range, CriteriaValues, Criterion, NumericalCriterion, DataSource, NumericalRecordList, NumericalDataRecord, CategoricalRecordList, CategoricalDataRecord } from "./model";
import { Constants } from "./constants";
import { CriterionStatus } from "./criterion-status";

export abstract class AbstractInferencer {
  public abstract getCriteriaValues(): CriteriaValues;
  public abstract getAllCriterionQueries(): Iterable<CriterionStatus>;
  protected abstract updateObjectsAfterCriterionChanged(criterion: Criterion): void;
  // public abstract findKnowledgeEntityReferences(element?: HTMLElement): void;


    /**
   * 
   * @param criterion 
   * @param value 
   * @param remainingUpdateRounds 
   * update values according to dependencies, but at most that many rounds remaining (breaks endless loops of circular dependencies)
   */
    public updateCriterionValue(criterion: Criterion, value: Range | string[], allCriteriaByPriority: Criterion[], allCriterionQuerys: Iterable<CriterionStatus>, dataSource: DataSource, overwriteCurrentValue: boolean, remainingUpdateRounds?: number, dontUpdateRange?: Criterion[], supressSwitchFromRangeToNumber?: Criterion[], time?: Date, entryCreatedTime?: Date): void {
      //TODO: maybe also add time as input parameter (used in criteriaValues)
      //basic consistency check (not complete)
      if (criterion instanceof NumericalCriterion && value instanceof Range) {
        value.start = this.makeCorrectNumber(criterion, value.start);
        value.end = this.makeCorrectNumber(criterion, value.end);
        if (value.start > value.end) {
          const swapMax = value.start;
          value.start = value.end;
          value.end = swapMax;
        }
      }
  
      //work only with copy of new value (to avoid modifying the same object again and again)
      if (value !== undefined) {
        value = value instanceof Range ? new Range(value.start, value.end, value.integral) : [...value];
      }
      //save old value
      var oldEntry = this.getCriteriaValues().getEntry(criterion);
      var oldValue = oldEntry.getValue();
      oldValue = oldValue instanceof Range ? new Range(oldValue.start, oldValue.end, oldValue.integral) : Array.isArray(oldValue) ? [...oldValue] : oldValue;
  
      //if old value has not chagend, we don't need to continue
      if (oldValue instanceof Range && value instanceof Range && CriteriaValues.numericalValuesAreTheSame(oldValue, value) && this.timesAreEqaul(oldEntry.getTime(), time)) {
        return;
      }
      if (Array.isArray(oldValue) && Array.isArray(value) && CriteriaValues.categoricalValuesAreTheSame(oldValue, value) && this.timesAreEqaul(oldEntry.getTime(), time)) {
        return;
      }
  
      //set value
      if (overwriteCurrentValue && !this.getCriteriaValues().isUndefined(criterion) && oldEntry.dataSource != DataSource.NOT_SET) {
        //overwrite value
        const valueToBeOverwritten = oldEntry.getValue();
        if (valueToBeOverwritten instanceof Range && value instanceof Range) {
          valueToBeOverwritten.start = value.start;
          valueToBeOverwritten.end = value.end;
          valueToBeOverwritten.integral = value.integral;
        }
        else if (Array.isArray(valueToBeOverwritten) && Array.isArray(value)) {
          valueToBeOverwritten.length = 0;
          valueToBeOverwritten.push(...value);
        }
        //adjust data source
        if (oldEntry.dataSource != dataSource) {
          oldEntry.dataSource = dataSource;
        }
        //adjust time stamps
        const recordList = this.getCriteriaValues().getAllEntries(criterion);
        if (recordList instanceof NumericalRecordList && oldEntry instanceof NumericalDataRecord) {
          recordList.changeTime(oldEntry, time, entryCreatedTime ?? new Date(), time == undefined);
        }
        else if (recordList instanceof CategoricalRecordList && oldEntry instanceof CategoricalDataRecord) {
          recordList.changeTime(oldEntry, time, entryCreatedTime ?? new Date(), time == undefined);
        }
      }
      else {
        //add new value
        this.getCriteriaValues().add(criterion, value, dataSource, time, entryCreatedTime);
      }
  
      //update criteria queries
      // first update the ones that are currently still unset
      // then update the ones that are already set
      // therefore create two lists, in both lists the criteria are ordered by priority started with the lowest prio
      const preliminaryCriteriaValues = this.getCriteriaValues().clone();
      const undefinedCriteriaQueryComponents = [];
      const setCriteriaQueryComponents = [];
      var CriterionQueryOfThisCriterion: CriterionStatus | undefined = undefined;
      var changedCriteria: {criterion: Criterion, value: any}[] = [];
      if (dontUpdateRange == undefined) {
        dontUpdateRange = [];
      }
      if (supressSwitchFromRangeToNumber == undefined) {
        supressSwitchFromRangeToNumber = [criterion];
      }
      for (var i = allCriteriaByPriority.length - 1; i >= 0; i--) { //traverse in inverse order of priority (change lowest prio first)
        //update the others in order -- first collect them
        for (let CriterionQuery of allCriterionQuerys) {
          if (allCriteriaByPriority[i] == CriterionQuery.criterion) {
            //don't update value of the criterion that is currently updated
            if (allCriteriaByPriority[i] == criterion) {
              CriterionQueryOfThisCriterion = CriterionQuery;
              continue;
            }
            //otherwise save it in one of the two arrays
            if (CriterionQuery.selectedValue == undefined || (Array.isArray(CriterionQuery.selectedValue) && CriterionQuery.selectedValue.length === 0)) {
              undefinedCriteriaQueryComponents.push(CriterionQuery);
            }
            else {
              setCriteriaQueryComponents.push(CriterionQuery);
            }
          }
        }
      }
      //after collecting them, do the updates ////////////TODO: DOES NOT YET WORK AS DESIRED; DEBUG
      for (let CriterionQuery of [...undefinedCriteriaQueryComponents, ...setCriteriaQueryComponents]) {
        AbstractInferencer.updateBoundsAndValues(CriterionQuery, preliminaryCriteriaValues, changedCriteria, dontUpdateRange, supressSwitchFromRangeToNumber);
      }
      //if nothing has changed we may need to change this value s.t. it fits the dependencies (and gets refreshed)
      //but this is only done if all its dependencies are set (criterion query component is not undefined)
      var thisCriterionQueryHasBeenUpdated = false;
      if (changedCriteria.length == 0){
        if(CriterionQueryOfThisCriterion!==undefined){
          if (AbstractInferencer.allDependingCriterionComponentsAreSet(CriterionQueryOfThisCriterion!, preliminaryCriteriaValues, allCriterionQuerys)) {
            AbstractInferencer.updateBoundsAndValues(CriterionQueryOfThisCriterion!, preliminaryCriteriaValues, changedCriteria, dontUpdateRange, supressSwitchFromRangeToNumber);
            thisCriterionQueryHasBeenUpdated = true;
          }
        }
      }
      //update criteria that has just changed
      if (remainingUpdateRounds == undefined || remainingUpdateRounds > 0) {
        changedCriteria.reverse(); //start by criteria with highest priority
        for (let changedCriterion of changedCriteria) {
          this.updateCriterionValue(changedCriterion.criterion, changedCriterion.value, allCriteriaByPriority, allCriterionQuerys, DataSource.INFERRED, true, remainingUpdateRounds == undefined ? Constants.MAX_UPDATE_ROUNDS_CRITERIA_VALUES : remainingUpdateRounds - 1, dontUpdateRange, supressSwitchFromRangeToNumber);
        }
      }
      
      //in any case make sure that we have updated the criterion query component of this criterion
      if (!thisCriterionQueryHasBeenUpdated) {
        AbstractInferencer.updateBoundsAndValues(CriterionQueryOfThisCriterion!, preliminaryCriteriaValues, changedCriteria, dontUpdateRange, supressSwitchFromRangeToNumber);
      }
  
  
      this.updateObjectsAfterCriterionChanged(criterion);
    }

    private timesAreEqaul(date1: Date | undefined, date2: Date | undefined): boolean {
      if (date1 == undefined && date2 == undefined) {
        return true;
      }
      if (date1 != undefined && date2 != undefined) {
        return date1.getTime() === date2.getTime();
      }
      return false;
  }


    private makeCorrectNumber(criterion: NumericalCriterion, value: number): number {
      const minValueOrRange = criterion.minValue.getValue(this.getCriteriaValues()) ?? Number.NEGATIVE_INFINITY;
      const minValue = minValueOrRange instanceof Range ? minValueOrRange.start : minValueOrRange;
      
      const maxValueOrRange = criterion.maxValue.getValue(this.getCriteriaValues()) ?? Number.POSITIVE_INFINITY;
      const maxValue = maxValueOrRange instanceof Range ? maxValueOrRange.end : maxValueOrRange;
      
      if (criterion.integral && !Number.isInteger(value)) {
        value = Math.round(value);
      }
      if (value < minValue) {
        value = minValue;
      }
      if (value > maxValue) {
        value = maxValue;
      }
      return value;
    }

    private static allDependingCriterionComponentsAreSet(CriterionQuery: CriterionStatus, criteriaValues: CriteriaValues, allCriterionQuerys: Iterable<CriterionStatus>) {
      //TODO check if this should be done also for categoricalExclusions (for categorical criteria; currently only for numerical criteria)
      const dependingCriteria = CriterionQuery.conditionalValue?.getDependingCriteria(criteriaValues) ?? [];
      if (dependingCriteria.length > 0) {
        for (let CriterionQuery of allCriterionQuerys) {
          if (dependingCriteria.includes(CriterionQuery.criterion)) {
            if (CriterionQuery.selectedValue == undefined) {
              return false;
            }
          }
        }
      }
      return true;
    }

    protected static updateBoundsAndValues(criterionQuery: CriterionStatus, preliminaryCriteriaValues: CriteriaValues, changedCriteria: {criterion: Criterion, value: any}[], dontUpdateRange: Criterion[], supressSwitchFromRangeToNumber?: Criterion[]): void {
      if(criterionQuery!==undefined){
        if (criterionQuery.updateBoundsAndValue(preliminaryCriteriaValues, dontUpdateRange, supressSwitchFromRangeToNumber)) {
          // we do not update this.criteriaValues but only the preliminary criteria values
          // because this.criteriaValues is updated later when this.updateCriterionValue() is called for the elements in the array changedCriteria
          // if we would do that here, changes would not be notified by comparision with this.criteriaValues.
          // Instead we "store" both the criterion and the value in the array changedCriteria, which then triggers the process.
          const criterion = criterionQuery.criterion;
          const newValue = CriterionStatus.transformToCriterionValue(criterion, criterionQuery.selectedValue, preliminaryCriteriaValues);
          //save changed entry
          changedCriteria.push({criterion: criterion, value: newValue});
          //and add the new value to the preliminary criteria values
          preliminaryCriteriaValues.add(criterion, newValue);
        }
      }
    }
}
